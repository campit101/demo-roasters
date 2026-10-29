// Read-mostly check of the TEST database: tables, extension, constraints. The two forbidden writes
// run inside a transaction that is always rolled back, so nothing is left behind.
import pg from "pg";
import { withVerifiedTls } from "../src/db/url.ts";
import { assertTestDatabaseUrl } from "../src/lib/guards.ts";
import { loadEnvLocal } from "./env.ts";

loadEnvLocal();
const client = new pg.Client({ connectionString: withVerifiedTls(assertTestDatabaseUrl(process.env.DATABASE_URL_UNPOOLED)) });
await client.connect();
try {
  const tables = await client.query("select table_name from information_schema.tables where table_schema = 'public' order by 1");
  const ext = await client.query("select extversion from pg_extension where extname = 'vector'");
  const checks = await client.query("select count(*)::int as n from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace");
  const fkMissingIndex = await client.query(`
    select conrelid::regclass::text as tbl, a.attname as col from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and a.attnum = any(i.indkey))`);
  console.log("tables:", tables.rows.map((r) => r.table_name).join(", "));
  console.log("pgvector:", ext.rows[0]?.extversion ?? "missing", "| check constraints:", checks.rows[0].n, "| foreign keys without index:", fkMissingIndex.rowCount);

  for (const [label, sql] of [
    ["live-mode order", "insert into orders (subtotal_pence, delivery_pence, total_pence, reserved_until, livemode) values (100, 0, 100, now(), true)"],
    ["wrong total", "insert into orders (subtotal_pence, delivery_pence, total_pence, reserved_until) values (100, 50, 100, now())"],
    ["unknown roast", "insert into products (slug, name, category, description, size, price_pence, roast, stock, seed_stock, art) values ('x','X','beans','d','s',100,'burnt',1,1,'bag')"],
  ] as const) {
    await client.query("begin");
    try {
      await client.query(sql);
      console.log(`FAIL: database accepted a ${label}`);
    } catch (e) {
      console.log(`ok: database refused a ${label} (${(e as { constraint?: string }).constraint ?? "error"})`);
    } finally {
      await client.query("rollback");
    }
  }
} finally {
  await client.end();
}
