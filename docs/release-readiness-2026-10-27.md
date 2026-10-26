# Release-readiness report — Jay Hari Krushi Seva Kendra (2026-10-27)

Scope: final integration pass (§1–§12 brief). No redesign, no unrelated features. Test
mode only for Razorpay. All destructive-risk operations were avoided; the only database
created/dropped was the designated disposable DB `jhk_seedtest`.

## 1. Git / workspace state

- Workspace was NOT under version control. A baseline snapshot was created after
  confirming `/home/parag/Projects/wt_cp` is the standalone project root:
  - `00f2575` "Baseline snapshot before final integration pass" (pre-existing work preserved as-is)
  - `cce389a` "Final integration pass: canonical upload storage, image-delete cleanup,
    migration patch validated on copy, customer-journey E2E evidence, docs updates"
- Backend live on `:5000` (tsx watch), frontend on `:3000` (next dev). MySQL root access
  for `jay_hari_krushi` (dev). `.env` is gitignored; no secret values are reproduced here.

## 2. Files changed and why

| File | Change | Reason |
| --- | --- | --- |
| `backend/src/config/env.ts` | `storage.uploadDir` → canonical `<UPLOAD_DIR|cwd>/uploads/products` + new `storage.staticRoot`; `path` import | Single source of truth for upload storage; fixes the 404 (had defaulted to nonexistent `public/uploads`) |
| `backend/src/app.ts` | static mount serves `env.storage.staticRoot` | URL `/uploads/products/<file>` must map to the `products/` folder for any deployment override |
| `backend/src/routes/admin.routes.ts` | `UPLOAD_DIR = env.storage.uploadDir` (was a duplicated local resolution) | Remove the conflicting second storage definition |
| `backend/src/controllers/admin.controller.ts` | `removeProductImage` now removes the managed local file (guarded to `/uploads/products/`) | DELETE previously left orphan files on disk (live-verified bug) |
| `backend/src/controllers/admin.product.controller.ts` | unmounted legacy handler URL `/uploads/products/<file>` | Align the dead code path to the canonical URL so no landmine remains |
| `backend/.env.example` | documents `UPLOAD_DIR`, `MAX_UPLOAD_BYTES` (plus existing webhook/reconcile keys) | Deployment configuration discoverability |
| `backend/test/inventory-concurrency.test.ts`, `test/inventory-decrement.test.ts`, `test/order-idempotency.test.ts`, `test/webhook.test.ts` | lint fixes (`const`, removed `any` in helpers) | Zero-cost type tightening; no assertions changed |
| `docs/ordering-flow.md`, `docs/admin-api-contract.md` | contract now reflects durable idempotency, stock-on-order, webhook/reconciliation sweeper, migration bookkeeping | Docs must match shipped behavior |

Not changed on approval-required grounds: `prisma/migrations/20261027000000_.../migration.sql`
(see blocker B-1). The validated patch exists at `/tmp/opencode/prisma-patchtest/`.

## 3. Test / build results (actual runs today)

