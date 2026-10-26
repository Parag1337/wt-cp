# Customer ordering & payment flow — diagnostics and contract

Owner: Agent 3 (customer checkout, payments, ordering reliability).
Not owned here: Prisma schema/migrations, inventory, admin APIs, admin UI (Agent 2 / Agent 1).
No schema migrations were created by this work.

---

## 1. Reported symptom: 404 after Razorpay payment

### Root cause (established with evidence, not assumption)

`/orders/[id]` was a Server Component that fetched the order directly from the backend:

```ts
// src/app/orders/[id]/page.tsx (before)
const res = await fetch(`${process.env.BACKEND_ORIGIN}/api/orders/${id}`, { cache: "no-store" });
if (!res.ok) return null;      // 401 -> null
...
if (!data?.order) notFound();  // -> Next 404 page
```

The orders router is fully authenticated (`router.use(authenticate)`), which reads the
`jh_auth` HttpOnly cookie. A server-to-server `fetch` from the Next.js process carries no
browser cookie, so the request was rejected with **401**, `res.ok` was false, and the page
called `notFound()`. Every post-checkout redirect (`?placed=1&pay=…`) therefore landed on a
404, including the Razorpay success redirect.

Reproduction (backend on :5000, frontend on :3000):

| Request | Result |
| --- | --- |
| `GET localhost:5000/api/orders/6` with no cookie | **401** `{"success":false,"message":"Unauthorized"}` |
| `GET localhost:5000/api/orders/6` with the customer cookie | **200** with the order |
| `GET localhost:3000/orders/7` (before fix) | **404** |
| `GET localhost:3000/orders` (client-side fetch) | 200 |

The other candidate sources of a 404 were checked and **ruled out**:

- **Checkout.js URL** — `https://checkout.razorpay.com/v1/checkout.js` loads (the old loader
  never inspected the response, but the script was reached and executed).
- **Next.js proxy** — `/api/:path*` rewrites to `BACKEND_ORIGIN`; `GET /api/orders/7` through
  the proxy returned 200 with a session.
- **Express route mounting** — `/api/orders/:id` is registered after the more specific
  `/:id/verify-payment` route, so no prefix collision.
- **Razorpay server-side order creation** — a live test-mode `POST /api/orders` with
  `paymentMethod: "razorpay"` returned **201** with
  `razorpay: { keyId: "rzp_test_…", orderId: "order_Tscol…", amountPaise }`.
- **`verify-payment` endpoint** — exists and rejects bad input; the 404 appeared only on the
  page navigation after payment, not on the API.

### Fix

- `/orders/[id]` is now a thin Server Component that renders static metadata and delegates to
  a client component. The client loads the order through the Next.js proxy
  (`GET /api/orders/:id`) with `credentials: "include"`, so the auth cookie travels with it.
- Explicit states: loading skeleton, `401` → “Please log in” with a safe redirect back,
  `404` → “Order not found”, network error → retry. A cross-customer order produces the same
  404 (verified in tests), so ownership does not leak.
- The page no longer performs any unauthenticated backend fetch.

---

## 2. Payment verification contract

`POST /api/orders/:id/verify-payment` now treats the browser callback as a hint only:

1. HMAC `SHA256(orderId|paymentId)` checked against `RAZORPAY_KEY_SECRET` (timing-safe).
2. `payments.fetch(paymentId)` on the server (authoritative) and assert:
   - `payment.order_id === order.razorpay_order_id`
   - `payment.currency === "INR"`
   - `payment.amount === round(order.total × 100)`
   - the payment is captured
3. Only then the order moves to `paymentStatus: "paid"`, `status: "confirmed"`.
4. The update is conditional on `paymentStatus != "paid"`, so concurrent callbacks converge.
   A repeat callback for the same payment returns 200 idempotently; a different payment id
   for an already-paid order returns 409.

Statuses used by this flow (`orders.payment_status`):

