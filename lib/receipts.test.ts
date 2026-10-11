// @vitest-environment node
import { describe, expect, it } from "vitest";
import { receiptLabel, seenBy, typingLabel } from "./receipts";

// MSG-42: read receipts and typing labels.

const sentAt = "2026-10-12T10:00:00.000Z";

describe("seenBy", () => {
  it("lists other members who read at or after the message", () => {
    const readAt = { me: "2026-10-12T11:00:00Z", alice: "2026-10-12T10:00:00Z", bob: "2026-10-12T09:59:59Z", carol: null };
    expect(seenBy(sentAt, readAt, "me")).toEqual(["alice"]);
  });
});

describe("receiptLabel", () => {
  const names = { alice: "Alice", bob: "Bob", carol: "Carol", dave: "Dave", erin: "Erin" };

  it("is empty until someone has seen it", () => {
    expect(receiptLabel([], names, false, 1)).toBe("");
  });

  it("says Seen in a direct chat", () => {
    expect(receiptLabel(["alice"], names, false, 1)).toBe("Seen");
  });

  it("names readers in a group, or says everyone", () => {
    expect(receiptLabel(["alice", "bob"], names, true, 5)).toBe("Seen by Alice, Bob");
    expect(receiptLabel(["alice", "bob", "carol", "dave"], names, true, 5)).toBe("Seen by Alice, Bob, Carol +1");
    expect(receiptLabel(["alice", "bob"], names, true, 2)).toBe("Seen by everyone");
  });
});

describe("typingLabel", () => {
  it("reads naturally for one, two or more people", () => {
    expect(typingLabel([])).toBe("");
    expect(typingLabel(["Alice"])).toBe("Alice is typing…");
    expect(typingLabel(["Alice", "Bob"])).toBe("Alice and Bob are typing…");
    expect(typingLabel(["A", "B", "C"])).toBe("Several people are typing…");
  });
});
