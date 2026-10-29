// README screenshots (desktop 1440x900, phone 390x844) of the live demo shop into docs/screenshots/.
// Each shot uses a fresh browser context so baskets and sign-ins do not carry over.
// Usage: node scripts/shoot-readme.ts [base, default https://demo-roasters.vercel.app]
import { mkdirSync } from "node:fs";
import { chromium, type Browser, type BrowserContext } from "@playwright/test";

const base = process.argv[2] ?? "https://demo-roasters.vercel.app";
const OUT = "docs/screenshots";
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 };
const SEARCH = "/search?q=fruity+coffee+for+filter";
const PRODUCT = "/products/hillside-sunrise";

mkdirSync(OUT, { recursive: true });
const browser: Browser = await chromium.launch();

async function fresh(options: Parameters<Browser["newContext"]>[0], darkTheme = false): Promise<BrowserContext> {
  const context = await browser.newContext(options);
  if (darkTheme) {
    await context.addInitScript(() => localStorage.setItem("theme", "dark"));
  }
  return context;
}

async function shot(name: string, path: string, options: Parameters<Browser["newContext"]>[0], darkTheme = false) {
  const context = await fresh(options, darkTheme);
  const page = await context.newPage();
  await page.goto(base + path, { waitUntil: "networkidle", timeout: 30_000 });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await context.close();
  console.log(`saved ${name}.png`);
}

await shot("home-desktop", "/", DESKTOP);
await shot("coffee-desktop", "/shop/coffee", DESKTOP);
await shot("product-desktop", PRODUCT, DESKTOP);
await shot("search-desktop", SEARCH, DESKTOP);

// Basket: add the product, then screenshot the basket dialog.
{
  const context = await fresh(DESKTOP);
  const page = await context.newPage();
  await page.goto(base + PRODUCT, { waitUntil: "networkidle", timeout: 30_000 });
  await page.getByRole("button", { name: /^Add to basket/ }).first().click();
  await page.getByRole("dialog", { name: /Your basket/ }).waitFor({ state: "visible", timeout: 30_000 });
  await page.screenshot({ path: `${OUT}/basket-desktop.png` });
  await context.close();
  console.log("saved basket-desktop.png");
}

// Admin: sign in as the demo viewer, then screenshot the dashboard.
{
  const context = await fresh(DESKTOP);
  const page = await context.newPage();
  await page.goto(base + "/account/sign-in", { waitUntil: "networkidle", timeout: 30_000 });
  // The live label is "Look around the admin dashboard" (DemoViewerSignIn in src/components/account/AccountForms.tsx).
  await page.getByRole("button", { name: "Look around the admin dashboard" }).click();
  await page.waitForURL(/\/admin$/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 });
  await page.screenshot({ path: `${OUT}/admin-desktop.png` });
  await context.close();
  console.log("saved admin-desktop.png");
}

await shot("home-dark-desktop", "/", DESKTOP, true);
await shot("home-phone", "/", PHONE);
await shot("product-phone", PRODUCT, PHONE);
await shot("search-phone", SEARCH, PHONE);

await browser.close();
console.log(`Saved to ${OUT}/.`);
