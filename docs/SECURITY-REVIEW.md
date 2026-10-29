# Security and compliance review (T11)

Date: 26 October 2026. Branch `run-t5-t11`. Method: a hardening pass, then three independent reviews (security, UK legal, and an adversarial review of payments and data). Every finding below was checked against the code before it was fixed or accepted. Nothing in this review is on production: the live site has never been deployed.

## Result

No high finding is left open. Every high and medium finding was fixed test-first, except where marked "accepted" with the reason. The decisions that only the owner can make are listed at the end.

## Hardening done before the reviews

| Area | What was done | Checked by |
|---|---|---|
| Headers | Content-Security-Policy (everything from this site only; no framing; forms post only to this site), HSTS for 2 years, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, no `X-Powered-By` | e2e header test |
| Session cookie | httpOnly, SameSite=Lax, 7 days; always Secure on Vercel (`useSecureCookies`) | Better Auth source read; e2e sign-in tests |
| Dependencies | `npm audit`: the one high advisory (nested zod in the Vercel CLI config) fixed by pinning zod 4.6.7; 4 moderate left, all esbuild through drizzle-kit, which only runs on the laptop (accepted, review again at T12) | `npm audit` 26 Oct |
| Secrets | Whole git history scanned: no keys, only dummy local Postgres addresses in tests | scan 26 Oct |
| Visitor address | Vercel overwrites `x-forwarded-for`, so the first entry is the real visitor (Vercel docs, read 26 Oct) | docs |

## Security reviewer

| # | Severity | Finding | What was done |
|---|---|---|---|
| M1 | medium | Admin overview, orders and products pages relied on the layout's staff check only | Each page now checks staff access itself (`requireStaff`) |
| M2 | medium | The 3-unit cap was per line, so 5 grinds of one coffee made 15 | Caps of 3 per product (all grinds) and 6 per order, in the basket and again at checkout; unit and integration tests |
| M3 | medium | Sign-in and sign-up limits keyed on the raw address (an IPv6 home has billions) and there was no limit per account | Every limit now counts an IPv6 /64 as one connection; sign-in also limited to 10 tries an hour per account (salted email hash). The "already an account with that email" message stays (accepted: emails here are throwaway, and sign-up is limited to 5 an hour per connection) |
| L1 | low | Order page asked Stripe about every unpaid order on every view | Asks only about pending orders, at most 30 times an hour per connection |
| L2 | low | One connection could use the whole day's meaning-model searches | One connection gets at most 100 of the shared 2,000 a day, then keyword search |
| L3 | low | `.env.local` could set `VERCEL=1` and switch off the scripts' test-database guard | Scripts read `VERCEL` before loading the file, and the loader never loads `VERCEL*` keys (unit test) |
| L4 | low | CSP allows inline scripts | Accepted: pages are pre-built (a per-request nonce would stop caching) and nothing a visitor types is rendered as HTML |
| L5 | low | Search words reach Vercel's request logs through the page address | Privacy page now says so |
| L6 | low | Account deletion copy said order history is removed; orders are kept, unlinked | Copy corrected on the account page, the checkbox and the privacy page |
| L7 | low | Project notes said dependency install scripts do not run; npm 11 runs them | Notes corrected; Vercel installs with `ONNXRUNTIME_NODE_INSTALL=skip`, so ONNX Runtime no longer downloads GPU files it never uses |

## Legal reviewer (UK)

