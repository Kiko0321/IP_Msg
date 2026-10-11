// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, formData, run, type FakeSupabase } from "@/lib/test-utils/server-mocks";
import { deleteAccount } from "./account-actions";

// MSG-44: deleting your own account.

let supabase: FakeSupabase;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
vi.mock("next/navigation", async () => (await import("@/lib/test-utils/server-mocks")).navigationMock);

const ME = "11111111-1111-4111-8111-111111111111";

function signedInAs(results = [{ data: [{ attachment_path: "c1/a.png" }, { attachment_path: "c2/b.pdf" }], error: null }]) {
  const client = fakeSupabase({ userId: ME, results });
  client.auth.getClaims.mockResolvedValue({ data: { claims: { sub: ME, email: "me@example.test" } }, error: null } as never);
  return client;
}

beforeEach(() => {
  supabase = signedInAs();
});

const confirmed = (password = "secret-pass") => formData({ confirm: "DELETE", password });

describe("deleteAccount", () => {
  it("requires typing DELETE", async () => {
    const { result } = await run(() => deleteAccount({}, formData({ confirm: "delete", password: "x" })));
    expect(result?.error).toBe("Type DELETE to confirm.");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("requires the right password", async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } });
    const { result } = await run(() => deleteAccount({}, confirmed("wrong")));
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: "me@example.test", password: "wrong" });
    expect(result?.error).toBe("That password isn't right.");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("removes the user's files, deletes the account and signs out", async () => {
    supabase.bucket.list.mockResolvedValueOnce({ data: [{ name: "avatar.png" }], error: null });

    const { redirect } = await run(() => deleteAccount({}, confirmed()));

    expect(supabase.bucket.remove).toHaveBeenCalledWith([`${ME}/avatar.png`]);
    expect(supabase.bucket.remove).toHaveBeenCalledWith(["c1/a.png", "c2/b.pdf"]);
    expect(supabase.rpc).toHaveBeenCalledWith("delete_my_account");
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(redirect).toBe("/sign-in?notice=account-deleted");
  });

  it("keeps the user signed in if the deletion fails", async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const { result } = await run(() => deleteAccount({}, confirmed()));
    expect(result?.error).toMatch(/Couldn't delete/);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });
});
