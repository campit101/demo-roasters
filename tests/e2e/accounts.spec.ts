import { expect, test } from "@playwright/test";
import { DEMO_ACCOUNTS } from "../../src/config/shop";

// Each test signs in as its own made-up connection, so tests running side by side never share the sign-in limits.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".")}` });
});

const fresh = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const PASSWORD = "a-long-test-password";

test("a visitor creates an account, signs out, signs back in and deletes it", async ({ page }) => {
  // Six password checks in one test; each is slow on purpose (password hashing), more so under the full suite.
  test.setTimeout(60_000);
  const email = fresh();
  await page.goto("/account/create");
  await page.getByLabel("First name").fill("Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Hello, Tester." })).toBeVisible();
  await expect(page.getByText("No orders yet.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account\/sign-in$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("the-wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("That email and password do not match an account.")).toBeVisible();
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hello, Tester." })).toBeVisible();

  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Tick the box to confirm.")).toBeVisible();
  await page.getByLabel("Your password").fill(PASSWORD);
  await page.getByLabel(/Delete my account now/).check();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/account=deleted/);

  await page.goto("/account/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("That email and password do not match an account.")).toBeVisible();
});

test("the create-account form explains problems next to each field", async ({ page }) => {
  await page.goto("/account/create");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your first name.")).toBeVisible();
  await expect(page.getByText(/Enter an email address like/)).toBeVisible();
  await expect(page.getByText(/Use at least \d+ characters/)).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("not-an-email");
});

test("anyone can try the demo customer, which cannot be deleted", async ({ page }) => {
  await page.goto("/account/sign-in");
  await expect(page.getByText(DEMO_ACCOUNTS.customer.email)).toBeVisible();
  await page.getByRole("button", { name: "Sign in as the demo customer" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(/You are using the shared demo customer/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Delete your account" })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out" }).click();
});

test("the header has an account link on every page", async ({ page }) => {
  await page.goto("/shop/coffee");
  await page.getByRole("link", { name: "Your account" }).click();
  await expect(page).toHaveURL(/\/account\/sign-in$/);
});
