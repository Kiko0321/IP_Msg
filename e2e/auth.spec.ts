import { expect, test } from "@playwright/test";

// Regression tests for the signed-out side of the app (MSG-06, MSG-31) against the real Supabase
// project. They never create accounts or send emails: every input is rejected before that point.

test("visitors see the landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "IP Messenger" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("every signed-in page sends visitors to sign in", async ({ page }) => {
  const pages = ["/chats", "/contacts", "/profile", "/settings", "/network", "/chat/00000000-0000-4000-8000-000000000000"];
  for (const path of pages) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/sign-in$/);
  }
});

test("the app can reach Supabase", async ({ request }) => {
  const response = await request.get("/api/health/supabase");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ ok: true, signedIn: false });
});

test("sign-in shows Supabase's error for wrong credentials", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /invalid/i })).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign-up refuses a blank display name", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill("   ");
  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByLabel("Password").fill("long-enough-password");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter a display name." })).toBeVisible();
});

test("the reset form refuses an incomplete email", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("someone@localhost"); // passes the browser's check, not ours
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter a valid email address." })).toBeVisible();
});

test("an email link can't redirect to another site", async ({ page }) => {
  // No valid code, so it fails, but it must still land on this site.
  await page.goto("/auth/confirm?code=invalid&next=/%5Cevil.example");
  await expect(page).toHaveURL(/\/sign-in\?notice=confirm-failed$/);
});
