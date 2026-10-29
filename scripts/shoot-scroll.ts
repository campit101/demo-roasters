// Screenshots a scroll-driven section at several points through it, into lab/scroll/.
// Usage: node scripts/shoot-scroll.ts <url> <css-selector> [width] [theme] [reduced]
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [url, selector, widthArg = "1440", theme = "light", reduced] = process.argv.slice(2);
if (!url || !selector) throw new Error("Usage: node scripts/shoot-scroll.ts <url> <css-selector> [width] [theme] [reduced]");
const width = Number(widthArg);
mkdirSync("lab/scroll", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height: width < 600 ? 812 : 900 },
  colorScheme: theme === "dark" ? "dark" : "light",
  reducedMotion: reduced === "reduced" ? "reduce" : "no-preference",
});
await page.goto(url, { waitUntil: "networkidle" });
const box = await page.locator(selector).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { top: r.top + window.scrollY, height: r.height };
});
const travel = Math.max(0, box.height - (width < 600 ? 812 : 900));
for (const f of [0, 0.15, 0.3, 0.5, 0.65, 0.8, 1]) {
  await page.evaluate((y) => window.scrollTo(0, y), box.top + travel * f);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `lab/scroll/${width}-${theme}${reduced ? "-reduced" : ""}-${Math.round(f * 100)}.png` });
}
await browser.close();
console.log(`Section ${Math.round(box.height)} px tall; 7 frames saved to lab/scroll.`);
