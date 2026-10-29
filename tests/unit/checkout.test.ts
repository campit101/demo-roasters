import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { CHECKOUT, DELIVERY, LIMITS } from "@/config/shop";
import { refusalMessage } from "@/checkout/messages";
import { holdRoomFor, priceLines, type StockedProduct } from "@/checkout/pricing";
import { parseCheckoutRequest, safeReturnPath } from "@/checkout/request";
import { buildSessionParams, holdUntil, isReference, sessionExpiry, sessionOutcome } from "@/checkout/session";
import { createStripe } from "@/checkout/stripe";
import { handleStripeWebhook } from "@/checkout/webhook";

const coffee: StockedProduct = { id: 1, slug: "hillside-sunrise", name: "Hillside Sunrise", category: "beans", pricePence: 1150, active: true, freeStock: 10 };
const kettle: StockedProduct = { id: 2, slug: "gooseneck-kettle", name: "Stovetop Gooseneck Kettle", category: "gear", pricePence: 3400, active: true, freeStock: 4 };
const catalogue = new Map([coffee, kettle].map((p) => [p.slug, p]));

describe("checkout request", () => {
  const line = { slug: "hillside-sunrise", grind: "filter", quantity: 2 };

  it("keeps only slug, grind and quantity (any price the browser sends is ignored)", () => {
    const r = parseCheckoutRequest({ lines: [{ ...line, pricePence: 1, name: "Free coffee" }], returnTo: "/shop/coffee" });
    expect(r).toEqual({ ok: true, lines: [{ slug: "hillside-sunrise", grind: "filter", quantity: 2 }], returnTo: "/shop/coffee" });
  });

  it("refuses an empty or malformed basket", () => {
    expect(parseCheckoutRequest({ lines: [] })).toEqual({ ok: false, reason: "empty" });
    expect(parseCheckoutRequest(null)).toEqual({ ok: false, reason: "malformed" });
    expect(parseCheckoutRequest({ lines: "x" })).toEqual({ ok: false, reason: "malformed" });
    expect(parseCheckoutRequest({ lines: [{ ...line, slug: "<script>" }] })).toEqual({ ok: false, reason: "malformed" });
    expect(parseCheckoutRequest({ lines: [{ ...line, grind: "powder" }] })).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses quantities above the per-line cap, below one, or not whole", () => {
    for (const quantity of [LIMITS.maxQuantityPerLine + 1, 0, -1, 1.5, "2"]) {
      expect(parseCheckoutRequest({ lines: [{ ...line, quantity }] })).toEqual({ ok: false, reason: "quantity" });
    }
    expect(parseCheckoutRequest({ lines: [{ ...line, quantity: LIMITS.maxQuantityPerLine }] }).ok).toBe(true);
  });
  it("refuses more than 6 units in one order", () => {
    const lines = ["filter", "espresso", "cafetiere"].map((grind, i) => ({ slug: `coffee-${i}`, grind, quantity: 3 }));
    expect(parseCheckoutRequest({ lines })).toEqual({ ok: false, reason: "too-many-units" });
    expect(parseCheckoutRequest({ lines: lines.slice(0, 2) }).ok).toBe(true);
  });


  it("refuses more lines than allowed, and the same line twice", () => {
    const many = Array.from({ length: LIMITS.maxLinesPerCheckout + 1 }, (_, i) => ({ slug: `coffee-${i}`, grind: null, quantity: 1 }));
    expect(parseCheckoutRequest({ lines: many })).toEqual({ ok: false, reason: "too-many-lines" });
    expect(parseCheckoutRequest({ lines: [line, line] })).toEqual({ ok: false, reason: "duplicate" });
    expect(parseCheckoutRequest({ lines: [line, { ...line, grind: "espresso" }] }).ok).toBe(true);
  });

  it("only returns visitors to a page on this site", () => {
    expect(safeReturnPath("/shop/coffee?taste=fruity")).toBe("/shop/coffee?taste=fruity");
    for (const bad of ["//evil.example", "https://evil.example/", "/\\evil.example", "javascript:alert(1)", "", undefined, 42, "/order/x"]) {
      expect(safeReturnPath(bad), String(bad)).toBe("/");
    }
  });
});

