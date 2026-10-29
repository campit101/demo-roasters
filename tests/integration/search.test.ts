// The whole search flow against the TEST database and the real meaning model. Every write happens inside a
// transaction that is rolled back, so the shared daily counter and search_events are left as they were.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { LIMITS } from "@/config/shop";
import { withVerifiedTls } from "@/db/url";
import { assertTestDatabaseUrl } from "@/lib/guards";
import { consume, limitKey, resetMemoryLimits, windowStart } from "@/lib/rate-limit";
import { findCandidates } from "@/search/candidates";
import { embed } from "@/search/embed";
import { recordSearchEvent } from "@/search/events";
import { londonWallClock, searchAllowance } from "@/search/limits";
import { runSearch, type SearchEvent, type SearchOutcome } from "@/search/run";
import { loadEnvLocal } from "../../scripts/env";

loadEnvLocal();
const pool = new pg.Pool({ connectionString: withVerifiedTls(assertTestDatabaseUrl(process.env.DATABASE_URL)), max: 2 });
afterAll(() => pool.end());
beforeEach(() => resetMemoryLimits());

/** Runs one search in a rolled-back transaction, optionally preparing the database first. */
async function search(q: string, prepare?: (client: pg.PoolClient, salt: string) => Promise<void>) {
  const salt = `it-${Math.random().toString(36).slice(2)}`; // fresh keys: never touches real counters
  const client = await pool.connect();
  const events: SearchEvent[] = [];
  try {
    await client.query("begin");
    const tx = drizzle({ client });
    await prepare?.(client, salt);
    const out: SearchOutcome = await runSearch(
      { q, drops: [] },
      {
        allowance: () => searchAllowance({ address: "203.0.113.50", salt, consume: (key, limit, now) => consume(tx, key, limit, now) }),
        embed: async (text) => (await embed([text]))[0]!,
        candidates: (filters, vector) => findCandidates(tx, filters, vector),
        record: (e) => events.push(e),
      },
    );
    for (const e of events) await recordSearchEvent(tx, e);
    const logged = await client.query("select * from search_events order by id desc limit $1", [events.length]);
    return { out, events, logged: logged.rows };
  } finally {
    await client.query("rollback");
    client.release();
  }
}

describe("search end to end (test database, real model)", () => {
  it("returns only in-stock products within the stated price, with meaning used", async () => {
    const { out } = await search("chocolatey coffee under £11");
    if (out.status !== "done") throw new Error(out.status);
    expect(out.layer).toBe("parser+keyword+meaning");
    expect(out.results.length).toBeGreaterThan(0);
    for (const r of out.results) {
      expect(r.product.stock, r.product.slug).toBeGreaterThan(0);
      expect(r.product.pricePence, r.product.slug).toBeLessThanOrEqual(1100);
    }
  });

  it("logs the search without its text", async () => {
    const { out, logged } = await search("nutty espresso");
    if (out.status !== "done") throw new Error(out.status);
    expect(logged).toHaveLength(1);
    expect(Object.keys(logged[0]).sort()).toEqual(["cost_micropence", "created_at", "duration_ms", "id", "layer", "result_count"]);
    expect(logged[0]).toMatchObject({ result_count: out.results.length, layer: "parser+keyword+meaning", cost_micropence: "0" });
  });

  it("falls back to keywords only once today's shared ceiling is used up", async () => {
    const { out } = await search("nutty coffee", async (client, salt) => {
      const day = windowStart(londonWallClock(new Date()), 86_400);
      await client.query("insert into rate_limits (key, window_start, count) values ($1, $2, $3)", [limitKey("search-day", "everyone", salt), day, LIMITS.searchesPerDay]);
    });
    if (out.status !== "done") throw new Error(out.status);
    expect(out.keywordOnly).toBe("daily-limit");
    expect(out.layer).toBe("parser+keyword");
    expect(out.results.length).toBeGreaterThan(0);
  });

  it("refuses a connection that has used its searches for this minute", async () => {
    const { out, events } = await search("fruity", async (client, salt) => {
      // This minute and the next, in case the clock ticks over mid-test.
      for (const minute of [windowStart(new Date(), 60), windowStart(new Date(Date.now() + 60_000), 60)]) {
        await client.query("insert into rate_limits (key, window_start, count) values ($1, $2, $3)", [limitKey("search", "203.0.113.50", salt), minute, LIMITS.searchesPerMinutePerConnection]);
      }
    });
    expect(out.status).toBe("limited");
    expect(events).toEqual([]);
  });
});