| Value | Meaning |
| --- | --- |
| `cod_due` | COD order created; nothing collected |
| `pending` | UPI reference saved, or a Razorpay order created but not verified |
| `paid` | Verified with Razorpay (signature + provider lookup) |
| `failed` | Reserved for reconciliation/admin flows |

Error mapping:

| Situation | HTTP |
| --- | --- |
| validation / business rule (empty cart, out of stock, non-online order) | 400 |
| bad signature, wrong amount/currency/order, not captured | 422 |
| order already paid by another payment | 409 |
| duplicate order submission while one is in flight | 409 |
| Razorpay unreachable / rejects the lookup | 502 (safe message; provider detail logged without secrets) |
| Razorpay keys not configured | 503 |

`POST /api/orders/:id/retry-payment` (new) starts a fresh Razorpay attempt for an unpaid
Razorpay order: it re-reads the server-side total, creates a new Razorpay order, replaces the
stored `razorpay_order_id` (the previous attempt is left unpaid and orphaned at the provider)
and returns `{ keyId, orderId, amountPaise }`. Used by the “Pay now” button on the order page
when the popup was closed, failed, or the script could not load. No new schema was required.

Cart clearing: the cart is emptied **inside the same transaction** that creates the order,
after the payment adapter has succeeded. A failed validation, out-of-stock item, or provider
error leaves the cart untouched (covered by tests).

---

## 3. Checkout redirect flags and feedback

Checkout redirects with `placed=1` plus one of:

| Flag | Meaning | Banner rule |
| --- | --- | --- |
| `pay=success` | Checkout callback verified | Success **only if the backend says `paid`**; otherwise “Confirming your payment” warning |
| `pay=pending` | Popup dismissed | Razorpay → “Payment not completed”; UPI → awaiting store verification; COD → pay on delivery |
| `pay=retry` | Payment failed / script unavailable | Warning with “Pay now” when the order is still unpaid |
| `pay=cancelled` | Reserved for explicit cancellation | Informational, retry allowed |
| `placed=1` only | COD or UPI order placed | Method-specific unpaid messaging |

Query parameters are never proof: the banner is computed from the order returned by
`GET /api/orders/:id`. A stale `pay=retry` link on a paid order shows success, and
`pay=success` on an unpaid order shows a warning (both unit-tested).

---

## 4. Duplicate submissions and races

- **Client:** a `useRef` single-flight guard blocks re-entry even before React re-renders,
  and the submit button is disabled while placing.
- **Server (durable idempotency, shipped):** the browser generates one key per checkout
  attempt (`sessionStorage`, cleared on success) and sends it in the `Idempotency-Key` header
  (`/^[A-Za-z0-9._:-]{16,64}$/`). `createOrderFromCart` persists it on the order
  (`orders.customer_id + idempotency_key` unique index, migration `20261027000000`), so a
  duplicate submission returns the **same order** with `replay: true` — HTTP **200 replay,
  201 create** — no second cart consumption, no second Razorpay order. Concurrent same-key
  submissions coalesce on the in-flight winner instead of both failing.
- **Verification:** conditional `updateMany` prevents two callbacks from writing inconsistent
  state; the payment capture settlement (mark paid + status move + stock ledger claim) is now
  **one transaction shared by verify / webhook / sweeper** (see §4b).
- **Remaining:** the in-flight coalescing map is process-local — fine, because the durable
  key covers multi-instance correctness; the map only reduces duplicate *work*.

### 4b. Stock on order (shipped, owner: Agent 2 — this file's owner)

Checkout consumes stock now ("Stock on order"); the previous contract (no reserve, no
decrement at checkout) is **retired**. Details in `docs/admin-api-contract.md` §6:

- **COD / UPI:** stock decremented atomically **inside the placement transaction**
  (conditional `UPDATE ... WHERE stock_quantity >= qty`). Insufficient stock rolls the whole
  placement back — no order, no cart clear, 409 to the customer.
- **Razorpay:** nothing decrements at placement. The single winner of payment success
  (browser verify-payment, captured webhook, or reconciliation sweeper) performs the one-shot
  deduction in the same transaction that marks the order paid. A failed payment writes no
  stock state.
