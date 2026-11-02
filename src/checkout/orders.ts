// Orders in the database: holding stock for a checkout, marking it paid exactly once, and releasing holds.
// Free stock = stock minus units in pending orders whose hold (reserved_until) has not passed, so a hold that
// lapses frees its units by itself, with or without a webhook.
import "server-only";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type Stripe from "stripe";
import { LIMITS, type Grind } from "@/config/shop";
import { holdRoomFor, priceLines, type PriceRefusal, type Priced, type StockedProduct } from "./pricing";
import type { CheckoutLineRequest } from "./request";
import { holdUntil, sessionOutcome } from "./session";

export type Db = NodePgDatabase<Record<string, unknown>>;
export type OrderStatus = "pending" | "paid" | "expired" | "cancelled";

class Refused extends Error {
  constructor(readonly refusal: PriceRefusal) {
    super(refusal.reason);
  }
}

export interface Reserved {
  ok: true;
  orderId: number;
  reference: string;
  priced: Priced;
  reservedUntil: Date;
  /** Stripe pages of this connection's earlier checkouts, cancelled here; the caller expires them at Stripe. */
  replacedSessionIds: string[];
}

/**
 * In one transaction: cancels this connection's earlier open checkout (one open checkout per connection),
 * locks the products, prices the lines from the database, checks free stock, and creates a pending order whose
 * units are held until Stripe's expiry plus the margin. `connection` is a salted hash, never an address.
 */
export async function reserveCheckout(
  db: Db,
  o: { lines: CheckoutLineRequest[]; connection: string; userId: string | null; expiresAt: Date },
): Promise<Reserved | PriceRefusal> {
  const reservedUntil = holdUntil(o.expiresAt);
  try {
    return await db.transaction(async (tx) => {
      // Two checkouts from the same connection at once wait for each other here.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${o.connection}, 0))`);

      // The connection's open checkouts are marked in rate_limits as "<connection hash>:<order id>".
      const open = await tx.execute<{ id: number; stripe_session_id: string | null }>(sql`
        select o.id, o.stripe_session_id from rate_limits r
        join orders o on r.key = ${o.connection} || ':' || o.id::text
        where r.key like ${`${o.connection}:%`} and o.status = 'pending'
        order by o.id desc`);
      const replaced = open.rows.slice(Math.max(0, LIMITS.openCheckoutsPerConnection - 1));
      if (replaced.length) {
        await tx.execute(sql`update orders set status = 'cancelled' where id in ${replaced.map((r) => Number(r.id))}`);
      }

      // Lock the rows so two visitors cannot both take the last units. Free stock is read in a second statement:
      // it starts after the lock is granted, so it sees holds that a visitor just ahead of us committed.
      const slugs = [...new Set(o.lines.map((l) => l.slug))];
      await tx.execute(sql`select id from products where slug in ${slugs} order by id for update`);
      const rows = await tx.execute<{ id: number; slug: string; name: string; category: StockedProduct["category"]; price_pence: number; active: boolean; stock: number; held: number }>(sql`
        select p.id, p.slug, p.name, p.category, p.price_pence, p.active, p.stock,
               coalesce((
                 select sum(oi.quantity) from order_items oi join orders od on od.id = oi.order_id
                 where oi.product_id = p.id and od.status = 'pending' and od.reserved_until > now()
               ), 0)::int as held
        from products p where p.slug in ${slugs}`);
      const products = new Map<string, StockedProduct>(
        rows.rows.map((r) => [
          r.slug,
          {
            id: Number(r.id),
            slug: r.slug,
            name: r.name,
            category: r.category,
            pricePence: r.price_pence,
            active: r.active,
            freeStock: r.stock - r.held,
            holdRoom: holdRoomFor(r.stock, r.held),
          },
        ]),
      );
      const priced = priceLines(o.lines, products);
      if (!priced.ok) throw new Refused(priced);

      const inserted = await tx.execute<{ id: number; reference: string }>(sql`
        insert into orders (user_id, status, subtotal_pence, delivery_pence, total_pence, reserved_until)
        values (${o.userId}, 'pending', ${priced.subtotalPence}, ${priced.deliveryPence}, ${priced.totalPence}, ${reservedUntil.toISOString()})
        returning id, reference`);
      const order = inserted.rows[0]!;
      const orderId = Number(order.id);
      for (const l of priced.lines) {
        await tx.execute(sql`
          insert into order_items (order_id, product_id, name, unit_price_pence, quantity, grind)
          values (${orderId}, ${l.productId}, ${l.name}, ${l.unitPricePence}, ${l.quantity}, ${l.grind})`);
      }
      await tx.execute(sql`
        insert into rate_limits (key, window_start, count) values (${`${o.connection}:${orderId}`}, ${reservedUntil.toISOString()}, 1)`);
      return {
        ok: true as const,
        orderId,
        reference: order.reference,
        priced,
        reservedUntil,
        replacedSessionIds: replaced.flatMap((r) => (r.stripe_session_id ? [r.stripe_session_id] : [])),
      };
    });
  } catch (e) {
    if (e instanceof Refused) return e.refusal;
    throw e;
  }
}

export async function attachSession(db: Db, orderId: number, sessionId: string): Promise<void> {
  await db.execute(sql`update orders set stripe_session_id = ${sessionId} where id = ${orderId}`);
}

