# Demo Roasters: case study

A portfolio demo of an online coffee shop for a made-up UK roastery. Nothing is sold, and payments run in Stripe test mode only.

## Problem

A small roastery needs an online shop where customers can find a coffee by what it tastes like and buy it with a card, and where the owner can manage products, stock and orders.

## Approach

- A catalogue of 40 invented products with filters, a taste filter and product pages.
- Search that understands plain English, with no paid AI. A parser turns things it can be sure about, such as price limits and decaf, into hard filters that always win. A small free model (gte-small, 34 MB) matches meaning, and its scores are blended with keyword ranking.
- Each connection has a daily limit on meaning searches and falls back to keyword search after that, so the free hosting is not used up.
- Checkout through Stripe Checkout in test mode. An order is marked paid exactly once, after the site confirms the payment with Stripe.
- Stock is reserved while a checkout is open, using database row locks, so two visitors cannot take the last unit.
- Customer accounts with order history and self-service deletion, and an admin dashboard for products, stock, orders and a sales-by-day chart. A read-only viewer account is open to visitors.

## Result

Measured on 26 October 2026, after the final security fixes:

- Lighthouse on mobile, median of 5 runs: performance 95 on the home page, 93 on the coffee page, 91 on a product page and 98 on search. Accessibility and best practices are 100 on all four.
- 224 unit tests, 54 integration tests and 136 end-to-end tests pass, including accessibility checks in light and dark themes at phone and desktop widths.
- A locked search test of 20 queries, written before any search code and never tuned against, passed 16 with no rule violations: nothing out of stock and nothing over a price limit was shown. The target was 18, so it missed.

This is a demo with no real customers, so no business results are claimed.

## What I would improve

- Search missed its own target of 18 out of 20. I would study the four failures and improve the query reading before adding anything paid.
- The code has had three review passes (security, UK legal and payments) but no outside security audit.
- The database scripts refuse to run against any database except the project's own test one, and I have not checked that setup on a fresh clone.
