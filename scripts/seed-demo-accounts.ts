// Creates the demo accounts (customer, and the read-only admin viewer for T8) if they are missing, with the
// passwords from src/config/shop.ts. Their details are reset each run, so visitors cannot change them for good.
//   Laptop: test database only. Vercel build: whichever database the build uses (production needs Cam's yes).
import { generateId } from "better-auth";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
import { DEMO_ACCOUNTS } from "../src/config/shop.ts";
import { withVerifiedTls } from "../src/db/url.ts";
import { assertTestDatabaseUrl } from "../src/lib/guards.ts";
import { loadEnvLocal } from "./env.ts";

// Read before .env.local is loaded, so only a real Vercel build counts as Vercel.
const onVercel = process.env.VERCEL === "1";
loadEnvLocal();
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!onVercel) assertTestDatabaseUrl(url);
if (!url) throw new Error("Database connection string is missing");

const ROLES = { customer: "customer", viewer: "viewer" } as const;

const client = new pg.Client({ connectionString: withVerifiedTls(url) });
await client.connect();
try {
  await client.query("begin");
  for (const [kind, a] of Object.entries(DEMO_ACCOUNTS) as [keyof typeof DEMO_ACCOUNTS, (typeof DEMO_ACCOUNTS)[keyof typeof DEMO_ACCOUNTS]][]) {
    const found = await client.query<{ id: string }>(`select id from "user" where email = $1`, [a.email]);
    const id = found.rows[0]?.id ?? generateId();
    const hash = await hashPassword(a.password);
    await client.query(
      `insert into "user" (id, name, email, email_verified, role, is_demo) values ($1, $2, $3, true, $4, true)
       on conflict (email) do update set name = excluded.name, role = excluded.role, is_demo = true, updated_at = now()`,
      [id, a.name, a.email, ROLES[kind]],
    );
    const acc = await client.query(`select id from account where user_id = $1 and provider_id = 'credential'`, [id]);
    if (acc.rowCount) await client.query(`update account set password = $2, updated_at = now() where user_id = $1 and provider_id = 'credential'`, [id, hash]);
    else await client.query(`insert into account (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`, [generateId(), id, hash]);
  }
  await client.query("commit");
  console.log(`Demo accounts ready: ${Object.keys(DEMO_ACCOUNTS).join(", ")}.`);
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  await client.end();
}
