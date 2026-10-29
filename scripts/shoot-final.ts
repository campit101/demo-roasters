// Final quality check screenshots (T11): the pages a portfolio visitor walks through, at 1440 and 375 px, light theme,
// into lab/final/. Usage: node scripts/shoot-final.ts [base, default http://localhost:3200]
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3200";
const PAGES = [
  ["home", "/"],
  ["coffee", "/shop/coffee"],
  ["product", "/products/hillside-sunrise"],
  ["search", "/search?q=fruity+coffee+for+filter"],
  ["sign-in", "/account/sign-in"],
  ["privacy", "/privacy"],
] as const;
mkdirSync("lab/final", { recursive: true });
const browser = await chromium.launch();
for (const width of [1440, 375]) {
  const page = await browser.newPage({ viewport: { width, height: width > 600 ? 900 : 812 } });
  for (const [name, path] of PAGES) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.screenshot({ path: `lab/final/${name}-${width}.png` });
  }
  // The basket at its cap: 3 of one coffee already in it.
  await page.evaluate(() =>
    localStorage.setItem("basket", JSON.stringify({ lines: [{ slug: "hillside-sunrise", name: "Hillside Sunrise", pricePence: 1150, grind: "whole-bean", quantity: 3 }] })),
  );
  await page.goto(base + "/products/hillside-sunrise", { waitUntil: "networkidle" });
  await page.screenshot({ path: `lab/final/product-cap-${width}.png`, fullPage: width < 600 });
  await page.close();
}
await browser.close();
console.log("Saved to lab/final/.");
