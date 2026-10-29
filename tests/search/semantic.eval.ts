// Spike report: how the free meaning model scores products for the TUNING queries, and how the
// tuning set fares with meaning added. Run: npm run eval:semantic. Never runs the locked 20.
import { it } from "vitest";
import { PRODUCTS } from "@/data/products";
import { dot, embed, productEmbeddingText } from "@/search/embed";
import { parseQuery } from "@/search/parse";
import { rankProducts } from "@/search/rank";
import { scoreRun } from "./score";
import { TUNING_QUERIES } from "./tuning-queries";

it("semantic tuning report", { timeout: 120_000 }, async () => {
  let t = performance.now();
  const productVectors = await embed(PRODUCTS.map(productEmbeddingText));
  console.log(`40 product vectors in ${(performance.now() - t).toFixed(0)} ms (includes model load)`);

  const answers = [];
  for (const c of TUNING_QUERIES) {
    const parsed = parseQuery(c.query);
    t = performance.now();
    const [q] = await embed([[...parsed.terms, c.query].join(" ")]);
    const ms = performance.now() - t;
    const sims = PRODUCTS.map((p, i) => [p.slug, dot(q!, productVectors[i]!)] as const);
    const values = sims.map(([, s]) => s);
    const top = [...sims].sort((a, b) => b[1] - a[1]).slice(0, 3);
    console.log(
      `${c.id} ${ms.toFixed(0)} ms, similarity ${Math.min(...values).toFixed(3)} to ${Math.max(...values).toFixed(3)}; nearest ${top.map(([s, v]) => `${s} ${v.toFixed(3)}`).join(", ")}`,
    );
    const semantic = new Map(sims);
    answers.push(rankProducts(PRODUCTS, parsed, { semantic }).map(({ product }) => ({ slug: product.slug, pricePence: product.pricePence, stock: product.stock })));
  }
  const run = scoreRun(TUNING_QUERIES, answers);
  for (const r of run.results.filter((x) => !x.passed)) console.log(`FAIL ${r.id} "${r.query}" -> ${r.shownTop.join(", ")}`);
  console.log(`With relative meaning scores: ${run.passedCount} of 15, ${run.violationCount} violations.`);
});
