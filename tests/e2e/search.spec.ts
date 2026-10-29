import { expect, test, type Page } from "@playwright/test";

// Each test searches as its own made-up connection, so tests running side by side never share a search limit.
const fakeAddress = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".")}`;
const asNewConnection = (page: Page) => page.setExtraHTTPHeaders({ "x-forwarded-for": fakeAddress() });

function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.beforeEach(async ({ page }) => asNewConnection(page));

test("search from the header: the icon opens a box, Enter shows the results", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/shop/brewing-gear");
  await page.getByRole("link", { name: "Search", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Search the shop" });
  await expect(panel).toBeVisible();
  const box = panel.getByRole("searchbox", { name: "Search the shop" });
  await expect(box).toBeFocused();
  await box.fill("decaf under £12");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=decaf\+under\+%C2%A312$/, { timeout: 20_000 });
  await expect(panel).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("“decaf under £12”");
  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();
  for (const text of await cards.allTextContents()) {
    expect(text).toContain("Decaf");
    const price = Number(/£(\d+\.\d\d)/.exec(text)![1]);
    expect(price).toBeLessThanOrEqual(12);
    expect(text).not.toContain("Out of stock");
  }
  expect(errors).toEqual([]);
});

test("the search panel closes with Escape and offers example searches", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Search", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Search the shop" });
  await panel.getByRole("link", { name: "chocolatey espresso" }).click();
  await expect(page).toHaveURL(/\/search\?q=chocolatey\+espresso$/, { timeout: 20_000 });
  await expect(panel).toBeHidden();
  await page.getByRole("link", { name: "Search", exact: true }).click();
  await expect(panel).toBeVisible();
  await panel.getByRole("searchbox").fill("half typed");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("chips show what the search understood, and removing one re-runs the search without it", async ({ page }) => {
  await page.goto("/search?q=decaf+espresso");
  await expect(page.getByRole("link", { name: "Remove Decaf" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Remove Espresso" })).toBeVisible();
  for (const text of await page.locator("article").allTextContents()) expect(text).toContain("Decaf");

  await page.getByRole("link", { name: "Remove Decaf" }).click();
  await expect(page).toHaveURL(/drop=caffeine%3Adecaf/, { timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Put back Decaf" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Remove Espresso" })).toBeVisible();
  const texts = await page.locator("article").allTextContents();
  expect(texts.some((t) => !t.includes("Decaf"))).toBe(true);

  await page.getByRole("link", { name: "Put back Decaf" }).click();
  await expect(page).toHaveURL(/\/search\?q=decaf\+espresso$/, { timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Remove Decaf" })).toBeVisible();
});

test("search works without JavaScript: header link, box and chips", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, extraHTTPHeaders: { "x-forwarded-for": fakeAddress() } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("link", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/, { timeout: 20_000 });
  await page.getByRole("searchbox", { name: "Search the shop" }).fill("medium roast under £11");
  await page.getByRole("searchbox", { name: "Search the shop" }).press("Enter");
  await expect(page).toHaveURL(/\/search\?q=medium\+roast\+under\+%C2%A311$/, { timeout: 20_000 });
  await expect(page.locator("article").first()).toBeVisible();
  for (const text of await page.locator("article").allTextContents()) expect(text).toContain("Medium roast");
  await page.getByRole("link", { name: "Remove Under £11.00" }).click();
  await expect(page).toHaveURL(/drop=price/, { timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Put back Under £11.00" })).toBeVisible();
  await context.close();
});

test("an honest empty state with ideas to try instead", async ({ page }) => {
  await page.goto("/search?q=decaf+under+%C2%A33");
  await expect(page.getByText("Nothing in the shop matches all of that.")).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ideas to try instead" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fruity", exact: true })).toHaveAttribute("href", "/shop/coffee?taste=fruity");
});

test("an empty search page offers ideas and runs no search", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search");
  await expect(page.getByRole("heading", { name: "Not sure where to start?" })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
});

test("misspelt words are corrected and said so", async ({ page }) => {
  await page.goto("/search?q=dark+roast+for+cafatiere");
  await expect(page.getByText("Read “cafatiere” as “cafetiere”.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Remove Cafetière" })).toBeVisible();
});

test("a connection that searches too often is asked to wait", async ({ page, request }) => {
  test.setTimeout(90_000);
  const headers = { "x-forwarded-for": fakeAddress() };
  await page.setExtraHTTPHeaders(headers);
  // Limits count in fixed one-minute windows: start early in a minute so all 21 searches land in the same one.
  const secondsLeft = 60 - new Date().getSeconds();
  if (secondsLeft < 30) await page.waitForTimeout(secondsLeft * 1000 + 500);
  for (let i = 0; i < 20; i++) {
    const res = await request.get(`/search?q=nutty+${i}`, { headers });
    expect(res.ok()).toBe(true);
    expect(await res.text()).not.toContain("That is a lot of searches");
  }
  await page.goto("/search?q=nutty");
  await expect(page.getByText(/That is a lot of searches in one minute/)).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
});
