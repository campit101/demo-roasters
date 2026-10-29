import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { withVerifiedTls } from "@/db/url";
import { assertTestDatabaseUrl } from "@/lib/guards";
import { consume, resetMemoryLimits } from "@/lib/rate-limit";
import { loadEnvLocal } from "../../scripts/env";

loadEnvLocal();
const pool = new pg.Pool({ connectionString: withVerifiedTls(assertTestDatabaseUrl(process.env.DATABASE_URL)), max: 2 });
const db = drizzle({ client: pool });
const key = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

afterAll(async () => {
  await pool.query("delete from rate_limits where key = $1", [key]);
  await pool.end();
});

describe("database rate limit", () => {
  it("allows up to the limit in one window, then refuses, even across server instances", async () => {
    const limit = { max: 2, windowSeconds: 60 };
    const now = new Date();
    expect((await consume(db, key, limit, now)).allowed).toBe(true);
    resetMemoryLimits(); // a second server instance has no memory of the first
    expect((await consume(db, key, limit, now)).allowed).toBe(true);
    resetMemoryLimits();
    const third = await consume(db, key, limit, now);
    expect(third.allowed).toBe(false);
    expect(third.count).toBe(3);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });
});
