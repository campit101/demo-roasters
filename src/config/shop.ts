// Every tunable number and fixed identifier for the shop lives here.
// Identifiers below are not secrets; connection strings and keys live only in .env.local and Vercel.

export const DEMO_BANNER = "Demo store: test payments only, nothing is sold";

export const NEON = {
  org: "org-blue-credit-29191553",
  region: "aws-eu-west-2",
  test: { project: "lucky-lab-11893817", endpoint: "ep-solitary-fog-zaopkwxt" },
  live: { project: "purple-salad-00882314", endpoint: "ep-flat-bonus-zakk15sg" },
} as const;

// Pretend delivery shown before checkout (nothing is ever posted). Whole pence.
export const DELIVERY = {
  flatPence: 395,
  freeFromPence: 3000,
} as const;

// How a coffee can be ground (product page chips; carried into the basket line). Same price for all.
export const GRINDS = ["whole-bean", "espresso", "filter", "cafetiere", "moka-pot"] as const;
export type Grind = (typeof GRINDS)[number];
export const GRIND_LABEL: Record<Grind, string> = {
  "whole-bean": "Whole bean",
  espresso: "Espresso",
  filter: "Filter",
  cafetiere: "Cafetière",
  "moka-pot": "Moka pot",
};

// Abuse limits. Searches and sign-ups are per connection; the daily search ceiling is shared by everyone
// and is never raised (CONSTRAINTS.md, "Cost and abuse rules").
export const LIMITS = {
  searchesPerMinutePerConnection: 20,
  searchesPerDay: 2000,
  /** One connection's share of the daily meaning-model searches, so one visitor cannot use up everyone's day. */
  meaningSearchesPerDayPerConnection: 100,
  signUpsPerHourPerConnection: 5,
  signInsPerHourPerConnection: 20,
  /** Wrong-password guesses at one account, from anywhere, per hour. */
  signInsPerHourPerEmail: 10,
  /** Order pages that ask Stripe about an unpaid order, per connection per hour (reloads beyond this just show the saved status). */
  orderChecksPerHourPerConnection: 30,
  checkoutsPerHourPerConnection: 10,
  maxQuantityPerLine: 3,
  /** One product across all its grinds, per order; and all units in one order (T11: one visitor cannot buy the shop out). */
  maxQuantityPerProduct: 3,
  maxUnitsPerCheckout: 6,
  openCheckoutsPerConnection: 1,
  /** Lines one checkout may hold (the saved basket keeps at most this many too). */
  maxLinesPerCheckout: 20,
  accountRetentionDays: 30,
  /** Unpaid orders (expired or cancelled checkouts) are deleted after this many days; paid test orders after a year. */
  unpaidOrderRetentionDays: 30,
  paidOrderRetentionDays: 365,
  /** Search records hold no personal details (counts and timings only); kept for the dashboard, then deleted. */
  searchEventRetentionDays: 90,
} as const;

// Accounts (T6). Passwords are checked by length only (no emails are ever sent, so no resets).
export const ACCOUNTS = {
  passwordMinLength: 10,
  passwordMaxLength: 128,
  /** Days a signed-in session lasts. */
  sessionDays: 7,
} as const;

// Demo accounts, shown on the sign-in page so portfolio visitors can try them. Not secrets: anyone may use them,
// and they cannot be changed or deleted. The viewer (read-only admin, T8) is created the same way.
export const DEMO_ACCOUNTS = {
  customer: { email: "customer@demo-roasters.example", password: "try-the-demo-shop", name: "Demo customer" },
  viewer: { email: "viewer@demo-roasters.example", password: "look-but-dont-touch", name: "Demo viewer" },
} as const;

// Stripe Checkout, sandbox (test mode) only. Visitors' real emails are never collected: Stripe's page is
// prefilled with this made-up address (example.com is reserved for examples and receives no mail).
export const CHECKOUT = {
  demoEmail: "demo-customer@example.com",
  currency: "gbp",
  /** Stripe's minimum is 30 minutes after creation; one more minute so network delay never takes it under. */
  sessionMinutes: 31,
  /** Stock stays held this long after Stripe's page expires, so a payment finishing at the last second still has its units. */
  holdMarginMinutes: 5,
  /** Share of a product's stock that unfinished checkouts may hold at once, so holds can never take everything. */
  maxHeldShare: 0.5,
  /** Stripe's published test card, shown on the order pages so portfolio visitors can try a purchase. */
  testCard: "4242 4242 4242 4242",
} as const;
