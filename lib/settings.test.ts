import { describe, expect, it, vi } from "vitest";
import { getUserSettings } from "./settings";
import { DEFAULT_SETTINGS } from "./validation/settings";

// Minimal stand-in for the Supabase query builder used by getUserSettings.
function fakeClient(row: Record<string, unknown> | null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  const client = { from: vi.fn(() => query) };
  return { client: client as unknown as Parameters<typeof getUserSettings>[0], query, from: client.from };
}

describe("getUserSettings", () => {
  it("returns defaults when the user has never saved settings", async () => {
    const { client } = fakeClient(null);
    expect(await getUserSettings(client, "user-1")).toEqual(DEFAULT_SETTINGS);
  });

  it("maps the stored row and queries only that user's settings", async () => {
    const { client, query, from } = fakeClient({ theme: "dark", notify_new_messages: false, notify_sound: true });

    expect(await getUserSettings(client, "user-1")).toEqual({
      theme: "dark",
      notifyNewMessages: false,
      notifySound: true,
    });
    expect(from).toHaveBeenCalledWith("user_settings");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
