# Admin API contract — Agent 1 ↔ Agent 2

Status: **implemented** (frontend by Agent 1, routes/services by Agent 2 work on the shared tree).
Frontend integration point: `src/lib/admin-api.ts` (the only module that talks to `/api/admin`).
Backend: `backend/src/routes/admin.routes.ts`, `controllers/admin.controller.ts`, and
`services/admin-*.service.ts`. Tests: `backend/test/admin-api.test.ts`.

If any shape changes, update `src/lib/admin-api.ts` first — every admin screen goes through it.

---

## 1. Session & authorization

- Same HttpOnly cookie as the shop (`jh_auth`). No localStorage flag, no URL parameter.
- `GET /api/auth/me` returns `role: "ADMIN" | "CUSTOMER"` (from the database).
- `router.use(authenticate, requireAdmin)` guards **every** `/api/admin/*` route.
  `requireAdmin` re-reads `customers.role` from MySQL per request, so demotion is immediate.
  - no session → `401 {"success":false,"message":"Unauthorized"}`
  - customer session → `403 {"success":false,"message":"This account doesn't have access to the owner dashboard."}`
- The frontend guard (`AdminAuthProvider`) is UX only.
- Making someone an owner is a deliberate manual step:
  `UPDATE customers SET role='ADMIN' WHERE email='owner@example.com';`
  Registration always creates `CUSTOMER`.

## 2. Envelope & pagination

Errors: `{ success: false, message: string }`. Lists:

```json
{ "success": true, "data": [], "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 1 } }
```

`page` (default 1), `pageSize` (default 20, max 100).

## 3. Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/dashboard` | `{ success, data }` (see §4) |
| GET | `/api/admin/orders?status&paymentStatus&q&page&pageSize` | `q` matches id, names, phone, customer email |
| GET | `/api/admin/orders/:id` | full order + `history` + `allowedTransitions` |
| POST | `/api/admin/orders/:id/status` | `{ status, note? }` → possibly `409` |
| GET | `/api/admin/products?q&category&availability&page&pageSize` | `availability`: `active\|inactive\|low_stock\|out_of_stock` |
| POST | `/api/admin/products` | `201 { success, product }` |
| GET | `/api/admin/products/:id` | |
| PATCH | `/api/admin/products/:id` | partial; server validates |
| POST | `/api/admin/products/:id/archive` | sets `archivedAt`, `available=false` |
| POST | `/api/admin/products/:id/restore` | clears `archivedAt` (availability stays as chosen) |
| DELETE | `/api/admin/products/:id/image` | sets `image = null` |
| POST | `/api/admin/products/:id/image` | multipart `image`; `201 { success, product }` |
| GET | `/api/admin/inventory?q&filter&page&pageSize` | `filter`: `low\|out\|ok`; non-archived only |
| POST | `/api/admin/products/:id/stock` | `{ delta, reason }` → `{ product, adjustment }` |
| GET | `/api/admin/products/:id/stock-adjustments?page&pageSize` | audit log |
| GET | `/api/admin/inquiries?status&q&page&pageSize` | |
| PATCH | `/api/admin/inquiries/:id` | `{ status?, internalNotes? }` |

There is deliberately **no** `DELETE /api/admin/products/:id`: products referenced by order
history are archived, never deleted.

## 4. Dashboard payload

```ts
{
  orders: { total, awaitingAction, processing, delivered, cancelled, todayCount },
  payments: {
    verifiedCollected: string; verifiedCollectedOrders: number; // payment_status = paid
    codDue: string;            codDueOrders: number;             // cod + cod_due (cash not yet collected)
    upiPending: string;        upiPendingOrders: number;         // upi + not paid (claim awaiting verification)
    failed: string;            failedOrders: number;
    nonCancelledOrderValue: string;                              // context only, not revenue
  },
  products: { total, active, inactive, lowStock, outOfStock },
  inquiries: { total, new },          // new = status PENDING
  recentOrders, recentInquiries       // 5 newest each
}
```

Cancelled orders are excluded from collected/COD/UPI buckets. Revenue never includes `cod_due`,
`pending` or `failed`.

## 5. Order statuses

Fulfilment: `pending → confirmed → processing → packed → shipped → delivered`, plus `cancelled`.
Permitted moves (server-enforced, `409` otherwise; forward steps may be skipped, nothing goes back):

| from | allowed |
| --- | --- |
| pending | confirmed, processing, cancelled |
| confirmed | processing, packed, cancelled |
| processing | packed, shipped, cancelled |
| packed | shipped, delivered, cancelled |
| shipped | delivered, cancelled |
| delivered / cancelled | — |

`allowedTransitions` is computed server-side; the UI only offers those. Each accepted change writes
`order_status_history` (`adminId`, optional note). The status change is a conditional update, so
two admins acting at once cannot both win.

