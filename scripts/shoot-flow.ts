// Screenshots the shopping flow's moving parts: the Coffee menu, the phone menu, and the basket after adding a
// coffee, at 1440 and 375 px in light and dark, into lab/flow/.
// Usage: node scripts/shoot-flow.ts [base, default http://localhost:3200]
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3200";
mkdirSync("lab/flow", { recursive: true });
const browser = await chromium.launch();
for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: width > 600 ? 900 : 812 } });
    if (theme === "dark") await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto(`${base}/`);
    if (width > 1000) {
      await page.getByRole("button", { name: "Coffee" }).click();
      await page.screenshot({ path: `lab/flow/menu-${width}-${theme}.png` });
      await page.keyboard.press("Escape");
    } else {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `lab/flow/menu-${width}-${theme}.png` });
      await page.keyboard.press("Escape");
    }
    await page.goto(`${base}/products/honey-valley`);
    await page.screenshot({ path: `lab/flow/product-${width}-${theme}.png` });
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await page.getByRole("button", { name: /^Add to basket/ }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `lab/flow/basket-${width}-${theme}.png` });
    await page.close();
  }
}
await browser.close();
console.log("Saved flow screenshots to lab/flow.");
