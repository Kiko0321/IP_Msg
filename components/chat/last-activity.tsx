"use client";

// Formatted in the browser so the viewer's time zone is used.
export function LastActivity({ at }: { at: string | null }) {
  if (!at) return null;

  const date = new Date(at);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const label = sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <time dateTime={at} suppressHydrationWarning className="shrink-0 text-xs text-neutral-500">
      {label}
    </time>
  );
}
