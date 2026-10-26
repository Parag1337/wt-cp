# Razorpay webhook — staging verification procedure (B-2)

**Status: prepared, awaiting a staging environment.** No staging URL reachable from the
Razorpay dashboard was available when this document was produced, so *no delivery evidence
is claimed in this file*. Do not mark B-2 complete until the checklist below has been
executed against a real Razorpay **test-mode** dashboard and the evidence table has been
filled in.

## 1. Preconditions

- Staging backend deployed with HTTPS endpoint (e.g. `https://staging.example.com/api/payments/razorpay/webhook`).
- Razorpay account in **test mode** (test keys `rzp_test_…` only). Never configure a webhook
  pointing at staging with live/real-money keys.
- Staging `.env` holds the same test key pair (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) that
  the dashboard will sign with, and `RAZORPAY_WEBHOOK_SECRET` set to a fresh random string
  (e.g. `openssl rand -hex 32`) that is entered in the dashboard UI, not reused from anywhere else.
- Staging DB reachable; reconciliation sweep cron/config available (see §5).

## 2. Configure the webhook in the Razorpay dashboard (test mode)

1. Dashboard → Settings → Webhooks → **Add New Webhook**.
2. URL: the HTTPS staging endpoint above (http:// is rejected by Razorpay; a tunnel such as
   ngrok may be used for a temporary laptop staging setup, but record that fact in the evidence).
3. Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`.
4. Events: select exactly the events the backend acts on — `payment.captured`,
   `payment.failed`, and `order.paid`. Adding more is harmless here but keep the list minimal
   and matching `backend/src/services/webhook.service.ts`.
5. Save. Razorpay shows the webhook as "Active" and sends a test delivery option.

## 3. Delivery verification (real provider, not mocked)

Execute each row and paste the concrete evidence (timestamp, event id, DB row, log line).
Events must be traced end-to-end by their `event_id`/provider event id in `webhook_events`.

| # | Check | How | Expected | Evidence (fill in) |
| --- | --- | --- | --- | --- |
| 3.1 | Test-mode delivery of `payment.captured` arrives at staging | dashboard "send test" + a real test-mode ₹1 order paid with a test UPI/netbanking instrument | `webhook_events` row with provider `razorpay`, `status processed`; order/payment transitions to `paid`; stock decremented once | |
| 3.2 | Signature check rejects tampering | replay the same delivery with one byte of the body changed (e.g. `curl` a captured payload with a modified amount) | HTTP 422, `webhook_events` row (or log) records invalid-signature rejection; **no** payment transition, **no** stock change | |
| 3.3 | Repeated delivery does not double-apply | use dashboard "resend"/manual replay of the same event 2–3 times | single `paid` transition; total `webhook_events` processed once per unique event id; stock decremented exactly once (ledger rows unchanged after first) | |
| 3.4 | `payment.failed` handling | trigger a failed test payment | order stays unpaid (`pending`/`failed` as designed), no stock deduction, retry-payment still offered | |
| 3.5 | Non-captured / wrong amount | send a captured event whose amount ≠ stored amount (crafted via a second test order's payload) | 422 rejection, no state change | |

Note explicitly in the evidence whether each row was produced by the **real Razorpay test
infra** or by a local mock replay. A local `curl` replay of a captured payload still proves
the signature/idempotency paths (3.2, 3.3) but is NOT evidence of provider delivery (3.1) —
the webhook service tests (`backend/test/webhook.test.ts`) already cover the mocked paths;
only dashboard-initiated deliveries count for B-2 completion.

## 4. Idempotency invariants to confirm in DB

- `webhook_events` unique index on `(provider, event_id)` prevents a duplicate row; second
  delivery of the same id must reuse the first row.
- Payment verification is idempotent independently (`order-idempotency.test.ts` covers the
  order-submission key); confirm a replayed webhook does not clear the cart twice or create a
  second order.
- Stock: total `stock_ledger` (or decrement logic used) for the order equals the ordered
  quantity minus any admin cancellation restore — never double.

## 5. Missed-event handling (reconciliation sweep)

1. While the webhook is temporarily disabled in the dashboard, complete a test-mode payment.
2. Confirm the sweep (the reconciliation path that calls `paymentApi` provider lookup for
   unpaid Razorpay orders) marks the order `paid` within its scheduled interval, writes the
   `webhook_events`/payment rows with a "reconciliation" origin, and adjusts stock once.
3. Re-enable the webhook. The late delivery must hit the idempotency path and be a no-op
   (this is the same invariant as 3.3 — record its evidence).

## 6. Sign-off

B-2 may be flipped to **fixed** only when:

- [ ] every row of §3 has real evidence with timestamps and event ids,
- [ ] §4 invariants verified by direct DB query on staging,
- [ ] §5 sweep run observed once,
- [ ] the evidence file/photograph of the dashboard webhook config (URL, events, test-mode badge) is archived,
- [ ] a staging teardown removes the webhook + secret so no test-mode credentials linger.

Production rollout follows the identical steps with live keys and real HTTPS domain, after a
successful staging sign-off.
