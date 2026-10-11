// MSG-41: message search helpers, kept free of Supabase so they can be unit-tested.

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;

/** The search term as typed, trimmed and capped; empty when too short to search. */
export function searchTerm(raw: string | undefined) {
  const term = (raw ?? "").trim().slice(0, SEARCH_MAX);
  return term.length >= SEARCH_MIN ? term : "";
}

/**
 * A PostgREST `or` filter matching the term in the text or the file name, case-insensitively.
 * The value is double-quoted (so commas and brackets in the term are literal) with LIKE wildcards
 * and quotes escaped.
 */
export function messageSearchFilter(term: string) {
  const like = term.replace(/[\\%_]/g, (c) => `\\${c}`);
  const quoted = `"%${like.replace(/["\\]/g, (c) => `\\${c}`)}%"`;
  return `content.ilike.${quoted},attachment_name.ilike.${quoted}`;
}

/** A short excerpt around the first match, split so the match can be highlighted. */
export function snippet(text: string, term: string, radius = 60) {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0) return { before: flat.slice(0, radius * 2), match: "", after: "" };
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + term.length + radius);
  return {
    before: (start > 0 ? "…" : "") + flat.slice(start, at),
    match: flat.slice(at, at + term.length),
    after: flat.slice(at + term.length, end) + (end < flat.length ? "…" : ""),
  };
}
