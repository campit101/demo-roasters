# Demo Roasters: case study

Demo Roasters is a fictional coffee shop that sells nothing. Payments run in Stripe's test mode only. It is a portfolio demo, live at https://demo-roasters.vercel.app.

## The brief

I wanted a demo that proves the parts of a real online shop that my other project does not show: a product catalogue, search that understands plain English, a basket and checkout, customer accounts and an admin dashboard. Three limits shaped everything. It had to cost £0 to run. It had to be honest: nothing invented as proof, and everything labelled as a demo. And it had to be safe to leave on the open internet.

I am not a developer. I led the project, designed the shop and made the business, money and taste decisions.

## What I built

A UK specialty coffee shop with 40 invented products, each with an AI-generated photo (the site says so). Visitors can filter by taste, search in plain English, fill a basket and pay with a Stripe test card. They can sign in to a demo customer account and see order history. A read-only admin viewer lets anyone look at the dashboard: products, stock, orders and a sales-by-day chart. Only I can edit.

It was built between 23 and 29 October 2026. It runs on Next.js, Neon Postgres in London, Stripe's sandbox and Vercel's free plan.

## How AI search works

Type "decaf coffee under £12" and the search does two jobs.

First, it picks out the parts it can be sure about, such as the price limit or "decaf". These are hard rules. A result that breaks a rule is never shown, however well it matches otherwise.

Second, it works out what you mean. A small language model, `gte-small`, runs on the server and turns words into numbers, so that similar meanings sit close together. "Fruity" can then find a coffee described with berries, even if the word "fruity" is not on the page. This is blended with ordinary keyword matching.

None of this uses paid AI. There is no per-search cost. Search words are not stored, and each visitor has a daily limit on the meaning search, after which it falls back to keywords only.

## Decisions that mattered

**Free search before paid AI.** The plan was to try a free search first and only add a paid AI model if a locked test failed and I approved the measured cost. The test failed (see Results). The estimate for adding a paid helper was small, but it was an estimate and nothing had been measured. I chose to keep the free search and publish the honest score.

**A search test that cannot be loosened.** Twenty queries, including typos and price limits, were written before any search code existed. A unit test enforces the pass mark. When the result came in under target, nothing was tuned to fit the four misses.

**Stock holds and caps.** A demo shop can be emptied by one visitor. Stock is reserved while a checkout is open, using database row locks so two people cannot take the last unit. A visitor can hold at most 3 of one product and 6 items per order, and holds cannot exceed half of a product's stock. A product that sells out restocks itself.

**Test-mode payments only, enforced in code.** Live mode is never turned on. The code refuses any Stripe key that does not start with `sk_test_`, `rk_test_` or `pk_test_`. The checkout is card only, and an order is marked paid exactly once.

**Privacy by design.** Rate limits use salted hashes, not raw addresses. Sessions store no IP address or browser details. Search text is not stored. Visitor accounts are deleted after 30 days, and a nightly job enforces the retention periods written on the privacy page.

**Reviews before launch.** Before going live, three independent reviews (security, UK legal and a devil's advocate on payments and running costs) were run. Every high and medium finding was fixed with a test first or accepted with a written reason. The record is in `docs/SECURITY-REVIEW.md`.

## Results

All numbers were measured on 26 October 2026 unless stated.

- Locked search test: 16 of 20 queries passed, with 0 rule violations. The target was 18, so it missed. I kept the free search by choice.
- Lighthouse mobile, median of 5 runs. Performance: 95 home, 93 coffee page, 91 product page, 98 search. Accessibility 100 and best practices 100 on all four.
- Tests, all passing: 224 unit, 54 integration and 136 end-to-end with Playwright. The end-to-end tests include axe accessibility checks in light and dark themes at phone and desktop widths.
- Catalogue: 40 invented products.
- Real visitors, sales and customer feedback: none. This is a demo, so there are no such numbers.

## What I would do next

- Fix the four missed search queries properly, and re-test on a new set of queries written after the fix, so the score is not tuned to the old twenty.
- Try a small paid AI helper to understand queries, only after measuring its real cost per search and agreeing a daily cap.
- Add new products from the admin dashboard. Editing exists, adding was deferred.
- Add a Stripe webhook so payments are confirmed without the customer returning to the site. Today the order page checks with Stripe instead.
- Decide whether to add an open-source licence (today the code is public to read, with all rights reserved).

## Upwork version

Demo Roasters: AI-search coffee shop with Stripe checkout and admin

I built Demo Roasters, a demo online coffee shop that sells nothing and uses Stripe test mode only. It shows what a full small shop needs: 40 invented products, a basket, card checkout, customer accounts with order history, and an admin dashboard with stock, orders and a sales chart.

The search understands plain English, such as "decaf coffee under £12", and hard rules like price and decaf always win. It runs a free model on the server, so there is no per-search cost. On my locked test it passed 16 of 20 queries with no rule violations. I missed my own target of 18 and kept the free version.

I led the project and made the product decisions. Lighthouse mobile scores are 91 to 98 for performance and 100 for accessibility. 224 unit, 54 integration and 136 end-to-end tests pass. It uses Next.js, Postgres and Vercel, and went through a security and UK privacy review with every serious finding fixed.

Live demo: https://demo-roasters.vercel.app
