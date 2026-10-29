// Screenshots pages at phone (375 px) and desktop (1440 px) widths in light and dark, into lab/shots/.
// Usage: node scripts/shoot.ts <base-url> <path> [<path> ...]
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [base, ...paths] = process.argv.slice(2);
if (!base || paths.length === 0) throw new Error("Usage: node scripts/shoot.ts <base-url> <path> [<path> ...]");
mkdirSync("lab/shots", { recursive: true });

const browser = await chromium.launch();
const errors: string[] = [];
for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 812 : 900 }, colorScheme: theme, deviceScaleFactor: 1 });
    // Light is the default; dark is the visitor's saved choice.
    if (theme === "dark") await context.addInitScript(() => localStorage.setItem("theme", "dark"));
    const page = await context.newPage();
    page.on("console", (m) => m.type() === "error" && errors.push(`${m.text()} (${page.url()})`));
    page.on("pageerror", (e) => errors.push(`${e.message} (${page.url()})`));
    for (const path of paths) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      const name = `${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}-${theme}.png`;
      await page.screenshot({ path: `lab/shots/${name}`, fullPage: true });
      // A first-screen shot too, readable at full size.
      await page.screenshot({ path: `lab/shots/${name.replace(".png", "-top.png")}` });
    }
    await context.close();
  }
}
await browser.close();
console.log(`Saved ${paths.length * 4} screenshots to lab/shots.`);
console.log(errors.length ? `Console errors:\n${[...new Set(errors)].join("\n")}` : "No console errors.");
