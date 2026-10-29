// Admin reads and writes (T8). Server only. Writes are called only after canEdit() has passed in the action.
import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { embed, productEmbeddingText } from "@/search/embed";
import type { ProductEdit } from "@/lib/admin-forms";
import type { Product } from "@/data/products";

const rows = async <T,>(q: ReturnType<typeof sql>) => (await getDb().execute(q)).rows as T[];

export interface Overview {
  paidOrders: number;
  testRevenuePence: number;
  itemsSold: number;
  openCheckouts: number;
  searches7d: number;
  lowStock: number;
}

export async function overview(days = 30): Promise<Overview> {
  const [o] = await rows<{ paid: number; revenue: number; items: number; open: number; searches: number; low: number }>(sql`
    select
      (select count(*)::int from orders where status = 'paid' and paid_at > now() - make_interval(days => ${days})) as paid,
      (select coalesce(sum(total_pence), 0)::int from orders where status = 'paid' and paid_at > now() - make_interval(days => ${days})) as revenue,
      (select coalesce(sum(i.quantity), 0)::int from order_items i join orders o on o.id = i.order_id
         where o.status = 'paid' and o.paid_at > now() - make_interval(days => ${days})) as items,
      (select count(*)::int from orders where status = 'pending' and reserved_until > now()) as open,
      (select count(*)::int from search_events where created_at > now() - interval '7 days') as searches,
      (select count(*)::int from products where active and stock between 1 and 5) as low`);
  return { paidOrders: o!.paid, testRevenuePence: o!.revenue, itemsSold: o!.items, openCheckouts: o!.open, searches7d: o!.searches, lowStock: o!.low };
}

/** Paid test orders per day (Europe/London days), oldest first, with empty days filled in. */
export async function salesByDay(days = 30): Promise<{ day: string; orders: number; revenuePence: number }[]> {
  return rows(sql`
    with d as (
      select generate_series((now() at time zone 'Europe/London')::date - (${days}::int - 1), (now() at time zone 'Europe/London')::date, interval '1 day')::date as day
    )
    select to_char(d.day, 'YYYY-MM-DD') as day, count(o.id)::int as orders, coalesce(sum(o.total_pence), 0)::int as "revenuePence"
    from d left join orders o on o.status = 'paid' and (o.paid_at at time zone 'Europe/London')::date = d.day
    group by d.day order by d.day`);
}

export interface AdminOrder {
  /** The first 8 characters only: the full reference opens the order page, so it never reaches the dashboard. */
  shortReference: string;
  status: string;
  createdAt: string;
  totalPence: number;
  items: number;
  signedIn: boolean;
}

export async function recentOrders(limit = 50): Promise<AdminOrder[]> {
  return rows(sql`
    select left(o.reference::text, 8) as "shortReference", o.status, o.created_at as "createdAt", o.total_pence as "totalPence",
      coalesce((select sum(quantity)::int from order_items where order_id = o.id), 0) as items,
      (o.user_id is not null) as "signedIn"
    from orders o order by o.created_at desc limit ${limit}`);
}

export interface AdminProduct {
  slug: string;
  name: string;
  category: Product["category"];
  pricePence: number;
  stock: number;
  held: number;
  active: boolean;
  description: string;
  flavourNotes: string[];
  roast: Product["roast"];
  caffeine: Product["caffeine"];
  brewMethods: Product["brewMethods"];
}

const PRODUCT_COLUMNS = sql`
  p.slug, p.name, p.category, p.price_pence as "pricePence", p.stock, p.active, p.description, p.flavour_notes as "flavourNotes",
  p.roast, p.caffeine, p.brew_methods as "brewMethods",
  coalesce((select sum(i.quantity)::int from order_items i join orders o on o.id = i.order_id
    where i.product_id = p.id and o.status = 'pending' and o.reserved_until > now()), 0) as held`;

export const listProducts = () => rows<AdminProduct>(sql`select ${PRODUCT_COLUMNS} from products p order by p.category, p.name`);

export async function getAdminProduct(slug: string): Promise<AdminProduct | null> {
  return (await rows<AdminProduct>(sql`select ${PRODUCT_COLUMNS} from products p where p.slug = ${slug}`))[0] ?? null;
}

/** Saves an edit. When the words change, the meaning vector is rebuilt so search keeps up; price and stock edits
 *  keep the existing vector (no model work, and no tiny drift from embedding one product on its own). */
export async function saveProduct(slug: string, edit: ProductEdit): Promise<void> {
  const current = await getAdminProduct(slug);
  if (!current) throw new Error("No such product");
  const text = productEmbeddingText({ ...current, ...edit });
  const vector = text === productEmbeddingText(current) ? null : (await embed([text]))[0]!;
  await getDb().execute(sql`
    update products set name = ${edit.name}, description = ${edit.description}, price_pence = ${edit.pricePence},
      -- seed_stock too, or the nightly restock would undo the admin's stock change.
      stock = ${edit.stock}, seed_stock = ${edit.stock}, active = ${edit.active},
      -- One JSON value (Drizzle would spread a JS array into separate parameters).
      flavour_notes = array(select jsonb_array_elements_text(${JSON.stringify(edit.flavourNotes)}::jsonb)),
      embedding = coalesce(${vector ? `[${vector.join(",")}]` : null}::vector, embedding), updated_at = now()
    where slug = ${slug}`);
}