/** Releases a hold whose Stripe page could not be created. */
export async function abandonOrder(db: Db, orderId: number): Promise<void> {
  await db.execute(sql`update orders set status = 'cancelled' where id = ${orderId} and status = 'pending'`);
}

/**
 * Marks the order paid and takes its units off stock, exactly once: the status change and the stock change share
 * a transaction, and a second call (webhook and order page together, or a retry) finds the order already paid.
 * Returns true only for the call that made the change.
 */
export async function markPaid(db: Db, sessionId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute<{ id: number }>(sql`
      update orders set status = 'paid', paid_at = now()
      where stripe_session_id = ${sessionId} and status <> 'paid' returning id`);
    if (!rows.length) return false;
    // Never below zero (the stock check constraint); a payment that lands after its hold lapsed still counts.
    await tx.execute(sql`
      update products p set stock = greatest(p.stock - i.quantity, 0), updated_at = now()
      from (select product_id, sum(quantity)::int as quantity from order_items where order_id = ${Number(rows[0]!.id)} group by product_id) i
      where p.id = i.product_id`);
    // A product a paid order sells out goes straight back to its seed level, so one visitor cannot leave the demo
    // empty until the nightly restock. Products seeded at 0 (shown as sold out on purpose) stay at 0.
    await tx.execute(sql`update products set stock = seed_stock, updated_at = now() where stock = 0 and seed_stock > 0`);
    return true;
  });
}

/** Ends a pending order's hold (Stripe page expired, or the visitor cancelled). Paid orders are never touched. */
export async function releaseHold(db: Db, sessionId: string, status: "expired" | "cancelled"): Promise<boolean> {
  const { rows } = await db.execute(sql`update orders set status = ${status} where stripe_session_id = ${sessionId} and status = 'pending' returning id`);
  return rows.length > 0;
}

/**
 * Applies what Stripe says about a session to its order: paid, expired, or nothing yet. Shared by the order page,
 * the cancel route and the webhook, so all three follow the same rules. Returns the order's status afterwards.
 */
export async function settleSession(
  db: Db,
  session: Pick<Stripe.Checkout.Session, "id" | "livemode" | "status" | "payment_status" | "amount_total" | "currency" | "metadata">,
): Promise<OrderStatus | null> {
  const { rows } = await db.execute<{ reference: string; total_pence: number; status: OrderStatus }>(
    sql`select reference, total_pence, status from orders where stripe_session_id = ${session.id}`,
  );
  const order = rows[0];
  if (!order) return null;
  const outcome = sessionOutcome(session, { reference: order.reference, totalPence: order.total_pence });
  if (outcome === "paid") {
    await markPaid(db, session.id);
    return "paid";
  }
  if (outcome === "expired" && (await releaseHold(db, session.id, "expired"))) return "expired";
  return order.status;
}

export interface OrderView {
  id: number;
  reference: string;
  status: OrderStatus;
  subtotalPence: number;
  deliveryPence: number;
  totalPence: number;
  stripeSessionId: string | null;
  reservedUntil: Date;
  createdAt: Date;
  paidAt: Date | null;
  lines: { slug: string; name: string; grind: Grind | null; quantity: number; unitPricePence: number }[];
}

export async function findOrder(db: Db, reference: string): Promise<OrderView | null> {
  const { rows } = await db.execute<{
    id: number;
    reference: string;
    status: OrderStatus;
    subtotal_pence: number;
    delivery_pence: number;
    total_pence: number;
    stripe_session_id: string | null;
    reserved_until: string | Date;
    created_at: string | Date;
    paid_at: string | Date | null;
  }>(sql`select id, reference, status, subtotal_pence, delivery_pence, total_pence, stripe_session_id, reserved_until, created_at, paid_at
         from orders where reference = ${reference}`);
  const o = rows[0];
  if (!o) return null;
  const items = await db.execute<{ slug: string; name: string; grind: Grind | null; quantity: number; unit_price_pence: number }>(sql`
    select p.slug, oi.name, oi.grind, oi.quantity, oi.unit_price_pence
    from order_items oi join products p on p.id = oi.product_id where oi.order_id = ${Number(o.id)} order by oi.id`);
  return {
    id: Number(o.id),
    reference: o.reference,
    status: o.status,
    subtotalPence: o.subtotal_pence,
    deliveryPence: o.delivery_pence,
    totalPence: o.total_pence,
    stripeSessionId: o.stripe_session_id,
    reservedUntil: new Date(o.reserved_until),
    createdAt: new Date(o.created_at),
    paidAt: o.paid_at ? new Date(o.paid_at) : null,
    lines: items.rows.map((i) => ({ slug: i.slug, name: i.name, grind: i.grind, quantity: i.quantity, unitPricePence: i.unit_price_pence })),
  };
}

/** Nightly: pending orders whose hold has passed become expired (their units were already free). */
export async function expireStaleOrders(db: Db): Promise<number> {
  const { rows } = await db.execute(sql`update orders set status = 'expired' where status = 'pending' and reserved_until < now() returning id`);
  return rows.length;
}

/** Nightly: every product back to its seed stock, so visitors cannot empty the demo for good. */
export async function restockToSeed(db: Db): Promise<number> {
  const { rows } = await db.execute(sql`update products set stock = seed_stock, updated_at = now() where stock <> seed_stock returning id`);
  return rows.length;
}
