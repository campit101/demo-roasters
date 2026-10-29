// Lighthouse gate (CONSTRAINTS.md gate 4): mobile scores for performance, accessibility, best practices
// and SEO, judged on the median of 5 runs per page, against a running production build.
// Playwright starts Chromium with a debugging port and Lighthouse attaches to it (approach proven on Polisher).
// Usage: start a production build first, then: node scripts/lighthouse.ts [base, default http://localhost:3200]
// SEO is low by design while search engines are kept out (noindex); the script says when it saw that.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";

const base = process.argv[2] ?? "http://localhost:3200";
const PAGES = ["/", "/shop/coffee", "/products/hillside-sunrise", "/search?q=fruity+coffee+for+filter"];
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;
const GATE = 90;
const RUNS = 5;
const PORT = 9334;

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

mkdirSync(".lighthouse", { recursive: true });
const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`] });
let failed = false;
try {
  for (const path of PAGES) {
    const name = path === "/" ? "home" : path.slice(1).replace(/\W+/g, "-");
    const runs: number[][] = [];
    let noindex = false;
    let vitals = "";
    for (let run = 1; run <= RUNS; run++) {
      const result = await lighthouse(new URL(path, base).href, { port: PORT, output: ["json", "html"], logLevel: "error" });
      if (!result) throw new Error(`Lighthouse returned nothing for ${path}`);
      const [json, html] = result.report as string[];
      writeFileSync(`.lighthouse/${name}-${run}.json`, json!);
      writeFileSync(`.lighthouse/${name}-${run}.html`, html!);
      runs.push(CATEGORIES.map((c) => Math.round((result.lhr.categories[c]?.score ?? 0) * 100)));
      noindex = result.lhr.audits["is-crawlable"]?.score === 0;
      const a = result.lhr.audits;
      vitals = `LCP ${a["largest-contentful-paint"]?.displayValue}, TBT ${a["total-blocking-time"]?.displayValue}, CLS ${a["cumulative-layout-shift"]?.displayValue}`;
    }
    const scores = CATEGORIES.map((_, i) => median(runs.map((r) => r[i]!)));
    const below = CATEGORIES.filter((c, i) => scores[i]! < GATE && !(c === "seo" && noindex));
    if (below.length) failed = true;
    process.stdout.write(
      `${path.padEnd(28)} median of ${RUNS}: ${CATEGORIES.map((c, i) => `${c} ${scores[i]}`).join("  ")}  performance runs ${runs.map((r) => r[0]).join(", ")}  (last: ${vitals})` +
        `${noindex ? "  [noindex: SEO not judged]" : ""}${below.length ? `  BELOW ${GATE}: ${below.join(", ")}` : ""}\n`,
    );
  }
} finally {
  await browser.close();
}
process.stdout.write(failed ? `At least one page is below ${GATE}.\n` : `Every page meets the ${GATE} gate.\n`);
process.exit(failed ? 1 : 0);
