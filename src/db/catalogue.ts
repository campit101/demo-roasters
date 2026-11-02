// Catalogue reads for the shop pages: every active product with its free stock (out-of-stock included,
// so pages can show it greyed out). Search uses findCandidates instead, which never returns stock 0.
import "server-only";
import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { PRODUCTS, type Product } from "@/data/products";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getDb } from "./client";

/** GitHub's CI builds without a database (no secrets there). Only there, pages compile from the catalogue file. */
const compileOnly = () => !process.env.DATABASE_URL && process.env.CI === "true" && !process.env.VERCEL;

type Row = {
  slug: string;
  name: string;
  category: Product["category"];
  description: string;
  size: string;
  price_pence: number;
  roast: Product["roast"];
  caffeine: Product["caffeine"];
  origins: Product["origins"];
  flavour_notes: string[];
  brew_methods: Product["brewMethods"];
  art: Product["art"];
  free_stock: number;
};

const toProduct = (r: Row): Product => ({
  slug: r.slug,
  name: r.name,
  category: r.category,
  description: r.description,
  size: r.size,
  pricePence: r.price_pence,
  roast: r.roast,
  caffeine: r.caffeine,
  origins: r.origins,
  flavourNotes: r.flavour_notes,
  brewMethods: r.brew_methods,
  art: r.art,
  stock: Math.max(0, r.free_stock),
});

/** Cache label: checkout, payments and admin edits call revalidateTag(CATALOGUE_TAG) so stock shows fresh. */
export const CATALOGUE_TAG = "catalogue";

/** Cached for 5 minutes (or until revalidated), so shop pages rarely wait for the database. */
export const listCatalogue = unstable_cache(readCatalogue, ["catalogue-v1"], { revalidate: 300, tags: [CATALOGUE_TAG] });

async function readCatalogue(): Promise<Product[]> {
  if (compileOnly()) return [...PRODUCTS];
  return queryCatalogue(getDb());
}

/** The uncached read (exported for integration tests): free stock is stock minus units held by unexpired checkouts. */
export async function queryCatalogue(db: NodePgDatabase<Record<string, unknown>>): Promise<Product[]> {
  const result = await db.execute<Row>(sql`
    select p.slug, p.name, p.category, p.description, p.size, p.price_pence, p.roast, p.caffeine, p.origins,
           p.flavour_notes, p.brew_methods, p.art,
           (p.stock - coalesce(r.reserved, 0))::int as free_stock
    from products p
    left join (
      select oi.product_id, sum(oi.quantity)::int as reserved
      from order_items oi join orders o on o.id = oi.order_id
      where o.status = 'pending' and o.reserved_until > now()
      group by oi.product_id
    ) r on r.product_id = p.id
    where p.active
    order by p.id
  `);
  return result.rows.map(toProduct);
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return (await listCatalogue()).find((p) => p.slug === slug);
}