| Command | Result |
| --- | --- |
| `npm run lint` (repo root) | ✅ 3 remaining errors — all pre-existing `react-hooks/set-state-in-effect` in `product-detail.tsx`, `shop-catalog.tsx`, `shop-product-detail.tsx` (another agent's files; unchanged by this pass). 17 warnings. Was previously: 8 errors. |
| `npm test` (frontend) | ✅ 20/20 |
| `npx tsc --noEmit` (frontend) | ✅ clean |
| `npm run build` (frontend prod) | ✅ compiled + prerendered all routes |
| `npm test --prefix backend` | ✅ **69/69** (`tsx --test --test-concurrency=1 test/**/*.test.ts`) |
| `npx tsc --noEmit` (backend) | ✅ clean |
| `npm run build` (backend prod) | ✅ dist emitted |
| Admin browser walkthrough (`admin_walkthrough.py`) | 14/17 — 3 decodes below |
| Customer journey E2E (`customer-journey.py`, real browser vs real API) | ✅ **24/24** |
| Live image lifecycle (curl against running server) | ✅ 415 wrong-type / 201 valid / 200 byte-identical serving / 413 oversize / replace-cleans-old-file / DELETE-cleans-file+DB |
| Live payment idempotency (curl, same Idempotency-Key) | ✅ 201 then **200 replay, same order id** |
| Live webhook fail-closed (no secret) | ✅ 503 (both unsigned and signed variants) |

Admin walkthrough failure decode (evidence, not assumptions):
1. "overview shows backend metrics" — script asserts lowercase label text; dashboard renders
   CSS `uppercase` ("TOTAL ORDERS"). Metric exists (verified in `page.tsx:191–283`). **Script artifact.**
2. "no fulfilment action offered" — first `?status=pending` row is an unverified Razorpay
   order; contract offers only "Cancel order" until payment is verified, which the script's
   action regex does not include. **Script artifact.**
3. "failed load must not look like an empty list" — real, **low-severity** UI nuance: the
   orders page renders the owner-safe error banner *and* the "No orders yet" empty state
   together (rows computed as `result.data ?? []`). Banner content itself is owner-safe.

## 4. Image-upload: root cause and final state

Root cause: three mutually inconsistent arrangements. The mounted route
(`admin.routes.ts`, correct) wrote `<cwd>/uploads/products/<uuid>.<ext>` and stored URL
`/uploads/products/<file>`, but `app.ts` served `express.static(env.storage.uploadDir)`
which defaulted to a non-existent `public/uploads` → 200 upload, 404 on the served fetch
(the failing test). A second, never-mounted implementation
(`admin.product.routes.ts` + `upload.middleware.ts` + `admin-product.controller.ts`)
wrote to yet another path and stored `/uploads/<file>`.

Resolution (one canonical arrangement):
- **Disk:** `<UPLOAD_DIR|cwd>/uploads/products/<uuid>.<ext>` (flat files in `products/`).
- **Public URL:** `/uploads/products/<file>` — `app.ts` serves `UPLOAD_DIR`'s static root
  (`uploads/`), so the URL segment maps to the folder for any `UPLOAD_DIR` override.
- **Config:** `UPLOAD_DIR` env (documented in `.env.example`) read once in `env.ts`.
- **Cleanup rules preserved:** failed DB save deletes the file; replace deletes the
  previous file; DELETE route now also deletes the file (was bug).
- **Persistence:** uploaded files live on disk only — staging/production must point
  `UPLOAD_DIR` at a persistent volume; the DB stores only the public path.

Live verification against the running server: type rejection 415, valid PNG 201 →
`/uploads/products/<uuid>.png`, served 200 byte-identical, through **both** `:5000` directly
and the Next.js `/uploads` proxy on `:3000`; oversize 413 (>5 MB); replace removes old
file; DELETE clears DB field and removes file.

## 5. Catalog & seed

- `backend/src/seed.ts` defines exactly **36 products across 4 categories** ("Seeds",
  "Fertilizers", "Pesticides", "Agricultural Products") with SKUs only used as seed
  annotations (not persisted), INR prices, stock and thresholds.
- Idempotency: `findFirst(by name) → skip` — re-seeding never duplicates and never
  overwrites prices/stock. Proven on a disposable DB: 1st run "36 new",
  2nd run "0 new / 36 skipped". Final DB check: 36 rows, 36 distinct names, 4
  categories, all priced, zero-stock rows have `available=false`.
- Dev DB contains the seeded 36 **plus 47 rows**: the older hand-entered catalog
  (e.g. "Urea Fertilizer (46% N)") and test debris ("Stock Decrement …",
  journey fixtures). These are owner decisions to purge, not seed bugs.
- API verified live: list, `?category=`, search `?q=` (frontend client uses `q`
  consistently — a `search` param is silently ignored; not a defect), detail endpoints;
  ₹ en-IN formatting in storefront and admin; admin panel reads the same table.

## 6. Payment methods

- **COD — real-verified (today, live browser):** placement → `payment_status=cod_due`,
  `status=pending`; confirmation page does not claim payment; cart cleared; flag
  `?placed=1&pay=success` cannot fake it; duplicate Idempotency-Key → 200 replay of the
  same order (live curl proof, order 808).
- **Manual UPI — real-verified (today):** 12-digit reference enforced client-side and
  server-side (schema + tests); order stays `payment_status=pending` and is never
  auto-marked paid; admin verifies the reference later.
- **Razorpay — real test-mode verify from the prior session stands:** order **250** →
  `paid`/`confirmed`, `payment_ref=pay_TseoLU5C1j1kvn`, cross-checked live at
  Razorpay (`status:"captured"`, ₹266.00, method card). Today: dismissed-at-popup order
  stays `pending` and keeps a working "Pay now" retry affordance; `?pay=success` flag
  cannot fake paid. Signature/amount/currency validation is automated-test-covered
  (mock-only at the HTTP layer), and provider fetch-miss failure paths are
  test-covered (422/502).

## 7. Inventory consistency (stock on order)

Implemented and verified (see contracts §6):
- COD/UPI placements decrement inside the placement transaction; insufficient stock
  rolls the whole placement back (409).
- Razorpay deducts **once** at capture (verify / captured webhook / sweeper winner),
  exactly-once fenced by one-shot ledger claims in `webhook_events`
  (`provider='stock-ledger'`).
- Cancellation restores consumed stock once (fenced `restore:order:<id>` claim);
  cancelling unpaid Razorpay orders restores nothing.
- Live DB checks today: every recent COD/UPI order has exactly one
  `deduct:order:<id>` processed row; live admin-cancel of order 808 restored exactly
  one unit with exactly one `restore` claim.
- Automated: `inventory-decrement.test.ts` 9/9, `inventory-concurrency.test.ts` 2/2,
  `webhook.test.ts` 14/14, `order-idempotency.test.ts` 6/6 (stock-restoring).
- **Finding (medium):** `products.available` stays `true` at stock 0 — e.g. product 16
  shows "Add to Cart", reaches checkout, and only the server's 409 blocks it
  (server correct; UX inconsistent). Needs admin-agent coordination to either auto-flip
  `available=false` on decrement or hide/disable the purchase path at 0 stock.

## 8. Webhooks & reconciliation

- Endpoint `POST /api/payments/razorpay/webhook`: raw-body HMAC, fail-closed 503 with no
  `RAZORPAY_WEBHOOK_SECRET` (live-verified today), signature + event-ledger idempotency
  and stock-fencing covered by 14 automated tests (mock-only for actual provider
  delivery).
- Sweeper (`PAYMENTS_RECONCILE_MINUTES`): starvation fixed — pages stale pendings with an
  `(updated_at, id)` cursor so a long backlog cannot block newer orders (regression
  covered after the fix). Provider-failure paths never mark orders paid/failed.
- **Not fabricated:** real Razorpay webhook delivery was NOT exercised (needs dashboard
  config + reachable staging). Exact setup for that test: configure webhook secret in
  Razorpay Dashboard → Settings → Webhooks (one webhook: event types
  `payment.captured`, `payment.failed`, order.paid), set `RAZORPAY_WEBHOOK_SECRET` to the
  same secret, ensure the deployed host exposes `/api/payments/razorpay/webhook` over
  HTTPS. Until then the browser-callback + sweeper path is the loss-tolerant fallback.

## 9. Database & migration safety

- `prisma migrate status`: 8 migrations, "Database schema is up to date" (read-only).
- History bookkeeping (unchanged prior state, owner decisions): two admin migrations were
  earlier accepted via `prisma migrate resolve --applied` (with approval);
  `20260811183220_add_cart_orders` remains a rolled-back row.
- **Blocker B-1 (critical, pre-deploy):** migrations `20261026000000_add_admin_inventory_audit`
  and `20261027000000_add_webhook_events_and_order_idempotency` BOTH contain
  `CREATE TABLE webhook_events` (identical definitions). Any **fresh** `prisma migrate
  deploy` fails at the second one with MySQL 1050 — verified reproducibly on a brand-new
  test DB. A fresh provisioning attempt also leaves the partial apply recorded as
  unfinished (fresh DBs are recoverable only via reset; prod-style recovery would need
  manual statement-level handling). **Decision needed:** approve replacing the duplicate
  `CREATE TABLE` block in `20261027000000` with a comment and keeping only
  `ALTER TABLE orders ADD COLUMN idempotency_key` + `CREATE UNIQUE INDEX
  orders_customer_idempotency_key`. The patch was validated on a disposable DB (all 8
  migrations then apply cleanly; seed then yields the idempotent catalog) — patch copy
  at `/tmp/opencode/prisma-patchtest/`. No history was rewritten without approval.
- Backup/restore/deploy requirements: take `mysqldump --single-transaction` before deploy;
  deploy expects `DATABASE_URL` (CLI) + `DB_*` (app runtime) to point at the target DB;
  migrations run via `prisma migrate deploy` only — never `migrate dev` against shared DBs
  (it can offer a destructive reset).
- ~31 sandbox/e2e customers and their pending test orders remain in the dev DB; purge is
  a DB-owner decision (no destructive ops performed).

## 10. Security & production configuration

Verified present: httpOnly + SameSite=Lax + optional `COOKIE_SECURE` auth cookie;
bcrypt cost 12; role-based admin guard (401 anonymous / 403 customer, tested); CORS
pinned to `CLIENT_ORIGIN` with credentials; owner-safe error responses (no stack traces);
webhook raw-body size cap and auth-session body cap; upload MIME/extension allow-list +
size limit + managed path (live-verified); parameterized SQL (webhook/sweeper use
`Prisma.sql` — no string concatenation).

Documented gaps / requirements:
- `COOKIE_SECURE=true`, HTTPS and persistent `UPLOAD_DIR` volume are **production-mandatory**.
- No rate limiting on customer `/api/auth/register|login` or inquiries (the limiter exists
  and is used only on admin auth; `env.rateLimit.inquiryMax` is currently unused).
- Razorpay keys serve test mode only; production key rotation required at go-live.
- DB access uses root in dev; staging/production must use a least-privilege MySQL user.
- `/backend/dist` is not excluded from lint (config gap, cosmetic).

## 11. Blockers

- **B-1 (critical):** duplicate `webhook_events` CREATE TABLE across two migrations —
  fresh `prisma migrate deploy` fails; patch approved-and-validated but not applied
  (approval required).
- **B-2 (high):** real Razorpay webhook delivery unverified — requires the exact setup in
  §8 in an authorized staging environment.
- **B-3 (medium):** `available` flag not managed on auto-decrement to 0 (§7 finding).
- **B-4 (medium):** no rate limiting on customer auth/inquiry endpoints (security hardening).
- **B-5 (low):** admin orders page shows "No orders yet" empty state alongside the error
  banner; admin walkthrough script asserts lowercase labels and misses "Cancel" as an
  action (stale assertions).
- **B-6 (low):** pre-existing lint errors in 3 storefront components (owner’s follow-up).
- **B-7 (low):** `?search=` param silently ignored (contract is `?q=`) — document or alias.

## 12. Recommendation

**READY FOR STAGING** (with B-1 resolved before first provisioning: apply the
validated one-migration patch, or provision the staging DB from a dump of the dev schema).

**NOT ready for production yet.** The customer-to-admin journey, payments (test mode),
stock consistency and image uploads all work against the controlled environment, but
production parity requires: B-1 resolved, B-2 webhook delivery verified in staging,
B-3/B-4 hardening, production credentials/HTTPS/`COOKIE_SECURE`/persistent `UPLOAD_DIR`,
a least-privilege DB user and a backup strategy, plus a data-hygiene decision on the
dev-catalog/test remnants.
