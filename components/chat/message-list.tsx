"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { ChatMember, DisplayMessage } from "@/lib/chat/types";
import { MessageAttachment } from "./message-attachment";

// Client component: times render in the viewer's time zone, and MSG-18 adds live updates here.
export function MessageList({
  messages,
  members,
  currentUserId,
  showSenderNames,
  hasOlder = false,
  loadingOlder = false,
  onLoadOlder,
}: {
  messages: DisplayMessage[];
  members: Record<string, ChatMember>;
  currentUserId: string;
  showSenderNames: boolean;
  /** MSG-38: older messages exist; show a button that calls onLoadOlder. */
  hasOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const endRef = useRef<HTMLLIElement>(null);
  // Scroll height before older messages were added on top, to keep the same messages in view.
  const heightBeforeOlder = useRef<number | null>(null);

  // Keep the newest message in view when one arrives (not when older ones are added on top).
  const newestId = messages.at(-1)?.id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [newestId]);

  // After older messages are added on top, shift the scroll position by their height.
  const oldestId = messages[0]?.id;
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || heightBeforeOlder.current === null) return;
    list.scrollTop += list.scrollHeight - heightBeforeOlder.current;
    heightBeforeOlder.current = null;
  }, [oldestId]);

  function loadOlder() {
    heightBeforeOlder.current = listRef.current?.scrollHeight ?? null;
    onLoadOlder?.();
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-neutral-500">
        No messages yet. Say hello!
      </div>
    );
  }

  return (
    <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-4" aria-label="Messages">
      <li className="flex justify-center pb-2">
        {hasOlder ? (
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingOlder}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300"
          >
            {loadingOlder ? "Loading…" : "Load older messages"}
          </button>
        ) : (
          <span className="text-xs text-neutral-500">Start of the conversation</span>
        )}
      </li>
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const mine = message.sender_id === currentUserId;
        const date = new Date(message.created_at);
        const newDay = !previous || new Date(previous.created_at).toDateString() !== date.toDateString();
        const newSender = newDay || previous?.sender_id !== message.sender_id;

        return (
          <li key={message.id} className="flex flex-col">
            {newDay && (
              <p className="my-3 text-center text-xs text-neutral-500" suppressHydrationWarning>
                {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
            {showSenderNames && !mine && newSender && (
              <p className="mt-2 px-1 text-xs font-medium text-neutral-500">
                {members[message.sender_id]?.display_name ?? "Former member"}
              </p>
            )}
            <div
              className={`flex max-w-[80%] flex-col gap-0.5 rounded-2xl px-3 py-2 ${
                mine
                  ? "self-end bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "self-start bg-neutral-100 dark:bg-neutral-800"
              } ${newSender ? "mt-1" : ""} ${message.status === "sending" ? "opacity-60" : ""}`}
            >
              {message.attachment_name && message.attachment_type && (
                <MessageAttachment
                  path={message.attachment_path}
                  name={message.attachment_name}
                  type={message.attachment_type}
                  size={message.attachment_size ?? 0}
                  localFile={message.localFile}
                  mine={mine}
                />
              )}
              {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
              <time
                dateTime={message.created_at}
                suppressHydrationWarning
                className={`self-end text-[10px] ${mine ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-500"}`}
              >
                {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                {message.edited_at && " · edited"}
                {message.status === "sending" && " · Sending…"}
              </time>
              {message.status === "failed" && (
                <span role="alert" className="self-end text-[10px] font-medium text-red-400">
                  Not sent
                </span>
              )}
            </div>
          </li>
        );
      })}
      <li ref={endRef} aria-hidden="true" />
    </ol>
  );
}