describe("pricing", () => {
  it("prices every line from the database, never from the browser", () => {
    const r = priceLines([{ slug: "hillside-sunrise", grind: "filter", quantity: 2 }], catalogue);
    expect(r).toMatchObject({ ok: true, subtotalPence: 2300, lines: [{ productId: 1, name: "Hillside Sunrise", unitPricePence: 1150, quantity: 2, grind: "filter" }] });
  });

  it("charges flat delivery below the free threshold and none from it", () => {
    const below = priceLines([{ slug: "hillside-sunrise", grind: "filter", quantity: 1 }], catalogue);
    expect(below).toMatchObject({ ok: true, deliveryPence: DELIVERY.flatPence, totalPence: 1150 + DELIVERY.flatPence });
    const above = priceLines([{ slug: "gooseneck-kettle", grind: null, quantity: 1 }], catalogue);
    expect(above).toMatchObject({ ok: true, subtotalPence: 3400, deliveryPence: 0, totalPence: 3400 });
    expect(3400).toBeGreaterThanOrEqual(DELIVERY.freeFromPence);
  });

  it("refuses unknown and inactive products", () => {
    expect(priceLines([{ slug: "no-such-coffee", grind: null, quantity: 1 }], catalogue)).toEqual({ ok: false, reason: "unavailable", slug: "no-such-coffee" });
    const inactive = new Map([["hillside-sunrise", { ...coffee, active: false }]]);
    expect(priceLines([{ slug: "hillside-sunrise", grind: "filter", quantity: 1 }], inactive)).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("needs a grind for coffee and refuses one for gear", () => {
    expect(priceLines([{ slug: "hillside-sunrise", grind: null, quantity: 1 }], catalogue)).toMatchObject({ ok: false, reason: "grind" });
    expect(priceLines([{ slug: "gooseneck-kettle", grind: "filter", quantity: 1 }], catalogue)).toMatchObject({ ok: false, reason: "grind" });
  });

  it("refuses sold-out products and more than the free stock, counting every grind of one coffee together", () => {
    const sold = new Map([["hillside-sunrise", { ...coffee, freeStock: 0 }]]);
    expect(priceLines([{ slug: "hillside-sunrise", grind: "filter", quantity: 1 }], sold)).toEqual({ ok: false, reason: "sold-out", slug: "hillside-sunrise", name: "Hillside Sunrise", available: 0 });
    const few = new Map([["hillside-sunrise", { ...coffee, freeStock: 4 }]]);
    const lines = [
      { slug: "hillside-sunrise", grind: "filter" as const, quantity: 3 },
      { slug: "hillside-sunrise", grind: "espresso" as const, quantity: 2 },
    ];
    expect(priceLines(lines, few)).toEqual({ ok: false, reason: "short", slug: "hillside-sunrise", name: "Hillside Sunrise", available: 4 });
    expect(priceLines(lines.slice(0, 1), few).ok).toBe(true);
  });
  it("caps one product at 3 units per order across all its grinds", () => {
    const r = priceLines(
      [
        { slug: "hillside-sunrise", grind: "filter", quantity: 2 },
        { slug: "hillside-sunrise", grind: "espresso", quantity: 2 },
      ],
      catalogue,
    );
    expect(r).toMatchObject({ ok: false, reason: "per-product", slug: "hillside-sunrise", name: "Hillside Sunrise" });
  });

  it("refuses a product whose stock is already half held by other checkouts, so nobody can hold everything", () => {
    const busy = new Map([["hillside-sunrise", { ...coffee, freeStock: 10, holdRoom: 1 }]]);
    expect(priceLines([{ slug: "hillside-sunrise", grind: "filter", quantity: 2 }], busy)).toMatchObject({ ok: false, reason: "busy", slug: "hillside-sunrise" });
    expect(priceLines([{ slug: "hillside-sunrise", grind: "filter", quantity: 1 }], busy).ok).toBe(true);
    expect(holdRoomFor(18, 0)).toBe(9);
    expect(holdRoomFor(18, 9)).toBe(0);
    expect(holdRoomFor(1, 0)).toBe(1);
    expect(holdRoomFor(5, 0)).toBe(3);
  });


  it("says what went wrong in plain words", () => {
    expect(refusalMessage({ reason: "short", name: "Hillside Sunrise", available: 2 })).toBe("Only 2 of Hillside Sunrise left. Lower the quantity to continue.");
    expect(refusalMessage({ reason: "sold-out", name: "Hillside Sunrise", available: 0 })).toBe("Hillside Sunrise has just sold out. Remove it to continue.");
    expect(refusalMessage({ reason: "rate-limited" })).toMatch(/too many checkouts/i);
    for (const reason of ["malformed", "empty", "quantity", "too-many-lines", "duplicate", "unavailable", "grind", "stripe", "origin"] as const) {
      expect(refusalMessage({ reason })).not.toBe("");
    }
  });
});

describe("Stripe Checkout session", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const priced = priceLines(
    [
      { slug: "hillside-sunrise", grind: "espresso", quantity: 2 },
      { slug: "gooseneck-kettle", grind: null, quantity: 1 },
    ],
    catalogue,
  );
  if (!priced.ok) throw new Error("fixture");
  const small = priceLines([{ slug: "hillside-sunrise", grind: "filter", quantity: 1 }], catalogue);
  if (!small.ok) throw new Error("fixture");
  const reference = "3f2a9c1b-1111-4222-8333-444455556666";
  const params = (p = priced) => buildSessionParams({ reference, priced: p, origin: "http://localhost:3400", returnTo: "/shop/coffee", expiresAt: sessionExpiry(now) });

  it("is a card-only payment in pounds with the fake demo email, never the visitor's own", () => {
    const s = params();
    expect(s.mode).toBe("payment");
    expect(s.allowed_payment_method_types).toEqual(["card"]);
    expect(s.managed_payments).toEqual({ enabled: false });
    expect(s.customer_email).toBe(CHECKOUT.demoEmail);
    expect(s.customer_email).toMatch(/@example\.com$/);
    expect(s.line_items?.every((l) => l.price_data?.currency === "gbp")).toBe(true);
    expect(s.client_reference_id).toBe(reference);
    expect(s.metadata).toEqual({ order_reference: reference });
  });

  it("uses the database prices and shows the grind", () => {
    const [beans, kit] = params().line_items!;
    expect(beans).toMatchObject({ quantity: 2, price_data: { unit_amount: 1150, product_data: { name: "Hillside Sunrise", description: "Ground for espresso" } } });
    expect(kit).toMatchObject({ quantity: 1, price_data: { unit_amount: 3400, product_data: { name: "Stovetop Gooseneck Kettle" } } });
    expect(kit!.price_data!.product_data!.description).toBeUndefined();
  });

  it("adds delivery as its own line only when it is charged, so Stripe's total matches the order", () => {
    expect(params().line_items).toHaveLength(2);
    const lines = params(small).line_items!;
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ quantity: 1, price_data: { unit_amount: DELIVERY.flatPence, currency: "gbp" } });
    const total = lines.reduce((n, l) => n + l.price_data!.unit_amount! * l.quantity!, 0);
    expect(total).toBe(small.totalPence);
  });

  it("returns to the order page on success and to the shop with the basket kept on cancel", () => {
    const s = params();
    expect(s.success_url).toBe(`http://localhost:3400/order/${reference}`);
    expect(s.cancel_url).toBe(`http://localhost:3400/api/checkout/cancel?ref=${reference}&back=%2Fshop%2Fcoffee`);
  });

  it("expires within Stripe's allowed window and holds stock five minutes longer", () => {
    const expires = sessionExpiry(now);
    const minutes = (expires.getTime() - now.getTime()) / 60_000;
    expect(minutes).toBeGreaterThanOrEqual(30);
    expect(minutes).toBeLessThanOrEqual(24 * 60);
    expect(params().expires_at).toBe(Math.floor(expires.getTime() / 1000));
    expect(holdUntil(expires).getTime() - expires.getTime()).toBe(CHECKOUT.holdMarginMinutes * 60_000);
  });

  it("only treats unguessable references as order addresses", () => {
    expect(isReference(reference)).toBe(true);
    expect(isReference("1")).toBe(false);
    expect(isReference("../admin")).toBe(false);
  });
});