- **Cancellation (admin):** restores stock for orders that consumed it, fenced once by the
  same ledger (`restore:order`). Cancelling an unpaid Razorpay order restores nothing.
- **Overselling / double-decrement:** prevented by conditional updates + a durable one-shot
  stock ledger reusing `webhook_events` (provider `stock-ledger`, event ids
  `deduct:order:*`, `deduct:pay:*`, `restore:order:*`).

### Webhook / reconciliation (shipped)

- `POST /api/payments/razorpay/webhook` is mounted **before** the global `express.json`, with
  a route-scoped `express.raw({ type: "*/*", limit: "256kb" })` so the HMAC is computed on
  Razorpay's exact bytes (body-parser v2 does not re-parse already-parsed streams).
- Signature verified timing-safe over the raw body; **fail-closed** (`503`) when
  `RAZORPAY_WEBHOOK_SECRET` is unset — webhook processing must be enabled in production by
  configuring the secret in the Razorpay dashboard.
- Every event is recorded in `webhook_events`; the unique `(provider, event_id)` index makes
  redeliveries idempotent (second delivery is acknowledged as a replay without reprocessing).
- `payment.captured` / `order.paid` reconcile the local order through the shared
  transactional settlement (amount/currency checks, conditional paid update, one-shot stock
  deduction, status-history note). `payment.failed` is recorded, the order stays retryable.
- The sweep (`PAYMENTS_RECONCILE_MINUTES`, default off; `reconcilePendingRazorpayOrders`)
  pages through stale pending orders with an `(updated_at, id)` cursor, so a long backlog of
  provider-unpaid rows can no longer starve newer pendings.

---

## 5. COD and manual UPI semantics

- **COD** is created as `status: pending`, `paymentStatus: cod_due`. The UI states that nothing
  has been paid and the amount is due on delivery. It is never counted as collected revenue
  (no code path sets `paid` for COD).
- **UPI** requires a 12-digit numeric transaction reference (validated by Zod on the server and
  by the form in the browser). The reference is stored, but the order stays
  `paymentStatus: pending`; the reference is explicitly described as a customer claim, not
  proof of payment. Reconciliation is manual until a verified process exists.

---

## 6. Tests

Commands:

```bash
npm test                 # frontend feedback/flag logic (node:test via tsx)
npm run test:backend     # backend unit + HTTP integration (requires local MySQL)
npm test --prefix backend
```

Counts at time of writing (2026-10-27; assertions below are the contract):

- Frontend: `src/lib/order-feedback.test.ts` — flag parsing, “paid beats flag”, unpaid + `success`
  never claims payment, COD/UPI wording, retry availability, status labels.
