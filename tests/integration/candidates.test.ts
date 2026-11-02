import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PRODUCTS } from "@/data/products";
import { withVerifiedTls } from "@/db/url";
import { assertTestDatabaseUrl } from "@/lib/guards";
import { findCandidates } from "@/search/candidates";
import { dot, embed, productEmbeddingText } from "@/search/embed";
import { parseQuery, type Filters } from "@/search/parse";
import { matchesFilters } from "@/search/rank";
import { loadEnvLocal } from "../../scripts/env";
import { TUNING_QUERIES } from "../search/tuning-queries";

loadEnvLocal();
const pool = new pg.Pool({ connectionString: withVerifiedTls(assertTestDatabaseUrl(process.env.DATABASE_URL)), max: 2 });
const db = drizzle({ client: pool });

afterAll(() => pool.end());

const expected = (f: Filters) => PRODUCTS.filter((p) => matchesFilters(p, f)).map((p) => p.slug).sort();
const actual = async (f: Filters) => (await findCandidates(db, f, null)).map((c) => c.slug).sort();

describe("database filters match the code's filters exactly (seeded catalogue, no checkouts open)", () => {
  beforeAll(async () => {
    const { rows } = await pool.query("select count(*)::int as n from products where stock = seed_stock and active");
    expect(rows[0].n, "run npm run seed first").toBe(40);
    const open = await pool.query("select count(*)::int as n from orders where status = 'pending' and reserved_until > now()");
    expect(open.rows[0].n).toBe(0);
  });

  it.each(TUNING_QUERIES.map((c) => [c.query]))("tuning query %s", async (query) => {
    const { filters } = parseQuery(query);
    expect(await actual(filters)).toEqual(expected(filters));
  });

  it.each<[string, Filters]>([
    ["no filters", {}],
    ["decaf only", { caffeine: ["decaf"] }],
    ["regular light", { caffeine: ["regular"], roasts: ["light"] }],
    ["two origins", { origins: ["Kenya", "Rwanda"] }],
    ["filter methods", { methods: ["pour-over", "batch-brew"] }],
    ["gear under £20", { categories: ["gear"], maxPricePence: 2000 }],
    ["range", { minPricePence: 1000, maxPricePence: 1100 }],
    ["everything at once", { caffeine: ["decaf"], roasts: ["medium", "dark"], methods: ["cafetiere"], categories: ["beans"], maxPricePence: 1200 }],
  ])("%s", async (_label, filters) => {
    expect(await actual(filters)).toEqual(expected(filters));
  });
});

describe("stock held by checkouts", () => {
  async function withHeld(slug: string, quantity: number, minutesFromNow: number, status: string, check: (slugs: string[]) => void) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const tx = drizzle({ client });
      const { rows } = await client.query(
        `insert into orders (subtotal_pence, delivery_pence, total_pence, reserved_until, status)
         values (100, 0, 100, now() + make_interval(mins => $1), $2) returning id`,
        [minutesFromNow, status],
      );
      await client.query(
        `insert into order_items (order_id, product_id, name, unit_price_pence, quantity)
         select $1, id, name, price_pence, $3 from products where slug = $2`,
        [rows[0].id, slug, quantity],
      );
      check((await findCandidates(tx, {}, null)).map((c) => c.slug));
    } finally {
      await client.query("rollback");
      client.release();
    }
  }

  // Cloudline Reserve has 5 in stock and a line holds at most 3, so two open checkouts are needed to hold all 5.
  it("hides a product while unpaid, unexpired checkouts hold its last units", async () => {
    await withHeld("cloudline-reserve", 3, 30, "pending", (slugs) => expect(slugs).toContain("cloudline-reserve")); // 5 - 3 = 2 left
    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query(
        `insert into orders (subtotal_pence, delivery_pence, total_pence, reserved_until) values (100, 0, 100, now() + interval '30 minutes'), (100, 0, 100, now() + interval '30 minutes') returning id`,
      );
      for (const [i, q] of [3, 2].entries()) {
        await client.query(
          `insert into order_items (order_id, product_id, name, unit_price_pence, quantity) select $1, id, name, price_pence, $2 from products where slug = 'cloudline-reserve'`,
          [rows[i].id, q],
        );
      }
      const slugs = (await findCandidates(drizzle({ client }), {}, null)).map((c) => c.slug);
      expect(slugs).not.toContain("cloudline-reserve"); // 5 - 3 - 2 = 0 left
    } finally {
      await client.query("rollback");
      client.release();
    }
  });

  it("frees the units again once the hold has expired or the checkout is no longer pending", async () => {
    await withHeld("weekend-brunch-box", 3, -1, "pending", (slugs) => expect(slugs).toContain("weekend-brunch-box"));
    await withHeld("weekend-brunch-box", 3, 30, "expired", (slugs) => expect(slugs).toContain("weekend-brunch-box"));
  });
});

describe("meaning similarity", () => {
  it("is the same in the database as in code", async () => {
    const [q] = await embed(["chocolatey espresso"]);
    const fromDb = await findCandidates(db, {}, q!);
    const vectors = await embed(PRODUCTS.map(productEmbeddingText));
    for (const c of fromDb) {
      const i = PRODUCTS.findIndex((p) => p.slug === c.slug);
      expect(c.similarity!, c.slug).toBeCloseTo(dot(q!, vectors[i]!), 3);
    }
  });
});
