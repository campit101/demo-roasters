// The nightly job (Vercel cron, once a day on Hobby): runs each step in order and reports what it changed.
// A step that fails is reported and the rest still run. Add a step by appending to NIGHTLY_STEPS.
import { sql } from "drizzle-orm";
import { deleteExpiredAccounts, resetDemoAccounts } from "@/auth/maintenance";
import { LIMITS } from "@/config/shop";
import { expireStaleOrders, restockToSeed, type Db } from "@/checkout/orders";
import { deleteOldLimits } from "@/lib/rate-limit";

export interface NightlyStep {
  name: string;
  run: (db: Db, now: Date) => Promise<number | void>;
}

const DAY = 24 * 60 * 60 * 1000;
const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY).toISOString();

async function deleteOldOrders(db: Db, now: Date): Promise<number> {
  const { rowCount } = await db.execute(sql`
    delete from orders
    where (status in ('expired', 'cancelled') and created_at < ${daysBefore(now, LIMITS.unpaidOrderRetentionDays)})
       or (status = 'paid' and created_at < ${daysBefore(now, LIMITS.paidOrderRetentionDays)})`);
  return rowCount ?? 0;
}

async function deleteOldSearchEvents(db: Db, now: Date): Promise<number> {
  const { rowCount } = await db.execute(sql`delete from search_events where created_at < ${daysBefore(now, LIMITS.searchEventRetentionDays)}`);
  return rowCount ?? 0;
}

export const NIGHTLY_STEPS: NightlyStep[] = [
  { name: "expire lapsed checkouts", run: (db) => expireStaleOrders(db) },
  { name: "restock to seed levels", run: (db) => restockToSeed(db) },
  { name: "delete old rate limits", run: (db, now) => deleteOldLimits(db, new Date(now.getTime() - DAY)) },
  { name: "delete visitor accounts past 30 days", run: (db, now) => deleteExpiredAccounts(db, now) },
  { name: "reset demo accounts", run: (db, now) => resetDemoAccounts(db, now) },
  { name: "delete old orders", run: deleteOldOrders },
  { name: "delete old search records", run: deleteOldSearchEvents },
];

export interface NightlyReport {
  report: Record<string, number | null>;
  /** Steps that threw, with the error message (no personal data is in these queries). */
  failed: Record<string, string>;
}

export async function runNightly(db: Db, now: Date = new Date(), steps: NightlyStep[] = NIGHTLY_STEPS): Promise<NightlyReport> {
  const report: Record<string, number | null> = {};
  const failed: Record<string, string> = {};
  for (const step of steps) {
    try {
      report[step.name] = (await step.run(db, now)) ?? null;
    } catch (e) {
      report[step.name] = null;
      failed[step.name] = e instanceof Error ? e.message : String(e);
    }
  }
  return { report, failed };
}
