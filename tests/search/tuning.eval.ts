// Marks the TUNING set only, against the in-memory catalogue (no database, no embeddings yet).
// Run: npm run eval:tuning. The locked 20 are marked only at T5/T9, against the real search.
import { it } from "vitest";
import { PRODUCTS } from "@/data/products";
import { parseQuery } from "@/search/parse";
import { rankProducts } from "@/search/rank";
import { scoreRun } from "./score";
import { TUNING_QUERIES } from "./tuning-queries";

it("tuning set report", () => {
  const answers = TUNING_QUERIES.map((c) =>
    rankProducts(PRODUCTS, parseQuery(c.query)).map(({ product }) => ({
      slug: product.slug,
      pricePence: product.pricePence,
      stock: product.stock,
    })),
  );
  const run = scoreRun(TUNING_QUERIES, answers);
  for (const r of run.results) {
    const c = TUNING_QUERIES.find((t) => t.id === r.id)!;
    console.log(`${r.passed ? "PASS" : "FAIL"} ${r.id} "${r.query}" -> ${r.shownTop.join(", ") || "(nothing)"}`);
    if (!r.passed) console.log(`      acceptable: ${c.acceptable.join(", ")}${c.mustBeFirst ? ` | first: ${c.mustBeFirst}` : ""}`);
    for (const v of r.violations) console.log(`      VIOLATION ${v}`);
  }
  console.log(`\nTuning: ${run.passedCount} of ${TUNING_QUERIES.length} passed, ${run.violationCount} violations.`);
});
