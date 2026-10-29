// Nightly account housekeeping (run by the nightly job; CONSTRAINTS.md "Data rules"):
// visitor accounts (customers, never staff) older than the retention period are deleted (their sessions go with them; their orders stay,
// unlinked), and demo accounts lose their sessions and old order links so every visitor starts clean.
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { LIMITS } from "@/config/shop";

type Db = NodePgDatabase<Record<string, unknown>>;

export async function deleteExpiredAccounts(db: Db, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - LIMITS.accountRetentionDays * 24 * 60 * 60 * 1000);
  const { rowCount } = await db.execute(sql`delete from "user" where is_demo = false and role = 'customer' and created_at < ${cutoff.toISOString()}`);
  return rowCount ?? 0;
}

export async function resetDemoAccounts(db: Db, now: Date = new Date()): Promise<void> {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  await db.execute(sql`delete from session where user_id in (select id from "user" where is_demo) and created_at < ${dayAgo}`);
  await db.execute(sql`update orders set user_id = null where user_id in (select id from "user" where is_demo) and created_at < ${dayAgo}`);
}
