// Places a few test orders on the live demo shop, each in a fresh browser context (empty basket), paying with
// Stripe's published test card on Stripe's sandbox page. Stripe is in test mode: no real money moves.
// Usage: node scripts/test-orders.ts [base, default https://demo-roasters.vercel.app]
import { chromium, expect, type Browser, type Page } from "@playwright/test";

const base = process.argv[2] ?? "https://demo-roasters.vercel.app";
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const TEST_CARD = "4242 4242 4242 4242";

// Orders to place, in order. A grind of undefined means no grind click.
const ORDERS: { slug: string; grind?: string }[] = [
  { slug: "hillside-sunrise", grind: "Filter" },
  { slug: "night-shift-espresso", grind: "Espresso" },
  { slug: "morning-orchard", grind: "Whole bean" },
  { slug: "cerrado-sunset", grind: "Cafetière" },
  { slug: "gooseneck-kettle" },
];

if (ORDERS.length > 5) throw new Error("Refusing to place more than 5 test orders.");

async function placeOrder(browser: Browser, slug: string, grind?: string) {
  const context = await browser.newContext(DESKTOP);
  const page: Page = await context.newPage();
  try {
    await page.goto(`${base}/products/${slug}`, { waitUntil: "networkidle", timeout: 30_000 });
    if (grind) await page.getByRole("button", { name: grind, exact: true }).click();
    await page.getByRole("button", { name: /^Add to basket/ }).first().click();
    const basket = page.getByRole("dialog", { name: /Your basket/ });
    await basket.getByRole("button", { name: "Checkout" }).click();
    await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 30_000 });

    await page.locator("#cardNumber").fill(TEST_CARD);
    await page.locator("#cardExpiry").fill("12 / 34");
    await page.locator("#cardCvc").fill("123");
    await page.locator("#billingName").fill("Demo Customer");
    const postcode = page.locator("#billingPostalCode");
    if (await postcode.isVisible()) await postcode.fill("SW1A 1AA");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/order\//, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Thank you. Your test order is confirmed." })).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
let confirmed = 0;
try {
  for (const order of ORDERS) {
    let done = false;
    for (let attempt = 1; attempt <= 2 && !done; attempt++) {
      try {
        await placeOrder(browser, order.slug, order.grind);
        done = true;
      } catch (error) {
        const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
        console.log(`order ${order.slug} attempt ${attempt} failed: ${message}`);
      }
    }
    if (!done) {
      console.log(`stopping: ${order.slug} failed twice`);
      break;
    }
    confirmed++;
    console.log(`order ${confirmed} confirmed: ${order.slug}`);
  }
} finally {
  await browser.close();
}
console.log(`${confirmed} of ${ORDERS.length} test orders confirmed.`);
