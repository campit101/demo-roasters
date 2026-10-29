// Checkout against the TEST database: holds, free stock, paying exactly once, releases and the nightly job.
// The test database is shared, so every test removes the orders and rate-limit rows it made and puts stock back.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import Stripe from "stripe";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CHECKOUT, LIMITS } from "@/config/shop";
import { CHECKOUT_HOURLY } from "@/checkout/limits";
import { attachSession, expireStaleOrders, findOrder, markPaid, releaseHold, reserveCheckout, settleSession, type Reserved } from "@/checkout/orders";
import type { CheckoutLineRequest } from "@/checkout/request";
import { sessionExpiry } from "@/checkout/session";
import { handleStripeWebhook } from "@/checkout/webhook";
import { queryCatalogue } from "@/db/catalogue";
import { withVerifiedTls } from "@/db/url";
import { assertTestDatabaseUrl } from "@/lib/guards";
import { runNightly } from "@/lib/nightly";
import { consume, resetMemoryLimits } from "@/lib/rate-limit";
import { loadEnvLocal } from "../../scripts/env";

loadEnvLocal();
const pool = new pg.Pool({ connectionString: withVerifiedTls(assertTestDatabaseUrl(process.env.DATABASE_URL)), max: 4 });
const db = drizzle({ client: pool });

