# Integration report — audit of admin dashboard + ordering/payment

Audit only. Nothing was committed, reset, discarded, deployed, migrated, or paid.
No production data existed to change; the only database mutations were (a) test/demo rows that the
suites create and delete themselves, and (b) the pre-existing local demo dataset.

## 1. What was actually reviewable

`git status` / `git diff` could not be run: **`/home/parag/Projects/wt_cp` is not a git repository**
(no `.git` anywhere under it or `backend/`), and no second copy exists to diff against. So
"which lines came from which agent" cannot be established from history. The reconciliation below is
therefore behaviour-based: docs ↔ routes ↔ services ↔ clients ↔ live schema ↔ tests.

## 2. Conflicts found and how they were reconciled

| # | Conflict | Resolution |
|---|---|---|
| 1 | Agent 1 shipped the admin UI against a contract; no `/api/admin/*` route existed on disk | Backend implemented to the contract; contract now documents what exists, including the places it had drifted |
| 2 | Agent 1's first draft blocked **unavailable** products at `addToCart`; `order-flow.test.ts` deliberately adds an unavailable product and expects checkout (not the cart) to reject it | Cart behaviour restored; **archived** products are blocked at checkout in `order.service.ts` (`no longer available`), with a new test |
| 3 | Prisma schema had `StockAdjustment`/`OrderStatusHistory` without back-references → `prisma generate` failed | Back-references added to `Customer`, `Product`, `Order` |
| 4 | Two migration directories were applied by hand but never recorded | Recorded **nowhere**; documented as a deployment blocker (§5). Schema verified by replay, not assumed |
| 5 | Two migrations both named `add_cart_orders`; the earlier one was rolled back and **its directory no longer exists** | Detected; no action taken (requires approval) |
| 6 | `docs/admin-api-contract.md` said the admin migration "must be applied with `npm run prisma:deploy`"; `docs/ordering-flow.md` still claimed 9 frontend / 26 backend tests and "18 routes" | Docs corrected: deployment reality is described accurately; test sections now describe the contract instead of stale counts; admin walkthrough added |

## 3. Verification performed

**Docs vs implementation.** Every endpoint, status code, payload shape and rule in
`docs/admin-api-contract.md` matches `admin.routes.ts` / `admin.controller.ts` / `admin-*.service.ts`
and `src/lib/admin-api.ts`. Every claim in `docs/ordering-flow.md` §2–§5 matches
`payment.service.ts` / `order.service.ts` / `order.controller.ts` / `src/lib/order-api.ts`
(signature → provider lookup → order/amount/currency/captured checks; 400/409/422/502/503 mapping;
conditional `updateMany` idempotency).

**Schema and migration history.**
- Replayed all seven migration files into a scratch database and diffed columns, defaults, indexes
  and foreign keys against `jay_hari_krushi`: **0 differences** (excluding `_prisma_migrations`).
  The live schema is exactly what the migration history says it should be.
- `_prisma_migrations` holds 6 rows; `20261026000000_add_admin_inventory_audit` and
  `20261026120000_add_product_archive` are absent. `prisma migrate status` lists both as "not yet applied".
- SHA-256 of every recorded migration file equals its stored checksum → no edited history.
- `20260811183220_add_cart_orders` is recorded as rolled back (`finished_at NULL`,
  `rolled_back_at` set, 0 steps) and its directory is gone.

**Behaviour (live HTTP, real DB).**
- Order ownership: owner `200`; other customer `GET`/`verify-payment`/`retry-payment` all
  `404 "Order not found."`; anonymous `401`; owner on a COD order `400 "This order doesn't use online
  payment."`; other customer's list excludes the order; customer on `/api/admin/orders` `403`.
- Admin auth: 401 anonymous vs 403 customer on all five admin list endpoints (`admin-api.test.ts`).
- Archival: archive sets `archivedAt` + `available=false`, storefront hides it, checkout refuses it,
  restore clears it.
- Stock audit: every adjustment row has product, admin, delta, before/after and reason; no orphaned
  rows (`EXPLAIN` uses `stock_adjustments_product_id_idx` + PK join).
- Payment verification: all branches unit-covered; live Razorpay success path still untested (§4).
- Admin UI walkthrough (Playwright, real API): sign-out redirect, customer refused, all five
  screens, stock-adjustment panel with audit history, sign-out clears session — **17/17 pass**.

**Commands run (final state).**

