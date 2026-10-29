// What the basket's Checkout button sends: product slug, grind and quantity for each line, nothing else.
// Names and prices from the browser are dropped here; the server prices every line from the database.
import { GRINDS, LIMITS, type Grind } from "@/config/shop";

export interface CheckoutLineRequest {
  slug: string;
  grind: Grind | null;
  quantity: number;
}

export type ParsedRequest =
  | { ok: true; lines: CheckoutLineRequest[]; returnTo: string }
  | { ok: false; reason: "malformed" | "empty" | "too-many-lines" | "too-many-units" | "quantity" | "duplicate" };

const SLUG = /^[a-z0-9-]{1,80}$/;

export function parseCheckoutRequest(body: unknown): ParsedRequest {
  if (!body || typeof body !== "object") return { ok: false, reason: "malformed" };
  const { lines, returnTo } = body as { lines?: unknown; returnTo?: unknown };
  if (!Array.isArray(lines)) return { ok: false, reason: "malformed" };
  if (lines.length === 0) return { ok: false, reason: "empty" };
  if (lines.length > LIMITS.maxLinesPerCheckout) return { ok: false, reason: "too-many-lines" };

  const out: CheckoutLineRequest[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    if (!raw || typeof raw !== "object") return { ok: false, reason: "malformed" };
    const { slug, grind, quantity } = raw as Record<string, unknown>;
    if (typeof slug !== "string" || !SLUG.test(slug)) return { ok: false, reason: "malformed" };
    if (grind !== null && !(GRINDS as readonly unknown[]).includes(grind)) return { ok: false, reason: "malformed" };
    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > LIMITS.maxQuantityPerLine) {
      return { ok: false, reason: "quantity" };
    }
    const key = `${slug}:${grind ?? "none"}`;
    if (seen.has(key)) return { ok: false, reason: "duplicate" };
    seen.add(key);
    out.push({ slug, grind: grind as Grind | null, quantity: quantity as number });
  }
  if (out.reduce((n, l) => n + l.quantity, 0) > LIMITS.maxUnitsPerCheckout) return { ok: false, reason: "too-many-units" };
  return { ok: true, lines: out, returnTo: safeReturnPath(returnTo) };
}

/** A path on this site to send the visitor back to after a cancelled checkout; anything else becomes the home page. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 300) return "/";
  // One leading slash, then no second slash or backslash (which browsers read as another site), no order pages.
  if (!/^\/(?![/\\])[^\s\\]*$/.test(value) || value.startsWith("/order/") || value.startsWith("/api/")) return "/";
  return value;
}
