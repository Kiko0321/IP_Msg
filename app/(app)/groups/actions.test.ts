// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, run, type FakeSupabase } from "@/lib/test-utils/server-mocks";
import { createGroup } from "./actions";

// MSG-37: creating a group chat with the MSG-12 policies (conversation, then owner, then members).

let supabase: FakeSupabase;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
vi.mock("next/navigation", async () => (await import("@/lib/test-utils/server-mocks")).navigationMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ME = "11111111-1111-4111-8111-111111111111";
const BOB = "33333333-3333-4333-8333-333333333333";
const CAROL = "44444444-4444-4444-8444-444444444444";
const GROUP = "55555555-5555-4555-8555-555555555555";

function groupForm(title: string, memberIds: string[]) {
  const data = new FormData();
  data.set("title", title);
  for (const id of memberIds) data.append("memberIds", id);
  return data;
}

// Results of the four queries, in order: profile check, conversation, owner row, member rows.
function happyPath(overrides: { members?: { message: string } } = {}) {
  return fakeSupabase({
    userId: ME,
    results: [
      { data: [{ id: BOB }, { id: CAROL }], error: null },
      { data: { id: GROUP }, error: null },
      { data: null, error: null },
      { data: null, error: overrides.members ?? null },
    ],
  });
}

beforeEach(() => {
  supabase = happyPath();
});

describe("createGroup", () => {
  it("needs a name and at least one person", async () => {
    const { result } = await run(() => createGroup({}, groupForm("  ", [])));
    expect(result?.fieldErrors?.title).toEqual(["Name the group."]);
    expect(result?.fieldErrors?.memberIds).toEqual(["Choose at least one person."]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("rejects ids that aren't users", async () => {
    const { result } = await run(() => createGroup({}, groupForm("Team", ["not-a-uuid"])));
    expect(result?.fieldErrors?.memberIds).toBeTruthy();
  });

  it("doesn't count the creator as one of the people to add", async () => {
    const { result } = await run(() => createGroup({}, groupForm("Team", [ME])));
    expect(result?.fieldErrors?.memberIds).toEqual(["Choose at least one person."]);
  });

  it("creates the group, makes the creator owner, adds the others and opens it", async () => {
    const { redirect } = await run(() => createGroup({}, groupForm(" Team ", [BOB, CAROL, BOB])));

    expect(redirect).toBe(`/chat/${GROUP}`);
    const inserts = supabase.query.insert as ReturnType<typeof vi.fn>;
    expect(inserts.mock.calls).toEqual([
      [{ kind: "group", title: "Team", created_by: ME }],
      [{ conversation_id: GROUP, user_id: ME, role: "owner" }],
      [
        [
          { conversation_id: GROUP, user_id: BOB, role: "member" },
          { conversation_id: GROUP, user_id: CAROL, role: "member" },
        ],
      ],
    ]);
  });

  it("creates nothing if someone chosen no longer exists", async () => {
    supabase = fakeSupabase({ userId: ME, results: [{ data: [{ id: BOB }], error: null }] });
    const { result } = await run(() => createGroup({}, groupForm("Team", [BOB, CAROL])));
    expect(result?.error).toMatch(/no longer available/);
    expect(supabase.query.insert).not.toHaveBeenCalled();
  });

  it("still opens the group, with a notice, if adding people fails", async () => {
    supabase = happyPath({ members: { message: "insert failed" } });
    const { redirect } = await run(() => createGroup({}, groupForm("Team", [BOB, CAROL])));
    expect(redirect).toBe(`/chat/${GROUP}?notice=members-failed`);
  });

  it("sends a signed-out user to sign in", async () => {
    supabase = fakeSupabase({ signedIn: false });
    expect((await run(() => createGroup({}, groupForm("Team", [BOB])))).redirect).toBe("/sign-in");
  });
});
