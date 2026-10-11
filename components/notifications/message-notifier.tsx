"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { alertsFor, notificationText, type IncomingMessage } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

// MSG-36: alerts for new messages in any of the user's chats, following their settings (MSG-21):
// a system notification and/or a short sound, unless they're already looking at that chat.
// Also refreshes the page data, so the sidebar's previews and unread badges update live.
// One Realtime subscription to all messages; RLS delivers only the user's own conversations.

const REFRESH_DELAY_MS = 400;

export function MessageNotifier({
  userId,
  notifyNewMessages,
  notifySound,
}: {
  userId: string;
  notifyNewMessages: boolean;
  notifySound: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Read inside the subscription callback without resubscribing on every navigation or save.
  const latest = useRef({ pathname, notifyNewMessages, notifySound, router });
  useEffect(() => {
    latest.current = { pathname, notifyNewMessages, notifySound, router };
  });

  useEffect(() => {
    const supabase = createClient();
    const names = new Map<string, string>();
    const conversations = new Map<string, { kind: "direct" | "group"; title: string | null }>();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let refreshTimer: number | undefined;
    let cancelled = false;

    async function senderName(id: string) {
      if (!names.has(id)) {
        const { data } = await supabase.from("profiles").select("display_name").eq("id", id).maybeSingle();
        names.set(id, data?.display_name ?? "New message");
      }
      return names.get(id)!;
    }

    async function conversation(id: string) {
      if (!conversations.has(id)) {
        const { data } = await supabase.from("conversations").select("kind, title").eq("id", id).maybeSingle();
        if (data) conversations.set(id, data as { kind: "direct" | "group"; title: string | null });
      }
      return conversations.get(id) ?? null;
    }

    async function onMessage(message: IncomingMessage) {
      const { pathname, notifyNewMessages, notifySound, router } = latest.current;

      // Batch bursts of messages into one refresh of the sidebar and the open page.
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => router.refresh(), REFRESH_DELAY_MS);

      const permission = "Notification" in window ? Notification.permission : "unsupported";
      const view = { pathname, attentive: document.visibilityState === "visible" && document.hasFocus() };
      const alerts = alertsFor(message, userId, view, { notifyNewMessages, notifySound, permission });

      if (alerts.sound) playChime();
      if (!alerts.notify) return;

      const [name, chat] = await Promise.all([senderName(message.sender_id), conversation(message.conversation_id)]);
      const { title, body } = notificationText(message, name, chat);
      const notification = new Notification(title, {
        body,
        icon: "/icons/icon-192.png",
        tag: message.conversation_id, // one notification per chat; a newer message replaces it
      });
      notification.onclick = () => {
        window.focus();
        latest.current.router.push(`/chat/${message.conversation_id}`);
        notification.close();
      };
    }

    async function subscribe() {
      // Use the signed-in session: with RLS, an anonymous subscriber receives nothing.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`notify:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
          void onMessage(payload.new as IncomingMessage);
        })
        .subscribe();
    }

    void subscribe();
    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}

let audio: AudioContext | undefined;

// A short two-note chime, generated so no sound file is needed. Browsers only allow audio after
// the user has interacted with the page once; before that it silently does nothing.
function playChime() {
  try {
    audio ??= new AudioContext();
    const start = audio.currentTime;
    for (const [i, frequency] of [880, 1320].entries()) {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.2, start + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.12 + 0.25);
      tone.connect(gain).connect(audio.destination);
      tone.start(start + i * 0.12);
      tone.stop(start + i * 0.12 + 0.3);
    }
  } catch {
    // No audio support: nothing to do.
  }
}
