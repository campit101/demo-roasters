// Screenshots the checkout flow at 375 and 1440 px: the basket with Checkout, Stripe's sandbox page (light only;
// it is Stripe's) and the order confirmation page in light and dark, into lab/checkout/. Pays with Stripe's test card,
// then removes the orders it made and puts their stock back (TEST database only).
// Usage: node scripts/shoot-checkout.ts [base, default http://localhost:3200]
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { closeTestDb, removeOrder } from "../tests/e2e/test-db.ts";

const base = process.argv[2] ?? "http://localhost:3200";
mkdirSync("lab/checkout", { recursive: true });
const browser = await chromium.launch();
const references: string[] = [];
try {
  for (const width of [375, 1440]) {
    const height = width < 600 ? 812 : 900;
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.route("**/api/checkout", async (route) => {
      const response = await route.fetch({ headers: { ...route.request().headers(), "x-forwarded-for": `198.51.100.${200 + (width % 50)}` } });
      const body = (await response.json()) as { reference?: string };
      if (body.reference) references.push(body.reference);
      await route.fulfill({ response, json: body });
    });
    await page.goto(`${base}/products/honey-valley`);
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await page.getByRole("button", { name: /^Add to basket/ }).click();
    await page.goto(`${base}/products/glass-cafetiere`);
    await page.getByRole("button", { name: /^Add to basket/ }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `lab/checkout/basket-${width}-light.png` });
    await page.evaluate(() => localStorage.setItem("theme", "dark"));
    await page.reload();
    await page.getByRole("button", { name: /^Basket, / }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `lab/checkout/basket-${width}-dark.png` });
    await page.evaluate(() => localStorage.removeItem("theme"));
    await page.reload();
    await page.getByRole("button", { name: /^Basket, / }).click();

    await page.getByRole("dialog", { name: /Your basket/ }).getByRole("button", { name: "Checkout" }).click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await page.locator("#cardNumber").waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `lab/checkout/stripe-${width}-light.png`, fullPage: true });
    await page.locator("#cardNumber").fill("4242 4242 4242 4242");
    await page.locator("#cardExpiry").fill("12 / 34");
    await page.locator("#cardCvc").fill("123");
    await page.locator("#billingName").fill("Demo Customer");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/order\//, { timeout: 60_000 });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `lab/checkout/order-${width}-light.png`, fullPage: true });
    await page.screenshot({ path: `lab/checkout/order-${width}-light-top.png` });
    await page.evaluate(() => localStorage.setItem("theme", "dark"));
    await page.reload({ waitUntil: "networkidle" });
    await page.screenshot({ path: `lab/checkout/order-${width}-dark.png`, fullPage: true });
    await page.evaluate(() => localStorage.removeItem("theme"));

    // A cancelled checkout: back from Stripe to the basket, then the order's own page.
    await page.goto(`${base}/products/honey-valley`);
    await page.getByRole("button", { name: /^Add to basket/ }).click();
    await page.getByRole("dialog", { name: /Your basket/ }).getByRole("button", { name: "Checkout" }).click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await page.getByRole("link", { name: /Back to Demo Roasters/ }).click();
    await page.waitForURL(/\/products\/honey-valley/, { timeout: 30_000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `lab/checkout/cancelled-basket-${width}-light.png` });
    await page.goto(`${base}/order/${references.at(-1)}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `lab/checkout/cancelled-order-${width}-light.png`, fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
  for (const ref of references) await removeOrder(ref);
  await closeTestDb();
}
console.log(`Saved checkout screenshots to lab/checkout (${references.length} test orders made and removed).`);
