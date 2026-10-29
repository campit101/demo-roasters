// Checkout end to end: a full purchase on Stripe's hosted sandbox page with Stripe's published test card, a cancel,
// and a sold-out refusal. Every order made here is removed afterwards and its stock put back (shared test database).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { closeTestDb, orderStatus, removeOrder, stockOf } from "./test-db";

const TEST_CARD = "4242 4242 4242 4242";
const references: string[] = [];

test.afterAll(async () => {
  for (const ref of references.splice(0)) await removeOrder(ref);
  await closeTestDb();
});

/**
 * Each test checks out as its own made-up connection (documentation addresses), so parallel tests never share limits.
 * Every order reference the server hands back is recorded for clean-up.
 */
async function asOwnConnection(page: Page) {
  const address = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  await page.route("**/api/checkout", async (route) => {
    const response = await route.fetch({ headers: { ...route.request().headers(), "x-forwarded-for": address } });
    const body = (await response.json()) as { reference?: string };
    if (body.reference) references.push(body.reference);
    await route.fulfill({ response, json: body });
  });
}

function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && new URL(page.url()).hostname === "localhost" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function addAndCheckout(page: Page, slug: string, grind?: string) {
  await page.goto(`/products/${slug}`);
  if (grind) await page.getByRole("button", { name: grind, exact: true }).click();
  await page.getByRole("button", { name: /^Add to basket/ }).click();
  const basket = page.getByRole("dialog", { name: /Your basket/ });
  const before = references.length;
  await basket.getByRole("button", { name: "Checkout" }).click();
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 30_000 });
  expect(references.length).toBe(before + 1);
  const reference = references.at(-1)!;
  expect(reference).toMatch(/^[0-9a-f-]{36}$/);
  return reference;
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.help})`)).toEqual([]);
}

test("a full test purchase on Stripe's sandbox page confirms the order, takes stock and empties the basket", async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = watchConsole(page);
  await asOwnConnection(page);
  // Phone and desktop run at the same time: each buys a different coffee so stock counts stay exact.
  const slug = info.project.name === "phone" ? "red-earth-natural" : "kettle-ridge-aa";
  const before = await stockOf(slug);
  const reference = await addAndCheckout(page, slug, "Espresso");

  // Stripe's page: prefilled fake email, the test card, any future date, any CVC.
  await expect(page.getByText("demo-customer@example.com")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/test card 4242 4242 4242 4242/)).toBeVisible();
  await page.locator("#cardNumber").fill(TEST_CARD);
  await page.locator("#cardExpiry").fill("12 / 34");
  await page.locator("#cardCvc").fill("123");
  await page.locator("#billingName").fill("Demo Customer");
  const postcode = page.locator("#billingPostalCode");
  if (await postcode.isVisible()) await postcode.fill("SW1A 1AA");
  await page.locator('button[type="submit"]').click();

  // A challenge on Stripe's page would stop the test here: it is never bypassed.
  await page.waitForURL(`**/order/${reference}`, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Thank you. Your test order is confirmed." })).toBeVisible();
  const summary = page.getByRole("region", { name: "Order summary" });
  await expect(summary).toContainText(/Red Earth Natural|Kettle Ridge AA/);
  await expect(summary).toContainText("Espresso");
  await expect(page.getByText("No money is taken and nothing is posted.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Basket, empty" })).toBeVisible();
  expect(await orderStatus(reference)).toBe("paid");
  expect(await stockOf(slug)).toBe(before - 1);

  // Revisiting is harmless: still paid once, stock taken once.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Thank you. Your test order is confirmed." })).toBeVisible();
  expect(await stockOf(slug)).toBe(before - 1);

  // The confirmation page passes axe in both themes (this test runs at both widths).
  await axe(page);
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await axe(page);
  expect(errors).toEqual([]);

  await page.getByRole("link", { name: "Continue shopping" }).click();
  await expect(page).toHaveURL(/\/shop\/coffee$/);
});

test("a signed-in customer's test order appears in their account", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto("/account/sign-in");
  await page.getByRole("button", { name: "Sign in as the demo customer" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await asOwnConnection(page);
  const slug = info.project.name === "phone" ? "morning-orchard" : "cerrado-sunset";
  const reference = await addAndCheckout(page, slug, "Filter");
  await page.locator("#cardNumber").fill(TEST_CARD);
  await page.locator("#cardExpiry").fill("12 / 34");
  await page.locator("#cardCvc").fill("123");
  await page.locator("#billingName").fill("Demo Customer");
  const postcode = page.locator("#billingPostalCode");
  if (await postcode.isVisible()) await postcode.fill("SW1A 1AA");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(`**/order/${reference}`, { timeout: 60_000 });
  await page.goto("/account");
  const orders = page.locator('section[aria-labelledby="orders"]');
  await expect(orders).toContainText(/Morning Orchard|Cerrado Sunset/);
  await expect(orders).toContainText("Filter");
  await expect(orders.getByRole("link", { name: "View order" }).first()).toHaveAttribute("href", /\/order\//);
});

test("cancelling on Stripe's page returns to the shop with the basket untouched and frees the stock", async ({ page }) => {
  test.setTimeout(90_000);
  await asOwnConnection(page);
  const reference = await addAndCheckout(page, "hillside-sunrise", "Filter");
  expect(await orderStatus(reference)).toBe("pending");
  await page.getByRole("link", { name: /Back to Demo Roasters/ }).click();

  await page.waitForURL(/\/products\/hillside-sunrise$/, { timeout: 30_000 });
  const basket = page.getByRole("dialog", { name: /Your basket/ });
  await expect(basket.getByRole("status").filter({ hasText: "Checkout cancelled" })).toHaveText(
    "Checkout cancelled. Nothing was charged, and your basket is just as you left it.",
  );
  await expect(basket).toContainText("Hillside Sunrise");
  await expect(basket).toContainText("Filter");
  expect(await orderStatus(reference)).toBe("cancelled");
  await axe(page);

  // The order's own page says so honestly.
  await page.goto(`/order/${reference}`);
  await expect(page.getByRole("heading", { level: 1, name: "This checkout was cancelled" })).toBeVisible();
  await axe(page);
});

test("a sold-out item in a saved basket is refused before Stripe, with the reason", async ({ page }) => {
  await asOwnConnection(page);
  // As if Thousand Hills sold out after it was added: the saved basket still holds it.
  await page.addInitScript(() =>
    localStorage.setItem("basket", JSON.stringify({ lines: [{ slug: "thousand-hills", name: "Thousand Hills", pricePence: 1100, grind: "filter", quantity: 1 }] })),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Basket, 1 item" }).click();
  const basket = page.getByRole("dialog", { name: /Your basket/ });
  await basket.getByRole("button", { name: "Checkout" }).click();
  await expect(basket.getByRole("alert")).toHaveText("Thousand Hills has just sold out. Remove it to continue.");
  await expect(page).toHaveURL(/localhost/);
  await basket.getByRole("button", { name: /Remove/ }).click();
  await expect(basket).toContainText("Your basket is empty.");
});

test("the basket stops at the per-product cap before checkout, and says why", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("basket", JSON.stringify({ lines: [{ slug: "hillside-sunrise", name: "Hillside Sunrise", pricePence: 1150, grind: "filter", quantity: 3 }] })),
  );
  await page.goto("/products/hillside-sunrise");
  await page.getByRole("button", { name: "Espresso", exact: true }).click();
  await expect(page.getByRole("button", { name: "Basket limit reached" })).toBeDisabled();
  await expect(page.getByText(/Up to 3 of each item and 6 items per order/)).toBeVisible();
  await axe(page);
});

test("unknown order addresses are a 404", async ({ page }) => {
  for (const path of ["/order/00000000-0000-4000-8000-000000000000", "/order/not-a-reference"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
});

test("the checkout, webhook and nightly addresses refuse requests they should not trust", async ({ request }) => {
  // No Origin header (another site's server, or a script): refused.
  expect((await request.post("/api/checkout", { data: { lines: [] } })).status()).toBe(403);
  // Unsigned webhooks are refused (here no secret is set, so every webhook is refused).
  expect((await request.post("/api/stripe/webhook", { data: { type: "checkout.session.completed" } })).status()).toBeGreaterThanOrEqual(400);
  expect((await request.get("/api/cron/nightly")).status()).toBe(401);
  expect((await request.get("/api/cron/nightly", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
});
