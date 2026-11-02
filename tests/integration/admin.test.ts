import { afterAll, describe, expect, it } from "vitest";
import pg from "pg";
import { getAdminProduct, listProducts, saveProduct } from "@/admin/data";
import { withVerifiedTls } from "@/db/url";
import { assertTestDatabaseUrl } from "@/lib/guards";
import { loadEnvLocal } from "../../scripts/env";

loadEnvLocal();
const pool = new pg.Pool({ connectionString: withVerifiedTls(assertTestDatabaseUrl(process.env.DATABASE_URL)), max: 1 });
const slug = "volcano-road";

afterAll(() => pool.end());

describe("admin product edits", () => {
  it("saves name, price, stock, notes and visibility, rebuilds the meaning vector, and can be put back", async () => {
    const before = (await getAdminProduct(slug))!;
    const vecBefore = (await pool.query("select embedding::text as v from products where slug = $1", [slug])).rows[0].v;
    try {
      await saveProduct(slug, { name: before.name, description: `${before.description} Test.`, pricePence: 1234, stock: 7, flavourNotes: ["plum", "cocoa"], active: false });
      const after = (await getAdminProduct(slug))!;
      expect(after).toMatchObject({ pricePence: 1234, stock: 7, flavourNotes: ["plum", "cocoa"], active: false });
      const vecAfter = (await pool.query("select embedding::text as v from products where slug = $1", [slug])).rows[0].v;
      expect(vecAfter).not.toBe(vecBefore);
      const seed = (await pool.query("select seed_stock from products where slug = $1", [slug])).rows[0].seed_stock;
      expect(seed, "the nightly restock keeps the admin's stock").toBe(7);
    } finally {
      await saveProduct(slug, { name: before.name, description: before.description, pricePence: before.pricePence, stock: before.stock, flavourNotes: before.flavourNotes, active: before.active });
      // Put back the exact seeded vector (embedding one product alone differs very slightly from the batch).
      await pool.query("update products set embedding = $2::vector where slug = $1", [slug, vecBefore]);
    }
    const vecRestored = (await pool.query("select embedding::text as v from products where slug = $1", [slug])).rows[0].v;
    expect(vecRestored).toBe(vecBefore);
    expect((await getAdminProduct(slug))!.pricePence).toBe(before.pricePence);
  });

  it("keeps the meaning vector when only price or stock change", async () => {
    const before = (await getAdminProduct(slug))!;
    const vec = (await pool.query("select embedding::text as v from products where slug = $1", [slug])).rows[0].v;
    try {
      await saveProduct(slug, { name: before.name, description: before.description, pricePence: before.pricePence + 1, stock: before.stock, flavourNotes: before.flavourNotes, active: before.active });
      expect((await pool.query("select embedding::text as v from products where slug = $1", [slug])).rows[0].v).toBe(vec);
    } finally {
      await pool.query("update products set price_pence = $2 where slug = $1", [slug, before.pricePence]);
    }
  });

  it("lists every product with units held by open checkouts", async () => {
    const all = await listProducts();
    expect(all.length).toBeGreaterThanOrEqual(40);
    expect(all.every((p) => p.held >= 0)).toBe(true);
  });
});
