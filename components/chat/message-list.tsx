"use client";

import { useEffect, useRef } from "react";
import type { ChatMember, ChatMessage } from "@/lib/chat/types";

// Client component: times render in the viewer's time zone, and MSG-18 adds live updates here.
export function MessageList({
  messages,
  members,
  currentUserId,
  showSenderNames,
}: {
  messages: ChatMessage[];
  members: Record<string, ChatMember>;
  currentUserId: string;
  showSenderNames: boolean;
}) {
  const endRef = useRef<HTMLLIElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-neutral-500">
        No messages yet. Say hello!
      </div>
    );
  }

  return (
    <ol className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-4" aria-label="Messages">
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
              } ${newSender ? "mt-1" : ""}`}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <time
                dateTime={message.created_at}
                suppressHydrationWarning
                className={`self-end text-[10px] ${mine ? "text-neutral-300 dark:text-neutral-600" : "text-neutral-500"}`}
              >
                {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                {message.edited_at && " · edited"}
              </time>
            </div>
          </li>
        );
      })}
      <li ref={endRef} aria-hidden="true" />
    </ol>
  );
}
