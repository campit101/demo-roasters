import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteExpiredAccounts, resetDemoAccounts } from "@/auth/maintenance";
import { DEMO_ACCOUNTS } from "@/config/shop";
import { withVerifiedTls } from "@/db/url";
import { assertTestDatabaseUrl } from "@/lib/guards";
import { loadEnvLocal } from "../../scripts/env";

loadEnvLocal();
const pool = new pg.Pool({ connectionString: withVerifiedTls(assertTestDatabaseUrl(process.env.DATABASE_URL)), max: 2 });
const db = drizzle({ client: pool });
const tag = `it-${Date.now()}`;
const ids = { old: `${tag}-old`, fresh: `${tag}-fresh`, staff: `${tag}-staff` };

beforeAll(async () => {
  await pool.query(
    `insert into "user" (id, name, email, created_at) values
       ($1, 'Old', $3, now() - interval '31 days'),
       ($2, 'Fresh', $4, now() - interval '29 days')`,
    [ids.old, ids.fresh, `${tag}-old@example.com`, `${tag}-fresh@example.com`],
  );
  await pool.query(`insert into "user" (id, name, email, role, created_at) values ($1, 'Staff', $2, 'admin', now() - interval '90 days')`, [
    ids.staff,
    `${tag}-staff@example.com`,
  ]);
});

afterAll(async () => {
  await pool.query(`delete from "user" where id like $1`, [`${tag}%`]);
  await pool.end();
});

describe("account housekeeping", () => {
  it("deletes visitor accounts older than 30 days and keeps newer ones and staff accounts", async () => {
    await deleteExpiredAccounts(db);
    const { rows } = await pool.query<{ id: string }>(`select id from "user" where id like $1 order by id`, [`${tag}%`]);
    expect(rows.map((r) => r.id)).toEqual([ids.fresh, ids.staff]);
  });

  it("never deletes demo accounts, however old", async () => {
    await pool.query(`update "user" set created_at = now() - interval '400 days' where is_demo`);
    await deleteExpiredAccounts(db);
    const { rows } = await pool.query(`select email from "user" where is_demo order by email`);
    expect(rows.map((r) => r.email).sort()).toEqual(Object.values(DEMO_ACCOUNTS).map((a) => a.email).sort());
    await pool.query(`update "user" set created_at = now() where is_demo`);
  });

  it("database refuses an unknown role", async () => {
    await expect(pool.query(`insert into "user" (id, name, email, role) values ($1, 'X', $2, 'owner')`, [`${tag}-role`, `${tag}-role@example.com`])).rejects.toThrow(/user_role_check/);
  });

  it("resets demo sessions older than a day", async () => {
    const demo = (await pool.query<{ id: string }>(`select id from "user" where email = $1`, [DEMO_ACCOUNTS.customer.email])).rows[0]!.id;
    await pool.query(`insert into session (id, expires_at, token, user_id, created_at) values ($1, now() + interval '1 day', $1, $2, now() - interval '2 days')`, [`${tag}-s`, demo]);
    await resetDemoAccounts(db);
    const { rowCount } = await pool.query(`select 1 from session where id = $1`, [`${tag}-s`]);
    expect(rowCount).toBe(0);
  });
});
