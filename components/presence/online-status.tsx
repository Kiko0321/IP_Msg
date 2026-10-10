"use client";

import { useEffect, useState } from "react";
import { useOnlineUsers } from "./presence-provider";

function lastSeenLabel(lastSeenAt: string, now: number) {
  const minutes = Math.floor((now - new Date(lastSeenAt).getTime()) / 60_000);
  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours} h ago`;
  return `Last seen ${new Date(lastSeenAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

// "Online" from live presence, otherwise "Last seen …" from the stored timestamp.
export function OnlineStatus({ userId, lastSeenAt }: { userId: string; lastSeenAt: string | null }) {
  const online = useOnlineUsers().has(userId);
  const [now, setNow] = useState(() => Date.now());

  // Keep the relative time fresh.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (online) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
        <span aria-hidden="true" className="size-2 rounded-full bg-green-500" />
        Online
      </span>
    );
  }
  return <span suppressHydrationWarning>{lastSeenAt ? lastSeenLabel(lastSeenAt, now) : "Offline"}</span>;
}

// Small dot for lists (contacts). Renders nothing when offline.
export function OnlineDot({ userId }: { userId: string }) {
  const online = useOnlineUsers().has(userId);
  if (!online) return null;
  return (
    <span
      role="img"
      aria-label="Online"
      className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-background bg-green-500"
    />
  );
}
