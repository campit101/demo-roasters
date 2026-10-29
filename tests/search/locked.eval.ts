// Marks the LOCKED 20 against the real search: the same flow as the search page (run.ts), reading products and
// free stock from the TEST database and using the bundled meaning model. Limits and logging are left out, as
// they decide whether a search runs, not what it shows. A report for T5 and the T9 gate; never tuned against.
// Run: npm run eval:locked (needs .env.local and a seeded test database).
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, expect, it } from "vitest";
import { withVerifiedTls } from "@/db/url";
import { assertTestDatabaseUrl } from "@/lib/guards";
import { findCandidates } from "@/search/candidates";
import { embed } from "@/search/embed";
import { runSearch } from "@/search/run";
import { loadEnvLocal } from "../../scripts/env";
import { LOCKED_QUERIES } from "./locked-queries";
import { scoreRun, type Shown } from "./score";

loadEnvLocal();
const pool = new pg.Pool({ connectionString: withVerifiedTls(assertTestDatabaseUrl(process.env.DATABASE_URL)), max: 2 });
const db = drizzle({ client: pool });
afterAll(() => pool.end());

it("locked 20 against the real search", { timeout: 300_000 }, async () => {
  const answers: Shown[][] = [];
  const times: number[] = [];
  for (const c of LOCKED_QUERIES) {
    const started = performance.now();
    const out = await runSearch(
      { q: c.query, drops: [] },
      {
        allowance: async () => ({ allowed: true, meaning: true }),
        embed: async (text) => (await embed([text]))[0]!,
        candidates: (filters, vector) => findCandidates(db, filters, vector),
        record: () => {},
      },
    );
    times.push(performance.now() - started);
    if (out.status !== "done") throw new Error(`${c.id}: ${out.status}`);
    answers.push(out.results.map(({ product }) => ({ slug: product.slug, pricePence: product.pricePence, stock: product.stock })));
  }
  const run = scoreRun(LOCKED_QUERIES, answers);
  for (const r of run.results) {
    const c = LOCKED_QUERIES.find((q) => q.id === r.id)!;
    console.log(`${r.passed ? "PASS" : "FAIL"} ${r.id} "${r.query}" -> ${r.shownTop.join(", ") || "(nothing)"}`);
    if (!r.passed) console.log(`      acceptable: ${c.acceptable.join(", ")}${c.mustBeFirst ? ` | first: ${c.mustBeFirst}` : ""}`);
    for (const v of r.violations) console.log(`      VIOLATION ${v}`);
  }
  const warm = times.slice(1).sort((a, b) => a - b);
  console.log(`\nLocked: ${run.passedCount} of ${LOCKED_QUERIES.length} passed, ${run.violationCount} violations; overall ${run.overall ? "PASS" : "FAIL"} (pass mark 18, 0 violations).`);
  console.log(`Time per search on this laptop: first ${times[0]!.toFixed(0)} ms (loads the model), warm median ${warm[Math.floor(warm.length / 2)]!.toFixed(0)} ms.`);
  // The command fails when the gate fails, so a script or CI step can never read a FAIL as a pass.
  expect(run.overall, "locked search gate (CONSTRAINTS.md)").toBe(true);
});