describe("deciding whether an order is paid", () => {
  const order = { reference: "3f2a9c1b-1111-4222-8333-444455556666", totalPence: 1545 };
  const session = (over: Partial<Stripe.Checkout.Session> = {}) =>
    ({
      id: "cs_test_1",
      livemode: false,
      status: "complete",
      payment_status: "paid",
      amount_total: 1545,
      currency: "gbp",
      metadata: { order_reference: order.reference },
      ...over,
    }) as Stripe.Checkout.Session;

  it("is paid only when Stripe says complete and paid for the same order and amount", () => {
    expect(sessionOutcome(session(), order)).toBe("paid");
    expect(sessionOutcome(session({ payment_status: "unpaid" }), order)).toBe("open");
    expect(sessionOutcome(session({ status: "open", payment_status: "unpaid" }), order)).toBe("open");
    expect(sessionOutcome(session({ status: "expired", payment_status: "unpaid" }), order)).toBe("expired");
  });

  it("refuses live sessions, other orders' sessions, other amounts and other currencies", () => {
    expect(sessionOutcome(session({ livemode: true }), order)).toBe("refused");
    expect(sessionOutcome(session({ metadata: { order_reference: "someone-else" } }), order)).toBe("refused");
    expect(sessionOutcome(session({ amount_total: 1 }), order)).toBe("refused");
    expect(sessionOutcome(session({ currency: "usd" }), order)).toBe("refused");
  });
});

