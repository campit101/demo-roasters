import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { withVerifiedTls } from "../../src/db/url";
import { assertTestDatabaseUrl } from "../../src/lib/guards";
import { loadEnvLocal } from "../../scripts/env";

loadEnvLocal();
const url = withVerifiedTls(assertTestDatabaseUrl(process.env.DATABASE_URL));

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

// Each test signs in as its own made-up connection, so tests running side by side never share the sign-in limits.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".")}` });
});

async function signInAsViewer(page: Page) {
  await page.goto("/account/sign-in");
  await page.getByRole("button", { name: "Look around the admin dashboard" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("the demo viewer sees the dashboard, orders and products, and nothing personal", async ({ page }) => {
  await signInAsViewer(page);
  await expect(page.getByText("Read-only demo viewer.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paid test orders per day" })).toBeVisible();
  await expect(page.getByText(/Paid test orders, 30 days/)).toBeVisible();
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("@");
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await expect(page.getByRole("link", { name: "Hillside Sunrise" })).toBeVisible();
});

test("the server refuses every save from the demo viewer", async ({ page }) => {
  const [before] = await sql<{ price_pence: number }>("select price_pence from products where slug = 'hillside-sunrise'");
  await signInAsViewer(page);
  await page.goto("/admin/products/hillside-sunrise");
  await page.getByLabel("Price (£)").fill("1.00");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/read-only demo viewer: saving is switched off/)).toBeVisible();
  const [after] = await sql<{ price_pence: number }>("select price_pence from products where slug = 'hillside-sunrise'");
  expect(after!.price_pence).toBe(before!.price_pence);
});

test("customers and signed-out visitors cannot open the admin pages", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account\/sign-in$/);
  await page.getByRole("button", { name: "Sign in as the demo customer" }).click();
  await expect(page).toHaveURL(/\/account$/);
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
});

test("an admin's price change shows in the shop straight away", async ({ page }, info) => {
  // A throwaway admin made the way the real one is: by user id, never by sign-up.
  const email = `e2e-admin-${Date.now()}-${info.project.name}@example.com`;
  // Coffees no other browser test touches (an admin save rewrites stock, which would upset a purchase test).
  const slug = info.project.name === "phone" ? "cloud-forest-washed" : "volcano-road";
  const [orig] = await sql<{ price_pence: number }>("select price_pence from products where slug = $1", [slug]);
  await page.goto("/account/create");
  await page.getByLabel("First name").fill("Admin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-admin-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await sql(`update "user" set role = 'admin' where email = $1`, [email]);
  try {
    await page.goto(`/admin/products/${slug}`);
    await expect(page.getByText("Read-only demo viewer.")).toHaveCount(0);
    await page.getByLabel("Price (£)").fill("15.55");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/^Saved\./)).toBeVisible({ timeout: 30_000 });
    await page.goto(`/products/${slug}`);
    await expect(page.getByText("£15.55").first()).toBeVisible();
  } finally {
    await sql("update products set price_pence = $2 where slug = $1", [slug, orig!.price_pence]);
    await sql(`delete from "user" where email = $1`, [email]);
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`admin pages have no accessibility violations (${theme})`, async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    if (theme === "dark") await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await signInAsViewer(page);
    for (const path of ["/admin", "/admin/products", "/admin/orders", "/admin/products/hillside-sunrise", "/account"]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.length} (${v.help})`)).toEqual([]);
    }
  });
}
