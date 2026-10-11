// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, formData, run, type FakeSupabase } from "@/lib/test-utils/server-mocks";
import { requestPasswordReset, signIn, signUp, updatePassword } from "./actions";

// Regression tests for sign-in, sign-up (MSG-06) and password reset (MSG-31).

let supabase: FakeSupabase;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
vi.mock("next/navigation", async () => (await import("@/lib/test-utils/server-mocks")).navigationMock);
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: "http://app.test" }) }));

beforeEach(() => {
  supabase = fakeSupabase();
});

const valid = { email: "  Alice@Example.TEST ", password: "correct-horse" };

describe("signIn", () => {
  it("rejects an invalid email without calling Supabase", async () => {
    const { result } = await run(() => signIn({}, formData({ email: "nope", password: "correct-horse" })));
    expect(result?.error).toBe("Enter a valid email address.");
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const { result } = await run(() => signIn({}, formData({ email: "a@b.co", password: "short" })));
    expect(result?.error).toMatch(/at least 8/);
  });

  it("normalises the email, signs in and goes home", async () => {
    const { redirect } = await run(() => signIn({}, formData(valid)));
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "alice@example.test",
      password: "correct-horse",
    });
    expect(redirect).toBe("/");
  });

  it("shows Supabase's error and keeps the email", async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } });
    const { result } = await run(() => signIn({}, formData(valid)));
    expect(result).toEqual({ email: "alice@example.test", error: "Invalid login credentials" });
  });
});

describe("signUp", () => {
  it("requires a display name", async () => {
    const { result } = await run(() => signUp({}, formData({ ...valid, displayName: "   " })));
    expect(result?.error).toBe("Enter a display name.");
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("sends the confirmation link back to this app", async () => {
    supabase.auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    const { result } = await run(() => signUp({}, formData({ ...valid, displayName: " Alice " })));

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "alice@example.test",
      password: "correct-horse",
      options: { data: { display_name: "Alice" }, emailRedirectTo: "http://app.test/auth/confirm" },
    });
    expect(result?.message).toMatch(/confirmation link/);
  });

  it("goes home straight away when email confirmation is off", async () => {
    const { redirect } = await run(() => signUp({}, formData({ ...valid, displayName: "Alice" })));
    expect(redirect).toBe("/");
  });
});

describe("requestPasswordReset (MSG-31)", () => {
  it("rejects an invalid email", async () => {
    const { result } = await run(() => requestPasswordReset({}, formData({ email: "not-an-email" })));
    expect(result?.error).toBe("Enter a valid email address.");
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("links to the reset page through /auth/confirm", async () => {
    await run(() => requestPasswordReset({}, formData({ email: "alice@example.test" })));
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("alice@example.test", {
      redirectTo: "http://app.test/auth/confirm?next=/reset-password",
    });
  });

  it("gives the same answer whether or not the account exists", async () => {
    const { result } = await run(() => requestPasswordReset({}, formData({ email: "nobody@example.test" })));
    expect(result?.error).toBeUndefined();
    expect(result?.message).toBe(
      "If nobody@example.test has an account, we've sent it a link to reset your password.",
    );
  });
});

describe("updatePassword (MSG-31)", () => {
  const passwords = (password: string, confirmPassword = password) => formData({ password, confirmPassword });

  it("rejects a short password", async () => {
    const { result } = await run(() => updatePassword({}, passwords("short")));
    expect(result?.error).toMatch(/at least 8/);
  });

  it("rejects passwords that don't match", async () => {
    const { result } = await run(() => updatePassword({}, passwords("new-password-1", "new-password-2")));
    expect(result?.error).toBe("Passwords don't match.");
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("refuses without the session from a reset link", async () => {
    supabase = fakeSupabase({ signedIn: false });
    const { result } = await run(() => updatePassword({}, passwords("new-password-1")));
    expect(result?.error).toMatch(/expired/);
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("saves the new password and goes home", async () => {
    const { redirect } = await run(() => updatePassword({}, passwords("new-password-1")));
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "new-password-1" });
    expect(redirect).toBe("/");
  });
});