Payment statuses: `cod_due`, `pending`, `paid`, `failed`.

## 6. Stock model — "Stock on order" (shipped 2026-10-27, owner: checkout+payments integration)

The inventory screen keeps sole ownership of **manual** adjustments (delta, audited,
`FOR UPDATE` row-locked, cannot go negative) and checkout now owns the **order-driven**
consumption:

1. **COD / UPI orders** — stock is decremented atomically inside the same SQL transaction
   that inserts the order (conditional `UPDATE products SET stock_quantity = stock_quantity
   - qty WHERE id = ? AND stock_quantity >= qty AND archived_at IS NULL`). A concurrent
   drain cannot oversell: insufficient stock rolls the placement back entirely (no order, no
   cart clear, HTTP 409).
2. **Razorpay orders** — placement does **not** touch stock (a payment may fail; failed
   orders must not consume stock). The payment-success writer that wins the race — browser
   `verify-payment`, signed `payment.captured` webhook, or the reconciliation sweep —
   performs the deduction inside the same transaction that marks the order paid
   (`webhook.service.ts::settleCapturedPaymentOnOrder`). Exactly-once is enforced by a
   conditional `paymentStatus != 'paid'` update plus a durable one-shot stock ledger claim
   (see below).
3. **Cancellation** — `POST /api/admin/orders/:id/status` to `cancelled` restores stock once,
   in the same transaction as the status move, guarded by a `restore:order:{id}` ledger
   claim. Orders that never consumed stock (unpaid Razorpay) restore nothing.
4. **Captured-but-overdrawn edge** — if stock was manually moved down between placement and
   capture, a captured payment is still honoured as money (order stays paid/confirmed) and an
   alert note (`payment captured but stock insufficient … manual stock/refund
   reconciliation required`) is written to `order_status_history`; no negative stock is
   written.

**Fencing/ledger:** `webhook_events` (provider value `stock-ledger`, one row per claim,
unique `(provider, event_id)` already guaranteed by migration `20261027000000`).

- `deduct:order:{id}` — placement-time deduction (COD/UPI)
- `deduct:pay:{razorpayPaymentId}` — capture-time deduction
- `restore:order:{id}` — cancellation restore

Admin inventory contract unchanged otherwise: **no stock reservation semantics** were added;
`available = false` still happens only at 0 via admin adjustments; do not clean the
`stock-ledger` rows out of `webhook_events`.

## 7. Product images

- Stored on disk: `backend/uploads/products/<uuid>.(jpg|png|webp)` (`UPLOAD_DIR` env overrides).
  Never base64 in MySQL.
- Accepted: `image/jpeg`, `image/png`, `image/webp`; max 5 MB (`413` when larger, `415` wrong type).
- Stored value is the public path `/uploads/products/<file>`; served by Express and proxied by Next
  (`/uploads/:path*` rewrite) with `images.localPatterns` allowing it through the optimizer.
- The previous local file is deleted after the DB row is updated; the new file is deleted if the
  DB update fails.
- `products.image` values that are full URLs (the existing Unsplash seed data) are passed through,
  so the admin never rewrites storefront photos.

## 8. Schema additions (Agent 2 work)

- `products.archived_at TIMESTAMP NULL` + index — migration `20261026120000_add_product_archive`.
- Migration `20261026000000_add_admin_inventory_audit` (role, stock columns, audit tables) is the
  prerequisite.
- `webhook_events` + `orders.idempotency_key` (unique per customer) — migration
  `20261027000000_add_webhook_events_and_order_idempotency`.

**Migration bookkeeping status (2026-10-27):** `migrate status` reports "Database schema is up
to date" for all 8 recorded migrations. History notes for the deployment DB owner:

1. The two admin migrations (`20261026000000`, `20261026120000`) had their SQL applied to the
   dev database **before** being recorded (they were created by hand-drift repair); they were
   then **accepted as applied** via `prisma migrate resolve --applied` (approved at the time;
   `applied_steps_count = 0` in `_prisma_migrations` because the SQL was already present).
   No further `migrate resolve` is required or permitted without explicit approval.
2. A rolled-back record `20260811183220_add_cart_orders` (`applied_steps_count = 0`,
   `rolled_back_at` set) remains in `_prisma_migrations`; it was superseded the same minute by
   `20260811183600_add_cart_orders`. Keeping the rolled-back row is Prisma's recommended
   default and `migrate status` is happy with it; **deleting it is the alternative and is a
   bookkeeping decision explicitly left to the DB owner** — do not "clean it up" silently.
3. No destructive migration is planned; `webhook_events`/idempotency are additive.

## 9. Local dev data

`backend/prisma/seed-admin-demo.ts` creates an owner account and demo orders/inquiries for UI
testing (never run in production):

```bash
cd backend && npx tsx prisma/seed-admin-demo.ts
# owner@jayharikrushi.test / OwnerDemo#2026
```
