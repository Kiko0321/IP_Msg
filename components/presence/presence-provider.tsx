"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// MSG-23: who is online right now, via Supabase Realtime Presence on one shared channel.
// Each open tab of a signed-in user joins with presence key = user id; Realtime removes it when
// the socket closes (tab closed, network lost, sleep), so no explicit "offline" message is needed.
// last_seen_at is refreshed every HEARTBEAT_MS while the tab is visible and once when it's hidden,
// so "Last seen" stays within about a minute even after a crash.

const HEARTBEAT_MS = 60_000;

const OnlineUsersContext = createContext<ReadonlySet<string>>(new Set());

export function useOnlineUsers() {
  return useContext(OnlineUsersContext);
}

export function PresenceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [online, setOnline] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const supabase = createClient();
    const touch = () => void supabase.rpc("touch_last_seen");

    const channel = supabase.channel("presence:online", { config: { presence: { key: userId } } });
    channel
      .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
          touch();
        }
      });

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") touch();
    }, HEARTBEAT_MS);
    // Record the moment the user switches away or closes the tab.
    const onVisibility = () => touch();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return <OnlineUsersContext value={online}>{children}</OnlineUsersContext>;
}
