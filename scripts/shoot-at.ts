// One viewport screenshot with a chosen element scrolled into view, optional click first.
// Usage: node scripts/shoot-at.ts <url> <selector> <out.png> [width] [theme] [clickSelector]
import { chromium } from "@playwright/test";
const [url, selector, out, widthArg = "1440", theme = "light", click] = process.argv.slice(2);
if (!url || !selector || !out) throw new Error("Usage: node scripts/shoot-at.ts <url> <selector> <out.png> [width] [theme] [click]");
const width = Number(widthArg);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height: width < 600 ? 812 : 900 } });
if (theme === "dark") await context.addInitScript(() => localStorage.setItem("theme", "dark"));
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.locator(selector).first().scrollIntoViewIfNeeded();
if (click) await page.locator(click).first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: out });
await browser.close();
