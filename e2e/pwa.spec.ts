import { expect, test } from "@playwright/test";

// The app is installable (manifest + icons) and shows an offline page without a connection.

test("serves an installable web app manifest", async ({ page, request }) => {
  await page.goto("/sign-in");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");

  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: "IP Messenger", display: "standalone", start_url: "/" });
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});

test("shows the offline page when the connection drops", async ({ page, context }) => {
  await page.goto("/sign-in");
  // Wait until the service worker controls the page, then reload so navigations go through it.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.goto("/chats").catch(() => {});
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();

  // Coming back online reloads the page by itself.
  await context.setOffline(false);
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeHidden();
});
