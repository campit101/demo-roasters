// Database tables. Only the server ever connects; the browser never talks to the database.
// Money is whole pence (integer); times are timestamptz; allowed values are enforced by check constraints.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const EMBEDDING_DIMENSIONS = 384;

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const products = pgTable(
  "products",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    size: text("size").notNull(),
    pricePence: integer("price_pence").notNull(),
    roast: text("roast"),
    caffeine: text("caffeine"),
    origins: text("origins").array().notNull().default(sql`'{}'::text[]`),
    flavourNotes: text("flavour_notes").array().notNull().default(sql`'{}'::text[]`),
    brewMethods: text("brew_methods").array().notNull().default(sql`'{}'::text[]`),
    /** Units on hand. Free stock = stock minus units held by unexpired, unpaid checkouts. */
    stock: integer("stock").notNull(),
    /** Stock level the nightly job restores, so visitors cannot empty the demo for good. */
    seedStock: integer("seed_stock").notNull(),
    active: boolean("active").notNull().default(true),
    art: text("art").notNull(),
    /** Meaning vector from the embedding model, built from name, notes and description. */
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("products_category_check", sql`${t.category} in ('beans', 'gear', 'bundle')`),
    check("products_roast_check", sql`${t.roast} is null or ${t.roast} in ('light', 'medium', 'medium-dark', 'dark')`),
    check("products_caffeine_check", sql`${t.caffeine} is null or ${t.caffeine} in ('regular', 'decaf')`),
    check(
      "products_brew_methods_check",
      sql`${t.brewMethods} <@ array['espresso', 'pour-over', 'batch-brew', 'cafetiere', 'hand-press', 'moka-pot', 'cold-brew']::text[]`,
    ),
    check("products_price_check", sql`${t.pricePence} between 1 and 100000`),
    check("products_stock_check", sql`${t.stock} >= 0 and ${t.seedStock} >= 0`),
    check("products_text_length_check", sql`length(${t.name}) <= 80 and length(${t.description}) <= 600 and length(${t.slug}) <= 80`),
    index("products_category_idx").on(t.category),
  ],
);

// ── Accounts (Better Auth's tables, T6) ───────────────────────────────────────────────────────────
// Roles: "customer" for everyone who signs up; "viewer" (read-only demo admin) and "admin" are set only by user id
// with a one-off script, never by sign-up (CONSTRAINTS.md). Demo accounts are protected from change and deletion.
// Sessions keep no IP address (ip tracking is off): raw IP addresses are never stored.
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role").notNull().default("customer"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("user_role_check", sql`${t.role} in ('customer', 'viewer', 'admin')`),
    check("user_text_length_check", sql`length(${t.name}) <= 80 and length(${t.email}) <= 254`),
    index("user_created_at_idx").on(t.createdAt),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const orders = pgTable(
  "orders",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    /** Unguessable reference used in confirmation page addresses. */
    reference: uuid("reference").notNull().unique().defaultRandom(),
    /** Better Auth user id; null for a guest. Deleting an account keeps its orders but drops the link. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    subtotalPence: integer("subtotal_pence").notNull(),
    deliveryPence: integer("delivery_pence").notNull(),
    totalPence: integer("total_pence").notNull(),
    stripeSessionId: text("stripe_session_id").unique(),
    /** Stock is held for this order until this time (Stripe's session expiry plus a margin). */
    reservedUntil: timestamp("reserved_until", { withTimezone: true }).notNull(),
    /** Always false: this project never takes live payments. A check constraint makes it impossible. */
    livemode: boolean("livemode").notNull().default(false),
    createdAt: created(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    check("orders_status_check", sql`${t.status} in ('pending', 'paid', 'expired', 'cancelled')`),
    check("orders_livemode_check", sql`${t.livemode} = false`),
    check("orders_total_check", sql`${t.totalPence} = ${t.subtotalPence} + ${t.deliveryPence} and ${t.subtotalPence} >= 0 and ${t.deliveryPence} >= 0`),
    index("orders_user_id_idx").on(t.userId),
    index("orders_status_reserved_idx").on(t.status, t.reservedUntil),
    index("orders_created_at_idx").on(t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    orderId: bigint("order_id", { mode: "number" })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    unitPricePence: integer("unit_price_pence").notNull(),
    quantity: integer("quantity").notNull(),
    /** How a coffee was ground (GRINDS in src/config/shop.ts); null for gear and gift sets. */
    grind: text("grind"),
  },
  (t) => [
    check("order_items_quantity_check", sql`${t.quantity} between 1 and 3`),
    check("order_items_grind_check", sql`${t.grind} is null or ${t.grind} in ('whole-bean', 'espresso', 'filter', 'cafetiere', 'moka-pot')`),
    check("order_items_price_check", sql`${t.unitPricePence} > 0`),
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_product_id_idx").on(t.productId),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    /** Hash of the action and connection (never a raw IP address). */
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_window_idx").on(t.windowStart)],
);

export const searchEvents = pgTable(
  "search_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    createdAt: created(),
    resultCount: integer("result_count").notNull(),
    durationMs: integer("duration_ms").notNull(),
    /** Which layers understood the query, for example "parser+embedding" or "parser+keyword" (never the query text). */
    layer: text("layer").notNull(),
    /** Paid AI cost in millionths of a penny; 0 on the free path. */
    costMicropence: bigint("cost_micropence", { mode: "number" }).notNull().default(0),
  },
  (t) => [index("search_events_created_at_idx").on(t.createdAt)],
);
