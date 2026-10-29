import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGES = ["/", "/account/sign-in", "/account/create", "/shop/coffee", "/shop/brewing-gear", "/shop/gift-sets", "/products/hillside-sunrise", "/products/thousand-hills", "/about", "/privacy", "/terms", "/products/no-such-thing", "/search?q=decaf+under+12", "/search"];

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && !/404 \(Not Found\)/.test(m.text()) && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    for (const path of PAGES) {
      test(`${path}: demo banner, no accessibility violations, no console errors`, async ({ page }) => {
        const errors = watchConsole(page);
        // Dark is only ever the visitor's own choice, saved by the theme switch.
        if (theme === "dark") await page.addInitScript(() => localStorage.setItem("theme", "dark"));
        await page.goto(path);
        await expect(page.getByText("Demo store: test payments only, nothing is sold")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.help})`)).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  });
}

test("category filters live in the page address and can be cleared", async ({ page }) => {
  await page.goto("/shop/coffee");
  await expect(page.getByText(/^24 products$/)).toBeVisible();
  if (isPhone(page)) await page.getByText("Filter and sort").click();
  await page.locator("label:visible", { hasText: "Decaf only" }).click();
  await expect(page).toHaveURL(/decaf=1/);
  await expect(page.getByText(/products? of 24/)).toBeVisible();
  for (const name of await page.locator("article h3").allTextContents()) expect(name).toMatch(/decaf/i);
  await page.getByRole("link", { name: "Clear filters" }).first().click();
  await expect(page).toHaveURL(/\/shop\/coffee$/);
});

test("filters work without JavaScript too", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/shop/coffee?roast=dark&stock=1");
  const roasts = await page.locator("article").allTextContents();
  expect(roasts.length).toBeGreaterThan(0);
  for (const text of roasts) expect(text).toContain("Dark roast");
  await context.close();
});

test("out-of-stock products are shown but cannot be bought", async ({ page }) => {
  await page.goto("/products/thousand-hills");
  await expect(page.getByRole("button", { name: "Out of stock" })).toBeDisabled();
  await page.goto("/shop/coffee");
  await expect(page.locator("article", { hasText: "Thousand Hills" }).getByText("Out of stock")).toBeVisible();
});

test("tampered filter values are ignored", async ({ page }) => {
  await page.goto("/shop/coffee?roast=%3Cscript%3E&origin=Atlantis");
  await expect(page.getByText(/^24 products$/)).toBeVisible();
});

test.describe("default theme", () => {
  test.use({ colorScheme: "dark" });
  test("is light even when the visitor's system prefers dark (Cam, 23 Oct)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test("the theme switch changes and remembers the theme", async ({ page }) => {
  await page.goto("/");
  // Phones keep the switch in the menu; wider screens in the header.
  if (isPhone(page)) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("missing products get a helpful 404", async ({ page }) => {
  const res = await page.goto("/products/no-such-thing");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "That page is not on the shelf" })).toBeVisible();
});

test("search engines are kept out until Cam says yes", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /");
  const res = await request.get("/");
  expect(res.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});

test("the taste filter narrows the coffee and shows what is chosen", async ({ page }) => {
  await page.goto("/shop/coffee");
  if (isPhone(page)) {
    await page.getByText("Filter and sort").click();
    await page.locator("label:visible", { hasText: /^Nutty$/ }).click();
  } else {
    await page.locator("summary", { hasText: "Taste" }).click();
    await page.locator("label:visible", { hasText: /^Nutty/ }).click();
  }
  await expect(page).toHaveURL(/taste=nutty/);
  if (!isPhone(page)) await expect(page.locator("summary", { hasText: "Taste: Nutty" })).toBeVisible();
  await expect(page.getByText(/products? of 24/)).toBeVisible();
});

test("the Coffee menu in the header leads to a filtered range", async ({ page }) => {
  await page.goto("/");
  if (isPhone(page)) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Fruity" }).click();
  } else {
    await page.getByRole("button", { name: "Coffee" }).click();
    await page.locator("#coffee-menu").getByRole("link", { name: "Fruity" }).click();
  }
  await expect(page).toHaveURL(/\/shop\/coffee\?taste=fruity/);
});

test("a coffee goes into the basket with its grind and quantity, and stays there", async ({ page }) => {
  await page.goto("/products/hillside-sunrise");
  await page.getByRole("button", { name: "Espresso", exact: true }).click();
  await expect(page.getByRole("button", { name: "Espresso", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "One more" }).first().click();
  await page.getByRole("button", { name: /^Add to basket/ }).click();
  const basket = page.getByRole("dialog", { name: /Your basket/ });
  await expect(basket).toBeVisible();
  await expect(basket).toContainText("Hillside Sunrise");
  await expect(basket).toContainText("Espresso");
  await expect(basket).toContainText("£23.00");
  await expect(basket.getByRole("button", { name: "Checkout" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Basket, 2 items" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Basket, 2 items" }).click();
  await basket.getByRole("button", { name: /Remove/ }).click();
  await expect(basket).toContainText("Your basket is empty.");
});

test("the basket counts down to free delivery", async ({ page }) => {
  await page.goto("/products/glass-cafetiere");
  await page.getByRole("button", { name: /^Add to basket/ }).click();
  const basket = page.getByRole("dialog", { name: /Your basket/ });
  await expect(basket.getByText(/more for free delivery|Free delivery unlocked/)).toBeVisible();
});

test("a product page leads with its photo on its taste colour", async ({ page }) => {
  await page.goto("/products/velvet-crema");
  const photo = page.getByRole("img", { name: "Photo of Velvet Crema" });
  await expect(photo).toBeVisible();
  expect(await photo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "3D view" })).toHaveCount(0);
});

test("the home page follows the shop flow: hero, favourites, ways to shop, tastes, brew guide", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const h of ["Our favourites", "Ways to shop", "What do you like the taste of?", "Make the most of every cup."]) {
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
  }
  await expect(page.locator('section[aria-labelledby="favourites"] article')).toHaveCount(4);
  await page.getByRole("link", { name: /^Caramel/ }).click();
  await expect(page).toHaveURL(/taste=caramel/);
});

test("every page sends strict security headers, including a content security policy", async ({ request }) => {
  for (const path of ["/", "/shop/coffee", "/account/sign-in", "/search?q=decaf"]) {
    const h = (await request.get(path)).headers();
    const csp = h["content-security-policy"] ?? "";
    for (const rule of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", "connect-src 'self'"]) {
      expect(csp, `${path}: ${rule}`).toContain(rule);
    }
    expect(csp).not.toContain("unsafe-eval");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["strict-transport-security"]).toContain("max-age=");
  }
});
