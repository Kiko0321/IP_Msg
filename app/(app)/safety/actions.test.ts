// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type FakeSupabase } from "@/lib/test-utils/server-mocks";
import { blockUser, reportUser, unblockUser } from "./actions";

// MSG-43: blocking and reporting.

let supabase: FakeSupabase;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ME = "11111111-1111-4111-8111-111111111111";
const BOB = "33333333-3333-4333-8333-333333333333";
const MSG = "66666666-6666-4666-8666-666666666666";

beforeEach(() => {
  supabase = fakeSupabase({ userId: ME });
});

describe("blockUser / unblockUser", () => {
  it("blocks as the caller, once", async () => {
    expect(await blockUser(BOB)).toEqual({});
    expect(supabase.from).toHaveBeenCalledWith("blocks");
    expect(supabase.query.upsert).toHaveBeenCalledWith(
      { blocker_id: ME, blocked_id: BOB },
      { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
    );
  });

  it("refuses to block yourself or a malformed id", async () => {
    expect(await blockUser(ME)).toEqual({ error: "You can't block yourself." });
    expect(await blockUser("x")).toEqual({ error: "Unknown user." });
    expect(supabase.query.upsert).not.toHaveBeenCalled();
  });

  it("unblocks only the caller's own block", async () => {
    expect(await unblockUser(BOB)).toEqual({});
    expect(supabase.query.delete).toHaveBeenCalled();
    expect(supabase.query.eq).toHaveBeenCalledWith("blocker_id", ME);
    expect(supabase.query.eq).toHaveBeenCalledWith("blocked_id", BOB);
  });

  it("needs a signed-in user", async () => {
    supabase = fakeSupabase({ signedIn: false });
    expect((await blockUser(BOB)).error).toMatch(/signed out/);
  });
});

describe("reportUser", () => {
  it("needs a reason", async () => {
    // @ts-expect-error -- testing a missing reason from a hand-made request
    expect((await reportUser({ userId: BOB, details: "" })).error).toBe("Choose a reason.");
  });

  it("files a report about a person", async () => {
    const result = await reportUser({ userId: BOB, reason: "spam", details: "  ads all day " });
    expect(result.message).toMatch(/report was sent/);
    expect(supabase.query.insert).toHaveBeenCalledWith({
      reporter_id: ME,
      reported_user_id: BOB,
      message_id: null,
      reason: "spam",
      details: "ads all day",
      message_excerpt: null,
    });
  });

  it("keeps a copy of a reported message's text", async () => {
    supabase = fakeSupabase({ userId: ME, results: [{ data: { content: "rude words", attachment_name: null }, error: null }] });
    await reportUser({ userId: BOB, messageId: MSG, reason: "harassment", details: "" });
    expect(supabase.query.eq).toHaveBeenCalledWith("sender_id", BOB);
    expect(supabase.query.insert).toHaveBeenCalledWith(
      expect.objectContaining({ message_id: MSG, message_excerpt: "rude words", details: null }),
    );
  });

  it("refuses a message the reporter can't see or that isn't from that person", async () => {
    supabase = fakeSupabase({ userId: ME, results: [{ data: null, error: null }] });
    expect(await reportUser({ userId: BOB, messageId: MSG, reason: "spam", details: "" })).toEqual({
      error: "That message can't be reported.",
    });
    expect(supabase.query.insert).not.toHaveBeenCalled();
  });

  it("refuses reporting yourself", async () => {
    expect((await reportUser({ userId: ME, reason: "other", details: "" })).error).toBe("You can't report yourself.");
  });
});
