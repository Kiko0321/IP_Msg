// @vitest-environment node
import { describe, expect, it } from "vitest";
import { messageSearchFilter, searchTerm, snippet } from "./search";

// MSG-41: message search helpers.

describe("searchTerm", () => {
  it("trims, and ignores terms shorter than 2 characters", () => {
    expect(searchTerm("  hi ")).toBe("hi");
    expect(searchTerm("a")).toBe("");
    expect(searchTerm(undefined)).toBe("");
    expect(searchTerm("x".repeat(500))).toHaveLength(100);
  });
});

describe("messageSearchFilter", () => {
  it("searches text and file names, case-insensitively", () => {
    expect(messageSearchFilter("plan")).toBe('content.ilike."%plan%",attachment_name.ilike."%plan%"');
  });

  it("treats wildcards, commas, brackets and quotes literally", () => {
    // Checked against the real PostgREST API: these parse, while unquoted ones fail with 400.
    expect(messageSearchFilter('50%_a,b"(c)')).toBe(
      'content.ilike."%50\\\\%\\\\_a,b\\"(c)%",attachment_name.ilike."%50\\\\%\\\\_a,b\\"(c)%"',
    );
  });
});

describe("snippet", () => {
  it("splits around the first match, keeping its original case", () => {
    expect(snippet("See the Plan today", "plan")).toEqual({ before: "See the ", match: "Plan", after: " today" });
  });

  it("shortens long text around the match", () => {
    const { before, match, after } = snippet(`${"a ".repeat(100)}needle${" b".repeat(100)}`, "needle", 10);
    expect(before.startsWith("…")).toBe(true);
    expect(match).toBe("needle");
    expect(after.endsWith("…")).toBe(true);
  });

  it("falls back to the start when the match is only in the file name", () => {
    expect(snippet("📎 report.pdf", "zzz").before).toBe("📎 report.pdf");
  });
});
