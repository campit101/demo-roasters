// Search limits on top of the shared limiter (src/lib/rate-limit.ts): each connection may search
// LIMITS.searchesPerMinutePerConnection times a minute; everyone together gets LIMITS.searchesPerDay searches
// with the meaning model per London day, and one connection at most LIMITS.meaningSearchesPerDayPerConnection of
// them; past either, search carries on with keywords only. Never raised.
import { LIMITS } from "@/config/shop";
import { ipGroup, limitKey, type Limit } from "@/lib/rate-limit";

export { ipGroup };

/** Same shape as `consume` in src/lib/rate-limit.ts with the database already supplied. */
export type Consume = (key: string, limit: Limit, now: Date) => Promise<{ allowed: boolean; retryAfterSeconds: number }>;

export type Allowance = { allowed: false; retryAfterSeconds: number } | { allowed: true; meaning: boolean };

/** The time as a London wall clock, written as if it were UTC, so fixed daily windows start at London midnight. */
export function londonWallClock(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const n = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"), now.getUTCMilliseconds()));
}

export async function searchAllowance({
  address,
  consume,
  now = new Date(),
  salt = process.env.IP_HASH_SALT,
}: {
  address: string;
  consume: Consume;
  now?: Date;
  salt?: string;
}): Promise<Allowance> {
  const mine = await consume(limitKey("search", ipGroup(address), salt), { max: LIMITS.searchesPerMinutePerConnection, windowSeconds: 60 }, now);
  if (!mine.allowed) return { allowed: false, retryAfterSeconds: mine.retryAfterSeconds };
  const today = londonWallClock(now);
  const share = await consume(limitKey("search-day", ipGroup(address), salt), { max: LIMITS.meaningSearchesPerDayPerConnection, windowSeconds: 86_400 }, today);
  if (!share.allowed) return { allowed: true, meaning: false };
  const day = await consume(limitKey("search-day", "everyone", salt), { max: LIMITS.searchesPerDay, windowSeconds: 86_400 }, today);
  return { allowed: true, meaning: day.allowed };
}