| # | Severity | Finding | What was done |
|---|---|---|---|
| P1 | high | No lawful basis on the privacy page | Added: legitimate interests, with the right to object |
| P2 | high | Search and payments were described as future | Privacy page rewritten for what the site does now |
| P3 | medium | Sessions stored the browser's user agent | Sessions now store no user agent or IP (Better Auth database hook) |
| P4 | medium | No retention periods | Each record now has its period, and the nightly job enforces them |
| P5 | medium | US companies not mentioned | Added, with the safeguards wording |
| P6 | medium | Search words in host logs | As L5 |
| P7 | medium | Deletion copy | As L6 |
| P8 to P11 | low | Incomplete purpose for limits; `checkout-reference` storage item missing; backups; deletion happens "on or just after" the date | All fixed in the copy |
| C1 to C3 | medium/low | About and home pages called finished parts "coming next" | Copy updated: every part is built |
| C4 to C6 | low | Unprovable claims in product copy ("biggest single difference", "plastic-free", "great value", "rare", "tiny lot", "easiest way") | Reworded; catalogue now fingerprinted; locked search re-measured afterwards: unchanged at 16 of 20, 0 violations |
| C7 | low | Terms said only countries are real; one product name uses a real region (Cerrado) | Terms now say a product name may borrow a real region. "Thousand Hills" kept (Rwanda's common nickname; any overlap with a coffee brand is unverified and low risk for a demo that sells nothing) |
| C8 | low | Page dates | Privacy and terms dated 26 October 2026 |

## Devil's advocate

| # | Severity | Finding | What was done |
|---|---|---|---|
| R1 | high | One connection could buy every unit until the nightly restock | Per-product and per-order caps, and a paid order that sells a product out restocks it at once (integration test) |
| R2 | high | About 10 connections could hold every unit in open checkouts | Open checkouts may hold at most half of a product's stock (integration test); the terms say stock restocks itself |
| R3 | high | Neon's free compute allowance could run out | Owner decision: cap the live database at its smallest size and turn on usage emails. Neon's free plan cannot charge, so the risk is downtime, not money |
| R4 | medium | Floods could use up Vercel Hobby's free limits | Every costly action is limited per connection; database waits capped at 5 s and statements at 10 s. Hobby cannot charge; a Firewall rule is optional (owner) |
| R5 | medium | Admin description edits needed the model files on Vercel | Admin routes now ship the model files |
| R6 | medium | The nightly job would delete the owner's admin account at 30 days | Clean-up deletes customer accounts only (integration test) |
| R7 | medium | One failing nightly step stopped the rest | Each step isolated; a failure is reported with status 500 and the rest still run (integration test) |
| R8 | medium-low | Full order references could reach the demo viewer through the page payload | The dashboard now receives only the first 8 characters |
| R9 | medium-low | Stripe calls from the order page | As L1 |
| R10 | medium-low | One connection could use the daily search ceiling | As L2 |
| R11 | low-medium | Tables grew forever | Nightly deletion: unpaid orders after 30 days, paid test orders after 365, search records after 90, old limit counts daily |
| R12 | low | Mass sign-ups and the "already registered" message | As M3 |
| R13 | low | Visitors behind one office or mobile network share limits | Accepted: limits are generous for a demo |
| R14 | low | Stripe webhook not in the launch steps | Owner decision; the order page already confirms payment without it |
| R15 | low | Privacy page incomplete | Rewritten (P1 to P11) |
| R16 | low | Address relies on Vercel overwriting a header | Checked in Vercel's docs (26 Oct) |
| R17 | low | No database connection timeout | 5 s connection and 10 s statement timeouts |
| R18 | low-medium | `eval:locked` never failed; catalogue edits could quietly tune search | `eval:locked` now fails when the gate fails; catalogue fingerprinted, edits need a recorded decision first |

## Decisions for the owner

1. Approve the final private preview.
2. Search gate: keep the free search with its honest measured score (16 of 20), or try a small paid language model after seeing its estimated cost.
3. Production deploy: yes or not yet.
4. ICO data protection fee: the fee is owed per controller, not per site, so if the owner already pays it for another project, Demo Roasters is covered by the same registration.
5. Stripe webhook at launch: skip (recommended) or set up.
6. Neon size cap and usage emails, Vercel usage alerts: set by the owner.

Optional, not asked: governing law in the terms, "adults only" line. FLUX.2 [pro] output rights were checked earlier: Black Forest Labs' terms allow using outputs, including commercially.