| Command | Result |
|---|---|
| `npm test` | 15/15 pass |
| `npm run test:backend` | 38/38 pass (incl. 11 admin API tests) |
| `npx tsc --noEmit` (frontend) | pass |
| `npx tsc --noEmit` (backend) | pass |
| `npm run build` (Next) | pass, 27 routes incl. 9 `/admin` |
| `npm run build` (backend) | pass |
| `npx eslint` on admin scope + admin test | clean |
| `npx eslint` (repo) | 3 pre-existing errors, see §4 |

## 4. Unresolved issues

1. **No git history** — conflict identification, blame and safe rollback are impossible in this tree.
2. **Razorpay success path never executed end to end.** Verification is the only code that grants
   `paid`; it is unit-covered up to the provider lookup. Requires a manual test-mode payment.
3. **No webhook/reconciliation.** Closing the tab after paying leaves the order `pending` until a
   manual callback run. Documented as shared follow-up.
4. **Duplicate-order protection is process-local.** Multiple API instances could double-create
   unless a durable idempotency key is added.
5. **Stock is not reserved or decremented by orders.** Overselling beyond the `available` flag is
   possible; stock is owned solely by the Inventory screen (deliberate, documented).
6. **Admin search is unindexed.** `q` uses `LIKE '%…%'` on `products.name/description` and on
   `orders.full_name/phone`; `EXPLAIN` shows a full scan (`products_archived_at_idx` is not used).
   Harmless at 18 products / 9 orders; worth a FULLTEXT or prefix index before the catalogue grows.
7. **Pre-existing lint errors** (not introduced here, untouched):
   `react-hooks/set-state-in-effect` in `product-detail.tsx`, `shop-catalog.tsx`,
   `shop-product-detail.tsx` (already listed in `docs/ordering-flow.md` §7.4).
8. Adjacent: products' `updated_at TIMESTAMP NOT NULL` without `ON UPDATE` (Prisma `@updatedAt`
   writes it) and `utf8mb4_unicode_ci` collation throughout (consistent, not a defect).

## 5. Deployment blockers (cannot be cleared without your approval)

1. **Unrecorded migrations.** The database contains the effects of two migrations that
   `_prisma_migrations` does not know about. Any `prisma migrate dev` / `migrate deploy` on this
   database will either re-run them or demand a reset. The schema has been verified correct, so
   the safe remedy is to **record** them, not re-apply:
   `npx prisma migrate resolve --applied 20261026000000_add_admin_inventory_audit`
   `npx prisma migrate resolve --applied 20261026120000_add_product_archive`
2. **Dead rolled-back migration entry.** `20260811183220_add_cart_orders` has no directory and a
   rolled-back row. Prisma still tolerates it, but any history tooling will trip on it. It needs an
   explicit decision (delete the stale row, or re-create a stub directory) — not done here.
3. **No git remote/history** — there is no reviewable or revertible baseline for this work.
4. **Uploads directory must persist across deploys** (`backend/uploads/products`, `UPLOAD_DIR`
   override available); it is gitignored (`/backend/uploads` in `.gitignore`), so it needs a volume.
5. **Razorpay keys** were exercised in test mode only. A successful payment has never been observed.

## 6. Files changed during this audit (relative to the pre-audit tree)

Docs: `docs/admin-api-contract.md`, `docs/ordering-flow.md`, `docs/integration-report.md` (new).

Code touched by the audit work: `backend/prisma/schema.prisma`,
`backend/prisma/migrations/20261026120000_add_product_archive/`,
`backend/src/{app.ts,middleware/auth.middleware.ts,routes/admin.routes.ts,controllers/admin.controller.ts}`,
`backend/src/services/{admin-*,order.service.ts,product.service.ts,auth.service.ts,cart.service.ts}`,
`backend/src/routes/order.routes.ts`, `backend/src/schemas/order.schema.ts`,
`backend/test/{admin-api.test.ts,order-flow.test.ts}`, `backend/prisma/seed-admin-demo.ts`,
`src/app/admin/**`, `src/components/admin/**`, `src/lib/{admin-api.ts,admin-form.ts,icons.ts}`,
`next.config.ts`, `.gitignore`, `package.json`, and the customer ordering files listed in
`docs/ordering-flow.md` §8.

## 7. Artifacts left on this machine

- `/tmp/opencode/pre_audit_backup.sql` — full pre-audit dump (27,847 bytes), restore only on request.
- Scratch database `jh_migration_audit` — created by the replay verifier; safe to drop.
- `/tmp/opencode/{migration_replay.py,schema_drift.py,ownership_check.py,e2e.py,layout.py}` — audit harnesses, outside the repo.
- Dev servers: Next on :3000, backend on :5000.
