// MSG-42: read receipts and typing indicators, as plain functions for unit tests.

/** Members (other than me) who have read up to this message, from conversation_members.last_read_at. */
export function seenBy(createdAt: string, readAt: Record<string, string | null>, me: string) {
  const at = Date.parse(createdAt);
  return Object.entries(readAt)
    .filter(([user, read]) => user !== me && read !== null && Date.parse(read) >= at)
    .map(([user]) => user);
}

/** "Seen" (direct chat), or "Seen by …" / "Seen by everyone" (group); empty when nobody has. */
export function receiptLabel(seen: string[], names: Record<string, string>, isGroup: boolean, othersCount: number) {
  if (seen.length === 0) return "";
  if (!isGroup) return "Seen";
  if (seen.length >= othersCount) return "Seen by everyone";
  const shown = seen.slice(0, 3).map((id) => names[id] ?? "someone");
  const more = seen.length - shown.length;
  return `Seen by ${shown.join(", ")}${more > 0 ? ` +${more}` : ""}`;
}

/** "Alice is typing…", "Alice and Bob are typing…", or "Several people are typing…". */
export function typingLabel(names: string[]) {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return "Several people are typing…";
}

/** How long a "typing" ping counts, and how often the typist re-sends it. */
export const TYPING_TTL_MS = 4000;
export const TYPING_RESEND_MS = 2000;
