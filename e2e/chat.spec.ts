import { expect, test, type Browser, type Page } from "@playwright/test";

// MSG-26: two signed-in users chat with each other.
// Needs two existing, confirmed test users (see e2e/README.md).

const userA = { email: process.env.E2E_USER_A_EMAIL ?? "", password: process.env.E2E_USER_A_PASSWORD ?? "" };
const userB = { email: process.env.E2E_USER_B_EMAIL ?? "", password: process.env.E2E_USER_B_PASSWORD ?? "" };
const userBName = process.env.E2E_USER_B_NAME ?? "Bob";

const haveUsers = Boolean(userA.email && userA.password && userB.email && userB.password);

async function signIn(browser: Browser, user: { email: string; password: string }, contextOptions = {}) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/chats$/);
  return page;
}

function messageBox(page: Page) {
  return page.getByRole("textbox", { name: "Message" });
}

// The chat's message list (the sidebar's last-message preview can show the same text).
function inChat(page: Page, text: string) {
  return page.getByRole("list", { name: "Messages" }).getByText(text, { exact: true });
}

async function send(page: Page, text: string) {
  await messageBox(page).fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

test("two users sign in and exchange messages in real time", async ({ browser, baseURL }, testInfo) => {
  test.skip(!haveUsers, "Set E2E_USER_A_EMAIL/PASSWORD and E2E_USER_B_EMAIL/PASSWORD (see e2e/README.md)");

  // Each user gets their own browser context (separate cookies), emulating this project's device.
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
  const contextOptions = { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };
  const a = await signIn(browser, userA, contextOptions);
  const b = await signIn(browser, userB, contextOptions);

  // A finds B in the contact directory and opens (or reuses) their direct chat.
  await a.goto("/contacts");
  await a.getByRole("searchbox", { name: "Search contacts by name" }).fill(userBName);
  await a.getByRole("button", { name: "Search" }).click();
  await a.getByRole("listitem").filter({ hasText: userBName }).getByRole("button", { name: "Message" }).click();
  await expect(a).toHaveURL(/\/chat\/[0-9a-f-]{36}$/);
  const chatUrl = new URL(a.url()).pathname;

  // B opens the same conversation.
  await b.goto(chatUrl);
  await expect(messageBox(b)).toBeVisible();

  // A sends: the message is saved and shown to A, and reaches B without a reload (MSG-17, MSG-18).
  const hello = `e2e hello ${testInfo.project.name} ${Date.now()}`;
  await send(a, hello);
  await expect(inChat(a, hello)).toBeVisible();
  await expect(a.getByText("Sending…")).toHaveCount(0);
  await expect(inChat(b, hello)).toBeVisible();

  // B replies; A sees it live.
  const reply = `e2e reply ${testInfo.project.name} ${Date.now()}`;
  await send(b, reply);
  await expect(inChat(a, reply)).toBeVisible();

  // Messages persist and stay in chronological order after a reload.
  await a.reload();
  const helloBox = await inChat(a, hello).boundingBox();
  const replyBox = await inChat(a, reply).boundingBox();
  expect(helloBox && replyBox && helloBox.y < replyBox.y).toBe(true);

  await a.context().close();
  await b.context().close();
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/chats");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign-in links to the password reset form (MSG-31)", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();

  // Without a valid reset link there is no session, so the new-password page sends you back.
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/forgot-password\?notice=link-expired$/);
  // Filtered by text: Next's route announcer is also role="alert".
  await expect(page.getByRole("alert").filter({ hasText: "invalid or has expired" })).toBeVisible();
});