- Backend (`backend/test/*.test.ts`, now run with
  `tsx --test --test-concurrency=1` — one file at a time because multiple suites share the
  dev MySQL instance; last full run **69 tests / 68 pass / 1 fail**, the single fail being the
  integration agent's in-flight image-upload work, not payment/order scope):
  - `payment.test.ts` — signature valid/tampered/mismatched/empty, missing secret, bad
    signature rejected before contacting Razorpay, paise rounding, COD state, UPI pending,
    Razorpay 503 without keys, non-payable amount.
  - `checkout-schema.test.ts` — defaults, address/phone/pincode validation, unknown method,
    UPI reference rules, verification schema.
  - `order-flow.test.ts` — runs the real Express app against the local DB: 401s without a
    session, empty-cart rejection, quantity validation and server totals, COD creation with
    cart clearing, order ownership (other customer → 404), UPI reference rules, unavailable
    product at checkout, archived product blocked at checkout, duplicate concurrent submits
    (exactly one order), forged signature → 422 with order still pending, non-online
    verification → 400, idempotent repeat callback → 200, conflicting payment id → 409.
    Test customers/products are removed afterwards.
  - `admin-api.test.ts` — admin authorization (401 anonymous vs 403 customer on every
    `/api/admin/*` list), product create/patch/archive/restore, image upload validation and
    serving, audited stock adjustments (negative/zero/no-reason rejected), server-validated
    order transitions with `409` on illegal or stale moves, dashboard payment buckets, inquiry
    updates. Removes everything it creates.
- Builds: `npm run build` (Next) and `npm run build` in `backend` both pass;
  `tsc --noEmit` passes for both.

Manual end-to-end (Playwright, headless Chromium, servers running):

- login → product → cart → checkout → COD → order detail, banner, address, items: pass.
- `pay=success` on an unpaid COD order shows the warning, not “Payment received”: pass.
- cart empty after checkout: pass.
- another customer opening the same order sees “Order not found”: pass.
- order appears in `/orders`: pass.
- invalid 11-digit UPI reference blocked in the browser: pass.
- password-manager autocomplete: login email `username`, login password `current-password`,
  registration password/confirm `new-password`: pass.
- Only console noise: expected `401 /api/auth/me` probes while logged out (pre-existing).
- Admin dashboard walkthrough (desktop + mobile): signed-out redirect, customer account
  refused, overview, order search/filter/detail, confirm with confirmation dialog, illegal
  transition rejected with 409, product create, image upload, stock adjustment, inquiry
  resolve, mobile drawer: pass.

Razorpay verification against the **real test-mode API**: a successful card payment was
captured end-to-end (see §7 item 1 for evidence) plus the earlier failure-path run (a valid
signature for a non-existent payment id reached `payments.fetch`, returned Razorpay
`400 BAD_REQUEST_ERROR`, the API responded **502**, and the order stayed `pending`).

---

## 7. Known limitations / follow-ups

1. **Razorpay lifecycle status (verified, not assumed):** a **real Razorpay test-mode card
   payment** (official Visa test card `4100 2800 0000 1007`) was driven through the hosted
   checkout in a real Chrome browser on 2026-10-27 and captured on Razorpay's side. Evidence:
   local order **250** → confirmed / `payment_status=paid` /
   `payment_ref=pay_TseoLU5C1j1kvn`, cross-checked live against
   `GET /v1/payments/pay_TseoLU5C1j1kvn` = `status: "captured"`, ₹266.00, method `card`,
   `order_id=order_Tseo43tyilGfFi`. So the browser-callback → `POST /verify-payment` (HMAC) →
   paid/confirmed path is **verified for real test traffic**, not mocks.
   What remains **mock-only verified**: webhook intake/signature/idempotency (signed replay
   tests), the reconciliation sweeper (overridden provider lookup), and webhook **delivery
   from Razorpay itself** (no webhook secret configured on this dev box; the endpoint is
   fail-closed 503 there). No real-money charge possible in test mode.
2. Stock ledger rows live in `webhook_events` with provider `stock-ledger`; if a future
   cleanup prunes that table, the one-shot fencing is gone — prune only with `provider =
   'razorpay'` filters plus old timestamps, never the ledger prefix.
3. Test data note: sandbox runs created ~18 `sandbox_*` customers with pending razorpay
   orders (246, 248–253, …) in the **dev** database; they are excluded from counting but
   `prisma migrate status`/sweeps do see them. Clean-up is a deliberate decision for the
   deployment database owner (no destructive ops performed here).
4. Pre-existing lint errors remain in three product-browsing components untouched by this
   work: `react-hooks/set-state-in-effect` in `src/components/product-detail.tsx`,
   `shop-catalog.tsx`, `shop-product-detail.tsx`. The ordering pages were cleaned up.
5. Guest visits log `401` for `GET /api/auth/me` (expected probe used to resolve auth state).
6. Migration/deployment state: the two admin migrations are recorded as applied
   (`docs/integration-report.md` §5 is now historical); the rolled-back
   `20260811183220_add_cart_orders` row remains in `_prisma_migrations` — see the migration
   report below for the decision to leave it.

### Razorpay sandbox runbook (how to reproduce the test-mode payment)

1. `cd frontend-... && npm run dev` (:3000) + backend on :5000 with Test keys
   (`RAZORPAY_KEY_ID/SECRET`, no webhook secret → endpoints stay fail-closed).
2. Register an account, add `Urea Fertilizer` qty 1, checkout with
   **Card / UPI / Netbanking (Online)**.
3. In the Razorpay popup: choose **Cards**, enter `4100 2800 0000 1007`, any future expiry,
   any CVV, Continue. Test mode completes the capture without a mock bank page for Visa
   debit; on callback the app calls `verify-payment` and redirects to
   `/orders/:id?placed=1&pay=success`.
4. Authoritative check: `curl -u KEY:SECRET https://api.razorpay.com/v1/payments/{id}`
   shows `status: "captured"`.
   (Playwright automation tip: click **Continue, then touch nothing** — the save-card prompt
   and anti-fraud checks self-resolve; clicking them derails the payment.)

---

## 8. Files changed by this work

Backend:

- `backend/src/services/payment.service.ts` — provider error types, Razorpay order creation
  helper, authoritative payment lookup, full verification (order/amount/currency/capture).
- `backend/src/services/order.service.ts` — per-customer submit lock, accurate `ApiError`
  statuses, UPI reference handling, idempotent + concurrency-safe confirmation,
  `resumeRazorpayPayment`; durable idempotency (`orders.idempotency_key` + replay 200/201
  contract) and **atomically stock-consuming placement for COD/UPI** + settlement call.
- `backend/src/services/webhook.service.ts` — signed webhook intake, event ledger,
  reconciliation sweeper (cursored batching), `settleCapturedPaymentOnOrder` shared by all
  three payment-success writers.
- `backend/src/services/stock-ledger.service.ts` — NEW: one-shot stock ledger
  (deduct/restore claims) + conditional row-level decrements (oversell-proof).
- `backend/src/services/admin-order.service.ts` — cancellation restores consumed stock once.
- `backend/src/services/admin-inventory.service.ts` — `FOR UPDATE` row-lock for adjustments.
- `backend/src/routes/payment.routes.ts`, `backend/src/app.ts` — signed webhook route with
  route-scoped raw body, mounted before the global JSON parser.
- `backend/src/controllers/order.controller.ts` — stop masking every error as 400; add retry.
- `backend/src/routes/order.routes.ts` — `POST /:id/retry-payment`.
- `backend/src/schemas/order.schema.ts` — 12-digit UPI reference rule.
- `backend/prisma/migrations/20261027000000_add_webhook_events_and_order_idempotency/` —
  `webhook_events` + `orders.idempotency_key` + unique index.
- `backend/test/*`: `webhook.test.ts` (14), `order-idempotency.test.ts` (6, stock-restoring),
  `inventory-decrement.test.ts` (9, NEW), `inventory-concurrency.test.ts` (2),
  `order-flow.test.ts` (stock-restoring), `payment.test.ts`, `checkout-schema.test.ts`,
  `admin-api.test.ts`. `backend/.env.example` (webhook + reconcile vars).
  `backend/package.json` — test script fixed to actually run the tests.

Frontend:

- `src/app/orders/[id]/page.tsx` — no unauthenticated server fetch; authenticated client load.
- `src/app/orders/[id]/order-detail-content.tsx` — new: order rendering, feedback banners,
  pay-now/retry, errors.
- `src/app/orders/orders-content.tsx` — reload-key loading, error-safe list.
- `src/app/checkout/checkout-content.tsx` — shared Checkout.js helper, single-flight submit,
  UPI length check, feedback flags.
- `src/lib/order-api.ts` — status-aware `OrderApiError`, `retryPayment`.
- `src/lib/order-feedback.ts` — flag + banner logic (pure).
- `src/lib/order-feedback.test.ts` — tests.
- `src/lib/razorpay-checkout.ts` — retry-safe script loader and popup wrapper with
  dismiss/fail/unavailable outcomes.
- `src/components/auth/login-form.tsx`, `src/components/auth/register-form.tsx` —
  autocomplete contract.
- `src/components/ui/status-badge.tsx` — tones for shipped/delivered.
- `package.json` — `test`, `test:backend`, `tsx` devDependency.