const run = `t7-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let n = 0;
const connection = () => `${run}-conn-${++n}`;
const orderIds: number[] = [];
let stockBefore = new Map<string, number>();

// Cloudline Reserve has 5 in stock (seeded); Hillside Sunrise 18; the kettle is gear (no grind).
const SLUGS = ["cloudline-reserve", "hillside-sunrise", "gooseneck-kettle"];

async function stockOf(slug: string) {
  const { rows } = await pool.query("select stock from products where slug = $1", [slug]);
  return rows[0].stock as number;
}
async function freeStockOf(slug: string) {
  return (await queryCatalogue(db)).find((p) => p.slug === slug)!.stock;
}
async function reserve(lines: CheckoutLineRequest[], conn = connection()) {
  const r = await reserveCheckout(db, { lines, connection: conn, userId: null, expiresAt: sessionExpiry(new Date()) });
  if (r.ok) orderIds.push(r.orderId);
  return r;
}
async function reserveOk(lines: CheckoutLineRequest[], conn?: string): Promise<Reserved> {
  const r = await reserve(lines, conn);
  if (!r.ok) throw new Error(`expected a hold, got ${r.reason}`);
  return r;
}
const fakeSession = (r: Reserved, over: Partial<Stripe.Checkout.Session> = {}) =>
  ({
    id: `cs_test_${run}_${r.orderId}`,
    object: "checkout.session",
    livemode: false,
    status: "complete",
    payment_status: "paid",
    amount_total: r.priced.totalPence,
    currency: CHECKOUT.currency,
    metadata: { order_reference: r.reference },
    ...over,
  }) as Stripe.Checkout.Session;
async function withSession(r: Reserved) {
  const s = fakeSession(r);
  await attachSession(db, r.orderId, s.id);
  return s;
}

beforeAll(async () => {
  const { rows } = await pool.query("select slug, stock from products where slug = any($1)", [SLUGS]);
  stockBefore = new Map(rows.map((r) => [r.slug as string, r.stock as number]));
  expect(stockBefore.get("cloudline-reserve"), "run npm run db:seed if stock has drifted").toBe(5);
});

afterEach(async () => {
  if (orderIds.length) await pool.query("delete from orders where id = any($1)", [orderIds.splice(0)]);
  await pool.query("delete from rate_limits where key like $1", [`${run}%`]);
  for (const [slug, stock] of stockBefore) await pool.query("update products set stock = $2 where slug = $1", [slug, stock]);
});

afterAll(() => pool.end());

describe("holding stock for a checkout", () => {
  it("creates a pending order priced from the database, with grinds, held until Stripe's expiry plus 5 minutes", async () => {
    const before = await freeStockOf("hillside-sunrise");
    const expiresAt = sessionExpiry(new Date());
    const r = await reserveCheckout(db, {
      lines: [
        { slug: "hillside-sunrise", grind: "espresso", quantity: 2 },
        { slug: "gooseneck-kettle", grind: null, quantity: 1 },
      ],
      connection: connection(),
      userId: null,
      expiresAt,
    });
    if (!r.ok) throw new Error(r.reason);
    orderIds.push(r.orderId);
    const order = (await findOrder(db, r.reference))!;
    expect(order.status).toBe("pending");
    expect(order.lines).toEqual([
      { slug: "hillside-sunrise", name: "Hillside Sunrise", grind: "espresso", quantity: 2, unitPricePence: 1150 },
      { slug: "gooseneck-kettle", name: "Stovetop Gooseneck Kettle", grind: null, quantity: 1, unitPricePence: 3200 },
    ]);
    expect(order.subtotalPence).toBe(5500);
    expect(order.deliveryPence).toBe(0);
    expect(order.reservedUntil.getTime()).toBe(expiresAt.getTime() + CHECKOUT.holdMarginMinutes * 60_000);
    expect(await freeStockOf("hillside-sunrise")).toBe(before - 2);
    expect(await stockOf("hillside-sunrise")).toBe(stockBefore.get("hillside-sunrise"));
  });

  it("refuses more than the free stock left after other visitors' holds, and sold-out products", async () => {
    await reserveOk([{ slug: "cloudline-reserve", grind: "filter", quantity: 3 }]);
    expect(await reserve([{ slug: "cloudline-reserve", grind: "espresso", quantity: 3 }])).toEqual({
      ok: false,
      reason: "short",
      slug: "cloudline-reserve",
      name: "Cloudline Reserve",
      available: 2,
    });
    expect(await reserve([{ slug: "thousand-hills", grind: "filter", quantity: 1 }])).toMatchObject({ ok: false, reason: "sold-out" });
    expect(await reserve([{ slug: "no-such-coffee", grind: "filter", quantity: 1 }])).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("lets only one of two visitors at the same moment take the last units", async () => {
    const results = await Promise.all([
      reserve([{ slug: "cloudline-reserve", grind: "filter", quantity: 3 }]),
      reserve([{ slug: "cloudline-reserve", grind: "filter", quantity: 3 }]),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ reason: "short", available: 2 });
  });

  it("keeps one open checkout per connection: a new one cancels the earlier one and frees its units", async () => {
    expect(LIMITS.openCheckoutsPerConnection).toBe(1);
    const conn = connection();
    const first = await reserveOk([{ slug: "cloudline-reserve", grind: "filter", quantity: 3 }], conn);
    const s = await withSession(first);
    const second = await reserveOk([{ slug: "cloudline-reserve", grind: "filter", quantity: 3 }], conn);
    expect(second.replacedSessionIds).toEqual([s.id]);
    expect((await findOrder(db, first.reference))!.status).toBe("cancelled");
    expect(await freeStockOf("cloudline-reserve")).toBe(2);
    // A different connection is not affected.
    const other = await reserveOk([{ slug: "hillside-sunrise", grind: "filter", quantity: 1 }]);
    expect(other.replacedSessionIds).toEqual([]);
  });

  it("frees held units by itself once the hold has passed, and the nightly job marks the order expired", async () => {
    const r = await reserveOk([{ slug: "cloudline-reserve", grind: "filter", quantity: 3 }]);
    expect(await freeStockOf("cloudline-reserve")).toBe(2);
    await pool.query("update orders set reserved_until = now() - interval '1 minute' where id = $1", [r.orderId]);
    expect(await freeStockOf("cloudline-reserve")).toBe(5);
    expect(await expireStaleOrders(db)).toBeGreaterThanOrEqual(1);
    expect((await findOrder(db, r.reference))!.status).toBe("expired");
  });

  it("caps one product per order, and lets open checkouts hold at most half a product's stock", async () => {
    expect(
      await reserve([
        { slug: "hillside-sunrise", grind: "espresso", quantity: 2 },
        { slug: "hillside-sunrise", grind: "filter", quantity: 2 },
      ]),
    ).toMatchObject({ ok: false, reason: "per-product", slug: "hillside-sunrise" });

    // Hillside Sunrise has 18: open checkouts may hold 9 between them, so a tenth unit waits for one to end.
    for (let i = 0; i < 3; i++) await reserveOk([{ slug: "hillside-sunrise", grind: "filter", quantity: 3 }]);
    expect(await freeStockOf("hillside-sunrise")).toBe(9);
    expect(await reserve([{ slug: "hillside-sunrise", grind: "filter", quantity: 1 }])).toMatchObject({ ok: false, reason: "busy", slug: "hillside-sunrise" });
  });
});

describe("restocking", () => {
  it("puts a product back to its seed level as soon as a paid order sells it out", async () => {
    await pool.query("update products set stock = 2 where slug = 'cloudline-reserve'");
    const r = await reserveOk([{ slug: "cloudline-reserve", grind: "filter", quantity: 1 }]);
    await markPaid(db, (await withSession(r)).id);
    expect(await stockOf("cloudline-reserve")).toBe(1);
    const last = await reserveOk([{ slug: "cloudline-reserve", grind: "filter", quantity: 1 }]);
    await markPaid(db, (await withSession(last)).id);
    expect(await stockOf("cloudline-reserve")).toBe(5);
    // Thousand Hills is sold out on purpose (seeded at 0) and stays that way.
    expect(await stockOf("thousand-hills")).toBe(0);
  });
});

describe("paying", () => {
  it("marks an order paid exactly once, even when the webhook and the order page arrive together", async () => {
    const r = await reserveOk([{ slug: "cloudline-reserve", grind: "filter", quantity: 2 }]);
    const s = await withSession(r);
    const results = await Promise.all([markPaid(db, s.id), markPaid(db, s.id), markPaid(db, s.id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await markPaid(db, s.id)).toBe(false);
    const order = (await findOrder(db, r.reference))!;
    expect(order.status).toBe("paid");
    expect(order.paidAt).not.toBeNull();
    expect(await stockOf("cloudline-reserve")).toBe(3);
    expect(await freeStockOf("cloudline-reserve")).toBe(3); // sold, no longer held
  });

  it("follows Stripe's word: paid, expired, or nothing when the session does not match the order", async () => {
    const r = await reserveOk([{ slug: "cloudline-reserve", grind: "filter", quantity: 1 }]);
    const s = await withSession(r);
    expect(await settleSession(db, { ...s, amount_total: 1 })).toBe("pending");
    expect(await settleSession(db, { ...s, livemode: true })).toBe("pending");
    expect(await settleSession(db, { ...s, status: "open", payment_status: "unpaid" })).toBe("pending");
    expect(await settleSession(db, s)).toBe("paid");
    expect(await settleSession(db, s)).toBe("paid");
    expect(await stockOf("cloudline-reserve")).toBe(4);

    // 2, not 3: with 4 left, open checkouts may hold at most 2 (half the stock).
    const gone = await reserveOk([{ slug: "cloudline-reserve", grind: "filter", quantity: 2 }]);
    const g = await withSession(gone);
    expect(await settleSession(db, { ...g, status: "expired", payment_status: "unpaid" })).toBe("expired");
    expect(await freeStockOf("cloudline-reserve")).toBe(4);
    expect(await settleSession(db, { ...s, id: "cs_test_unknown" })).toBeNull();
  });

  it("never reopens or re-pays a paid order when a release arrives late", async () => {
    const r = await reserveOk([{ slug: "hillside-sunrise", grind: "filter", quantity: 1 }]);
    const s = await withSession(r);
    await markPaid(db, s.id);
    expect(await releaseHold(db, s.id, "expired")).toBe(false);
    expect((await findOrder(db, r.reference))!.status).toBe("paid");
  });
});

describe("signed webhook events", () => {
  const secret = "whsec_integration_test";
  const handlers = {
    onPaid: async (session: Stripe.Checkout.Session) => void (await settleSession(db, session)),
    onExpired: async (session: Stripe.Checkout.Session) => void (await settleSession(db, session)),
  };
  const send = (type: string, session: Stripe.Checkout.Session, key = secret) => {
    const payload = JSON.stringify({ id: `evt_${run}`, object: "event", type, livemode: false, data: { object: session } });
    return handleStripeWebhook(payload, Stripe.webhooks.generateTestHeaderString({ payload, secret: key }), secret, handlers);
  };

  it("checkout.session.completed marks the order paid; a wrongly signed one changes nothing", async () => {
    const r = await reserveOk([{ slug: "cloudline-reserve", grind: "filter", quantity: 1 }]);
    const s = await withSession(r);
    expect((await send("checkout.session.completed", s, "whsec_wrong")).status).toBe(400);
    expect((await findOrder(db, r.reference))!.status).toBe("pending");
    expect((await send("checkout.session.completed", s)).status).toBe(200);
    expect((await send("checkout.session.completed", s)).status).toBe(200); // Stripe retries are harmless
    expect((await findOrder(db, r.reference))!.status).toBe("paid");
    expect(await stockOf("cloudline-reserve")).toBe(4);
  });

  it("checkout.session.expired releases the hold", async () => {
    const r = await reserveOk([{ slug: "cloudline-reserve", grind: "filter", quantity: 3 }]);
    const s = await withSession(r);
    expect((await send("checkout.session.expired", { ...s, status: "expired", payment_status: "unpaid" })).status).toBe(200);
    expect((await findOrder(db, r.reference))!.status).toBe("expired");
    expect(await freeStockOf("cloudline-reserve")).toBe(5);
  });
});

describe("limits and the nightly job", () => {
  it("refuses checkouts past the hourly limit for one connection", async () => {
    const key = `${run}-hourly`;
    const now = new Date();
    for (let i = 0; i < CHECKOUT_HOURLY.max; i++) {
      resetMemoryLimits();
      expect((await consume(db, key, CHECKOUT_HOURLY, now)).allowed).toBe(true);
    }
    resetMemoryLimits();
    expect((await consume(db, key, CHECKOUT_HOURLY, now)).allowed).toBe(false);
  });

  it("restocks every product to its seed level", async () => {
    await pool.query("update products set stock = 1 where slug = 'hillside-sunrise'");
    const { report, failed } = await runNightly(db);
    expect(failed).toEqual({});
    expect(report["restock to seed levels"]).toBeGreaterThanOrEqual(1);
    const { rows } = await pool.query("select stock, seed_stock from products where slug = 'hillside-sunrise'");
    expect(rows[0].stock).toBe(rows[0].seed_stock);
  });

  it("deletes unpaid orders after 30 days and paid ones after a year, and keeps newer ones", async () => {
    const make = async (status: string, ageDays: number) => {
      const r = await reserveOk([{ slug: "hillside-sunrise", grind: "filter", quantity: 1 }]);
      await pool.query("update orders set status = $2, created_at = now() - make_interval(days => $3) where id = $1", [r.orderId, status, ageDays]);
      return r.orderId;
    };
    const gone = [await make("expired", 31), await make("cancelled", 40), await make("paid", 366)];
    const kept = [await make("expired", 29), await make("paid", 364)];
    const { failed } = await runNightly(db);
    expect(failed).toEqual({});
    const { rows } = await pool.query<{ id: number }>("select id from orders where id = any($1) order by id", [[...gone, ...kept]]);
    expect(rows.map((r) => Number(r.id))).toEqual(kept);
  });

  it("carries on with the other steps when one fails, and reports it", async () => {
    const steps = [
      { name: "broken", run: async () => Promise.reject(new Error("boom")) },
      { name: "works", run: async () => 7 },
    ];
    expect(await runNightly(db, new Date(), steps)).toEqual({ report: { broken: null, works: 7 }, failed: { broken: "boom" } });
  });
});
