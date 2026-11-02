// Reads the products that pass every hard rule straight from the database, with free stock
// (on hand minus units held by unexpired, unpaid checkouts) and, when given a query vector, each
// product's meaning similarity. The same rules as matchesFilters in rank.ts; a test keeps them equal.
import { sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Product } from "@/data/products";
import type { Filters } from "./parse";

export interface Candidate extends Product {
  /** Free stock right now. */
  stock: number;
  similarity: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = NodePgDatabase<any>;

const textArray = (values: readonly string[]) => sql`${`{${values.map((v) => `"${v.replace(/["\\]/g, "")}"`).join(",")}}`}::text[]`;

export async function findCandidates(db: Db, filters: Filters, queryVector: readonly number[] | null): Promise<Candidate[]> {
  const where: SQL[] = [sql`p.active`, sql`p.stock - coalesce(r.reserved, 0) > 0`];
  if (filters.maxPricePence !== undefined) where.push(sql`p.price_pence <= ${filters.maxPricePence}`);
  if (filters.minPricePence !== undefined) where.push(sql`p.price_pence >= ${filters.minPricePence}`);
  if (filters.caffeine?.length) where.push(sql`p.caffeine = any(${textArray(filters.caffeine)})`);
  if (filters.roasts?.length) where.push(sql`p.roast = any(${textArray(filters.roasts)})`);
  if (filters.categories?.length) where.push(sql`p.category = any(${textArray(filters.categories)})`);
  if (filters.origins?.length) where.push(sql`p.origins && ${textArray(filters.origins)}`);
  if (filters.methods?.length) where.push(sql`p.brew_methods && ${textArray(filters.methods)}`);

  const similarity = queryVector
    ? sql`1 - (p.embedding <=> ${`[${queryVector.join(",")}]`}::vector)`
    : sql`null::float8`;

  const result = await db.execute<{
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
    free_stock: number;
    art: Product["art"];
    similarity: number | null;
  }>(sql`
    select p.slug, p.name, p.category, p.description, p.size, p.price_pence, p.roast, p.caffeine,
           p.origins, p.flavour_notes, p.brew_methods, p.art,
           (p.stock - coalesce(r.reserved, 0))::int as free_stock,
           ${similarity} as similarity
    from products p
    left join (
      select oi.product_id, sum(oi.quantity)::int as reserved
      from order_items oi join orders o on o.id = oi.order_id
      where o.status = 'pending' and o.reserved_until > now()
      group by oi.product_id
    ) r on r.product_id = p.id
    where ${sql.join(where, sql` and `)}
    order by p.slug
  `);

  return result.rows.map((r) => ({
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
    stock: r.free_stock,
    art: r.art,
    similarity: r.similarity === null ? null : Number(r.similarity),
  }));
}
