// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type FakeSupabase } from "@/lib/test-utils/server-mocks";
import { GET } from "./route";

// Regression tests for the email-link callback: sign-up confirmation (MSG-06), password reset
// (MSG-31), and the guard that keeps ?next= from redirecting to another site.

let supabase: FakeSupabase;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));

beforeEach(() => {
  supabase = fakeSupabase();
});

async function landOn(query: string) {
  const response = await GET(new NextRequest(`http://app.test/auth/confirm?${query}`));
  expect(response.status).toBe(307);
  const location = new URL(response.headers.get("location")!);
  return { origin: location.origin, path: location.pathname + location.search };
}

describe("GET /auth/confirm", () => {
  it("confirms a sign-up link (PKCE code) and goes home", async () => {
    expect(await landOn("code=abc")).toEqual({ origin: "http://app.test", path: "/" });
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("confirms a token-hash link", async () => {
    expect((await landOn("token_hash=xyz&type=signup")).path).toBe("/");
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "xyz", type: "signup" });
  });

  it("sends a failed confirmation back to sign-in with a notice", async () => {
    supabase.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: { message: "expired" } });
    expect((await landOn("code=old")).path).toBe("/sign-in?notice=confirm-failed");
  });

  it("fails without any token", async () => {
    expect((await landOn("")).path).toBe("/sign-in?notice=confirm-failed");
  });

  it("opens the new-password page after a reset link (either link style)", async () => {
    expect((await landOn("code=abc&next=/reset-password")).path).toBe("/reset-password");
    expect((await landOn("token_hash=xyz&type=recovery")).path).toBe("/reset-password");
  });

  it("sends an expired reset link back to the reset form", async () => {
    supabase.auth.verifyOtp.mockResolvedValueOnce({ error: { message: "expired" } });
    expect((await landOn("token_hash=old&type=recovery")).path).toBe("/forgot-password?notice=link-expired");
  });

  it("follows a same-site ?next= path", async () => {
    expect((await landOn("code=abc&next=/settings")).path).toBe("/settings");
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example", "evil.example"])(
    "never redirects to another site (next=%s)",
    async (next) => {
      expect(await landOn(`code=abc&next=${encodeURIComponent(next)}`)).toEqual({
        origin: "http://app.test",
        path: "/",
      });
    },
  );
});
