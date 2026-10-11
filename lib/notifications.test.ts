// @vitest-environment node
import { describe, expect, it } from "vitest";
import { alertsFor, isViewing, notificationText } from "./notifications";

// MSG-36: when a new message alerts the user, and what the notification says.

const ME = "me";
const message = { conversation_id: "c1", sender_id: "alice", content: "Hello there" };
const away = { pathname: "/chats", attentive: true };
const allOn = { notifyNewMessages: true, notifySound: true, permission: "granted" as const };

describe("isViewing", () => {
  it("is true only for the open chat in a focused, visible window", () => {
    expect(isViewing(message, { pathname: "/chat/c1", attentive: true })).toBe(true);
    expect(isViewing(message, { pathname: "/chat/c1", attentive: false })).toBe(false);
    expect(isViewing(message, { pathname: "/chat/c2", attentive: true })).toBe(false);
  });
});

describe("alertsFor", () => {
  it("alerts for a message in another chat", () => {
    expect(alertsFor(message, ME, away, allOn)).toEqual({ notify: true, sound: true });
  });

  it("alerts when the open chat is in a background tab or window", () => {
    expect(alertsFor(message, ME, { pathname: "/chat/c1", attentive: false }, allOn)).toEqual({
      notify: true,
      sound: true,
    });
  });

  it("stays quiet in the chat the user is looking at", () => {
    expect(alertsFor(message, ME, { pathname: "/chat/c1", attentive: true }, allOn)).toEqual({
      notify: false,
      sound: false,
    });
  });

  it("never alerts for the user's own messages (e.g. sent from another device)", () => {
    expect(alertsFor({ ...message, sender_id: ME }, ME, away, allOn)).toEqual({ notify: false, sound: false });
  });

  it("follows each setting separately", () => {
    expect(alertsFor(message, ME, away, { ...allOn, notifyNewMessages: false })).toEqual({ notify: false, sound: true });
    expect(alertsFor(message, ME, away, { ...allOn, notifySound: false })).toEqual({ notify: true, sound: false });
  });

  it("only shows notifications the browser allows", () => {
    for (const permission of ["default", "denied", "unsupported"] as const) {
      expect(alertsFor(message, ME, away, { ...allOn, permission }).notify).toBe(false);
    }
  });
});

describe("notificationText", () => {
  it("uses the sender's name for direct chats", () => {
    expect(notificationText(message, "Alice", { kind: "direct", title: null })).toEqual({
      title: "Alice",
      body: "Hello there",
    });
  });

  it("names the group", () => {
    expect(notificationText(message, "Alice", { kind: "group", title: "Team" }).title).toBe("Alice in Team");
    expect(notificationText(message, "Alice", { kind: "group", title: null }).title).toBe("Alice in a group");
  });

  it("puts long or multi-line messages on one short line", () => {
    const { body } = notificationText({ ...message, content: `line one\n\nline two ${"x".repeat(200)}` }, "A", null);
    expect(body.startsWith("line one line two")).toBe(true);
    expect(body.length).toBe(120);
    expect(body.endsWith("…")).toBe(true);
  });

  it("names the file when a message has no text (MSG-39)", () => {
    expect(notificationText({ ...message, content: "", attachment_name: "plan.pdf" }, "A", null).body).toBe("📎 plan.pdf");
  });
});
