// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, formData, run, type FakeSupabase } from "@/lib/test-utils/server-mocks";
import { sendMessage } from "./chat/[id]/actions";
import { startConversation } from "./contacts/actions";
import { removeAvatar, setAvatar, updateProfile } from "./profile/actions";
import { updateSettings } from "./settings/actions";

// Regression tests for the signed-in Server Actions: messages (MSG-17), contacts (MSG-14),
// profile and avatar (MSG-08/09) and settings (MSG-21/22). Supabase is faked; RLS itself is
// covered by supabase/checks (npm run db:check).

let supabase: FakeSupabase;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
vi.mock("next/navigation", async () => (await import("@/lib/test-utils/server-mocks")).navigationMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ME = "11111111-1111-4111-8111-111111111111";
const CHAT = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  supabase = fakeSupabase({ userId: ME });
});

describe("sendMessage", () => {
  it("rejects an unknown conversation id without touching the database", async () => {
    expect(await sendMessage("not-a-uuid", "hi")).toEqual({ error: "Unknown conversation." });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("rejects blank messages", async () => {
    expect((await sendMessage(CHAT, "   ")).error).toBeTruthy();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("asks a signed-out user to sign in", async () => {
    supabase = fakeSupabase({ signedIn: false });
    expect((await sendMessage(CHAT, "hi")).error).toMatch(/signed out/);
  });

  it("stores the trimmed message as the caller", async () => {
    const saved = { id: "m1", sender_id: ME, content: "hi", created_at: "2026-10-11T00:00:00Z", edited_at: null };
    supabase = fakeSupabase({ userId: ME, queryResult: { data: saved, error: null } });

    expect(await sendMessage(CHAT, "  hi  ")).toEqual({ message: saved });
    expect(supabase.from).toHaveBeenCalledWith("messages");
    expect(supabase.query.insert).toHaveBeenCalledWith({ conversation_id: CHAT, sender_id: ME, content: "hi" });
  });

  it("explains a rejected insert (e.g. no longer a member)", async () => {
    supabase = fakeSupabase({ queryResult: { data: null, error: { message: "row-level security" } } });
    expect((await sendMessage(CHAT, "hi")).error).toMatch(/no longer be in this conversation/);
  });
});

describe("startConversation", () => {
  it("ignores an invalid user id", async () => {
    expect((await run(() => startConversation(formData({ userId: "x" })))).redirect).toBe("/contacts");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("opens the direct chat", async () => {
    supabase.rpc.mockResolvedValueOnce({ data: CHAT, error: null });
    expect((await run(() => startConversation(formData({ userId: OTHER })))).redirect).toBe(`/chat/${CHAT}`);
    expect(supabase.rpc).toHaveBeenCalledWith("start_direct_conversation", { other_user: OTHER });
  });

  it("shows the error on the contacts page", async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "Blocked" } });
    expect((await run(() => startConversation(formData({ userId: OTHER })))).redirect).toBe("/contacts?error=Blocked");
  });
});

describe("updateProfile", () => {
  it("returns field errors for an empty display name", async () => {
    const { result } = await run(() => updateProfile({}, formData({ displayName: " ", statusMessage: "" })));
    expect(result?.fieldErrors?.displayName).toBeTruthy();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("updates only the caller's row", async () => {
    supabase = fakeSupabase({ userId: ME, queryResult: { data: [{ id: ME }], error: null } });
    const { result } = await run(() => updateProfile({}, formData({ displayName: " Alice ", statusMessage: "" })));

    expect(result?.message).toBe("Profile saved.");
    expect(supabase.query.update).toHaveBeenCalledWith({ display_name: "Alice", status_message: null });
    expect(supabase.query.eq).toHaveBeenCalledWith("id", ME);
  });

  it("sends a signed-out user to sign in", async () => {
    supabase = fakeSupabase({ signedIn: false });
    const { redirect } = await run(() => updateProfile({}, formData({ displayName: "Alice", statusMessage: "" })));
    expect(redirect).toBe("/sign-in");
  });
});

describe("avatar", () => {
  it.each([`${OTHER}/avatar.png`, `${ME}/../x.png`, `${ME}/avatar.exe`, `${ME}/a/b.png`])(
    "refuses a path outside the caller's folder or of the wrong type (%s)",
    async (path) => {
      expect(await setAvatar(path)).toEqual({ error: "Invalid avatar file." });
      expect(supabase.from).not.toHaveBeenCalled();
    },
  );

  it("saves the public URL and deletes older uploads", async () => {
    supabase.bucket.list.mockResolvedValueOnce({ data: [{ name: "old.png" }, { name: "new.png" }], error: null });
    expect(await setAvatar(`${ME}/new.png`)).toEqual({});
    expect(supabase.query.update).toHaveBeenCalledWith({ avatar_url: `https://cdn.example/${ME}/new.png` });
    expect(supabase.bucket.remove).toHaveBeenCalledWith([`${ME}/old.png`]);
  });

  it("removes the picture and every upload", async () => {
    supabase.bucket.list.mockResolvedValueOnce({ data: [{ name: "a.png" }], error: null });
    expect(await removeAvatar()).toEqual({});
    expect(supabase.query.update).toHaveBeenCalledWith({ avatar_url: null });
    expect(supabase.bucket.remove).toHaveBeenCalledWith([`${ME}/a.png`]);
  });
});

describe("updateSettings", () => {
  it("rejects an unknown theme", async () => {
    const { result } = await run(() => updateSettings({}, formData({ theme: "neon" })));
    expect(result?.fieldErrors?.theme).toBeTruthy();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("creates or updates the caller's settings row", async () => {
    const { result } = await run(() => updateSettings({}, formData({ theme: "dark", notifyNewMessages: "on" })));
    expect(result?.message).toBe("Settings saved.");
    expect(supabase.query.upsert).toHaveBeenCalledWith(
      { user_id: ME, theme: "dark", notify_new_messages: true, notify_sound: false },
      { onConflict: "user_id" },
    );
  });
});
