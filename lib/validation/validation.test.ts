import { describe, expect, it } from "vitest";
import { messageSchema, MESSAGE_MAX } from "./message";
import { DISPLAY_NAME_MAX, profileSchema, STATUS_MESSAGE_MAX } from "./profile";
import { DEFAULT_SETTINGS, settingsFromFormData, settingsSchema } from "./settings";

describe("profileSchema", () => {
  it("trims and accepts a valid profile", () => {
    const result = profileSchema.safeParse({ displayName: "  Alice  ", statusMessage: "  Hi  " });
    expect(result.success && result.data).toEqual({ displayName: "Alice", statusMessage: "Hi" });
  });

  it("requires a display name that isn't only spaces", () => {
    const result = profileSchema.safeParse({ displayName: "   ", statusMessage: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a display name.");
  });

  it("enforces the database length limits", () => {
    expect(profileSchema.safeParse({ displayName: "a".repeat(DISPLAY_NAME_MAX), statusMessage: "" }).success).toBe(true);
    expect(profileSchema.safeParse({ displayName: "a".repeat(DISPLAY_NAME_MAX + 1), statusMessage: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: "A", statusMessage: "s".repeat(STATUS_MESSAGE_MAX + 1) }).success).toBe(false);
  });

  it("allows an empty status", () => {
    expect(profileSchema.safeParse({ displayName: "A", statusMessage: "" }).success).toBe(true);
  });
});

describe("messageSchema", () => {
  it("trims messages", () => {
    expect(messageSchema.parse("  hello \n")).toBe("hello");
  });

  it("rejects blank messages", () => {
    const result = messageSchema.safeParse(" \n\t ");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Type a message.");
  });

  it("allows exactly the maximum length and rejects one more", () => {
    expect(messageSchema.safeParse("m".repeat(MESSAGE_MAX)).success).toBe(true);
    expect(messageSchema.safeParse("m".repeat(MESSAGE_MAX + 1)).success).toBe(false);
  });
});

describe("settings", () => {
  function form(entries: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.set(key, value);
    return data;
  }

  it("reads checked and unchecked boxes from form data", () => {
    expect(settingsFromFormData(form({ theme: "dark", notifyNewMessages: "on" }))).toEqual({
      theme: "dark",
      notifyNewMessages: true,
      notifySound: false,
    });
  });

  it("accepts every supported theme and rejects others", () => {
    for (const theme of ["system", "light", "dark"]) {
      expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, theme }).success).toBe(true);
    }
    const result = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, theme: "pink" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Choose a theme.");
  });

  it("has defaults that pass validation", () => {
    expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });
});