describe("Stripe client", () => {
  it("refuses any key that is not a test key", () => {
    expect(() => createStripe("sk_live_abc123")).toThrow(/not a test key/);
    expect(() => createStripe(undefined)).toThrow(/missing/);
    expect(createStripe("sk_test_abc123")).toBeInstanceOf(Stripe);
  });
});

describe("Stripe webhook", () => {
  const secret = "whsec_unit_test_secret";
  const event = (type: string, livemode = false) =>
    JSON.stringify({ id: "evt_1", object: "event", type, livemode, data: { object: { id: "cs_test_1", object: "checkout.session" } } });
  const signed = (payload: string, key = secret) => Stripe.webhooks.generateTestHeaderString({ payload, secret: key });
  const deps = () => ({ onPaid: vi.fn(async () => {}), onExpired: vi.fn(async () => {}) });

  it("refuses requests without a signature, with a wrong signature, or when no secret is set", async () => {
    const d = deps();
    const body = event("checkout.session.completed");
    expect((await handleStripeWebhook(body, null, secret, d)).status).toBe(400);
    expect((await handleStripeWebhook(body, signed(body, "whsec_wrong"), secret, d)).status).toBe(400);
    expect((await handleStripeWebhook(body, "t=1,v1=deadbeef", secret, d)).status).toBe(400);
    expect((await handleStripeWebhook(body, signed(body), undefined, d)).status).toBe(503);
    const tampered = body.replace("cs_test_1", "cs_test_2");
    expect((await handleStripeWebhook(tampered, signed(body), secret, d)).status).toBe(400);
    expect(d.onPaid).not.toHaveBeenCalled();
  });

  it("refuses live events even when signed", async () => {
    const d = deps();
    const body = event("checkout.session.completed", true);
    expect((await handleStripeWebhook(body, signed(body), secret, d)).status).toBe(400);
    expect(d.onPaid).not.toHaveBeenCalled();
  });

  it("marks paid on completion, releases the hold on expiry and ignores other events", async () => {
    const d = deps();
    const done = event("checkout.session.completed");
    expect((await handleStripeWebhook(done, signed(done), secret, d)).status).toBe(200);
    expect(d.onPaid).toHaveBeenCalledWith(expect.objectContaining({ id: "cs_test_1" }));
    const gone = event("checkout.session.expired");
    expect((await handleStripeWebhook(gone, signed(gone), secret, d)).status).toBe(200);
    expect(d.onExpired).toHaveBeenCalledWith(expect.objectContaining({ id: "cs_test_1" }));
    const other = event("customer.created");
    expect((await handleStripeWebhook(other, signed(other), secret, d)).status).toBe(200);
    expect(d.onPaid).toHaveBeenCalledTimes(1);
  });
});
