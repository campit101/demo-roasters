// Loads the 40 demo products, with their meaning vectors, into the database.
//   Laptop (test database only): resets every product to the catalogue, stock included.
//   Vercel build: inserts only products that are missing, so admin edits on the live demo are never undone.
import pg from "pg";
import { PRODUCTS } from "../src/data/products.ts";
import { withVerifiedTls } from "../src/db/url.ts";
import { assertTestDatabaseUrl } from "../src/lib/guards.ts";
import { embed, productEmbeddingText } from "../src/search/embed.ts";
import { loadEnvLocal } from "./env.ts";

// Read before .env.local is loaded, so only a real Vercel build counts as Vercel.
const onVercel = process.env.VERCEL === "1";
loadEnvLocal();
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!onVercel) assertTestDatabaseUrl(url);
if (!url) throw new Error("Database connection string is missing");
const mode = onVercel ? "insert-missing" : "reset";

const started = performance.now();
const vectors = await embed(PRODUCTS.map(productEmbeddingText));
const embedMs = performance.now() - started;

const client = new pg.Client({ connectionString: withVerifiedTls(url) });
await client.connect();
let written = 0;
try {
  await client.query("begin");
  for (const [i, p] of PRODUCTS.entries()) {
    const values = [
      p.slug, p.name, p.category, p.description, p.size, p.pricePence, p.roast, p.caffeine,
      p.origins, p.flavourNotes, p.brewMethods, p.stock, p.art, `[${vectors[i]!.join(",")}]`,
    ];
    const conflict =
      mode === "reset"
        ? `on conflict (slug) do update set name = excluded.name, category = excluded.category,
             description = excluded.description, size = excluded.size, price_pence = excluded.price_pence,
             roast = excluded.roast, caffeine = excluded.caffeine, origins = excluded.origins,
             flavour_notes = excluded.flavour_notes, brew_methods = excluded.brew_methods, stock = excluded.stock,
             seed_stock = excluded.seed_stock, art = excluded.art, embedding = excluded.embedding,
             active = true, updated_at = now()`
        : "on conflict (slug) do nothing";
    const res = await client.query(
      `insert into products (slug, name, category, description, size, price_pence, roast, caffeine,
         origins, flavour_notes, brew_methods, stock, seed_stock, art, embedding)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13, $14::vector) ${conflict}`,
      values,
    );
    written += res.rowCount ?? 0;
  }
  await client.query("commit");
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  await client.end();
}
console.log(
  `Seed (${mode}) on ${onVercel ? `Vercel ${process.env.VERCEL_ENV}` : "the test database"}: ${written} of ${PRODUCTS.length} products written; 40 vectors in ${embedMs.toFixed(0)} ms.`,
);
