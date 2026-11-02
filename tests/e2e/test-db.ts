// Clean-up for browser tests that place orders. The TEST database is shared, so every order a test makes is removed
// and any stock it sold is put back. Refuses any database but the test one.
import pg from "pg";
// Imports keep their .ts extension so plain `node scripts/shoot-checkout.ts` can load this file too.
import { loadEnvLocal } from "../../scripts/env.ts";
import { withVerifiedTls } from "../../src/db/url.ts";
import { assertTestDatabaseUrl } from "../../src/lib/guards.ts";

loadEnvLocal();
let pool: pg.Pool | undefined;
const db = () => (pool ??= new pg.Pool({ connectionString: withVerifiedTls(assertTestDatabaseUrl(process.env.DATABASE_URL)), max: 2 }));

export async function orderStatus(reference: string): Promise<string | undefined> {
  const { rows } = await db().query("select status from orders where reference = $1", [reference]);
  return rows[0]?.status;
}

export async function stockOf(slug: string): Promise<number> {
  const { rows } = await db().query("select stock from products where slug = $1", [slug]);
  return rows[0].stock;
}

/** Deletes the order (its lines go with it), its open-checkout marker, and gives back stock it sold. */
export async function removeOrder(reference: string): Promise<void> {
  const client = await db().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query("select id, status from orders where reference = $1 for update", [reference]);
    const order = rows[0];
    if (order) {
      if (order.status === "paid") {
        await client.query(
          `update products p set stock = p.stock + i.quantity
           from (select product_id, sum(quantity)::int as quantity from order_items where order_id = $1 group by product_id) i
           where p.id = i.product_id`,
          [order.id],
        );
      }
      await client.query("delete from rate_limits where key like $1", [`%:${order.id}`]);
      await client.query("delete from orders where id = $1", [order.id]);
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export const closeTestDb = async () => {
  await pool?.end();
  pool = undefined;
};
