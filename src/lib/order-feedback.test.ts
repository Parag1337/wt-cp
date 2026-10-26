import test from "node:test";
import assert from "node:assert/strict";
import {
  canRetryPayment,
  getCheckoutFlag,
  getOrderFeedback,
  paymentStatusLabel,
} from "./order-feedback";
import type { Order } from "./order-api";

function makeOrder(options: {
  method?: string;
  paymentStatus?: string;
  orderStatus?: string;
  total?: string | null;
} = {}): Order {
  return {
    id: 7,
    customerId: 1,
    status: options.orderStatus ?? "pending",
    total: options.total === undefined ? "540.00" : options.total,
    createdAt: new Date("2026-10-26T12:00:00.000Z").toISOString(),
    payment: {
      method: options.method ?? "cod",
      status: options.paymentStatus ?? "cod_due",
      ref: null,
    },
    items: [],
  };
}

test("checkout flags are only read from a real checkout redirect", () => {
  assert.equal(getCheckoutFlag(new URLSearchParams("placed=1&pay=success")), "success");
  assert.equal(getCheckoutFlag(new URLSearchParams("placed=1&pay=pending")), "pending");
  assert.equal(getCheckoutFlag(new URLSearchParams("placed=1&pay=retry")), "retry");
  assert.equal(getCheckoutFlag(new URLSearchParams("placed=1&pay=cancelled")), "cancelled");
  assert.equal(getCheckoutFlag(new URLSearchParams("placed=1")), "placed");
  assert.equal(getCheckoutFlag(new URLSearchParams("placed=1&pay=whatever")), "placed");
  // A hand-edited query string without placed=1 is ignored entirely.
  assert.equal(getCheckoutFlag(new URLSearchParams("pay=success")), null);
  assert.equal(getCheckoutFlag(new URLSearchParams("")), null);
});

test("a success flag never overrides an unpaid backend state", () => {
  const feedback = getOrderFeedback(
    makeOrder({ method: "razorpay", paymentStatus: "pending", total: "540.00" }),
    "success"
  );
  assert.ok(feedback);
  assert.equal(feedback.tone, "warning");
  assert.equal(feedback.title, "Confirming your payment");
  assert.equal(feedback.canRetryPayment, true);
  assert.doesNotMatch(feedback.message, /payment received/i);
});

test("a paid order shows success even for a stale retry/cancel flag", () => {
  for (const flag of ["retry", "cancelled", "pending", "placed", null] as const) {
    const feedback = getOrderFeedback(
      makeOrder({ method: "razorpay", paymentStatus: "paid", orderStatus: "confirmed" }),
      flag
    );
    assert.ok(feedback);
    assert.equal(feedback.tone, "success", `flag ${flag}`);
    assert.equal(feedback.canRetryPayment, false);
    assert.match(feedback.message, /₹540/);
  }
});

test("COD orders are reported as unpaid, payable on delivery", () => {
  const feedback = getOrderFeedback(makeOrder({ method: "cod", paymentStatus: "cod_due" }), "placed");
  assert.ok(feedback);
  assert.equal(feedback.tone, "info");
  assert.match(feedback.message, /Nothing has been paid yet/);
  assert.match(feedback.message, /₹540/);
  assert.equal(feedback.canRetryPayment, false);
});

test("UPI orders stay pending and say the reference is not proof of payment", () => {
  const feedback = getOrderFeedback(
    makeOrder({ method: "upi", paymentStatus: "pending", total: "266.00" }),
    "placed"
  );
  assert.ok(feedback);
  assert.equal(feedback.tone, "info");
  assert.match(feedback.title, /UPI payment pending/i);
  assert.match(feedback.message, /not proof of payment|will confirm/i);
  assert.equal(feedback.canRetryPayment, false);
});

test("Razorpay pending/retry paths offer a payment retry", () => {
  const order = makeOrder({ method: "razorpay", paymentStatus: "pending" });

  const retry = getOrderFeedback(order, "retry");
  assert.ok(retry);
  assert.equal(retry.tone, "warning");
  assert.equal(retry.canRetryPayment, true);
  assert.match(retry.message, /nothing has been charged/i);

  const pending = getOrderFeedback(order, "pending");
  assert.ok(pending);
  assert.equal(pending.canRetryPayment, true);

  const directVisit = getOrderFeedback(order, null);
  assert.ok(directVisit);
  assert.equal(directVisit.canRetryPayment, true);
  assert.match(directVisit.title, /Payment pending/);
});

test("cancelled payments are safe and retryable", () => {
  const feedback = getOrderFeedback(
    makeOrder({ method: "razorpay", paymentStatus: "pending" }),
    "cancelled"
  );
  assert.ok(feedback);
  assert.equal(feedback.tone, "info");
  assert.equal(feedback.canRetryPayment, true);
});

test("retry availability excludes COD, UPI, paid and cancelled orders", () => {
  assert.equal(canRetryPayment(makeOrder({ method: "razorpay", paymentStatus: "pending" })), true);
  assert.equal(canRetryPayment(makeOrder({ method: "razorpay", paymentStatus: "paid" })), false);
  assert.equal(canRetryPayment(makeOrder({ method: "cod", paymentStatus: "cod_due" })), false);
  assert.equal(canRetryPayment(makeOrder({ method: "upi", paymentStatus: "pending" })), false);
  assert.equal(
    canRetryPayment(
      makeOrder({ method: "razorpay", paymentStatus: "pending", orderStatus: "cancelled" })
    ),
    false
  );
});

test("payment status labels are human readable", () => {
  assert.equal(paymentStatusLabel("paid"), "Paid");
  assert.equal(paymentStatusLabel("cod_due"), "Pay on delivery");
  assert.equal(paymentStatusLabel("pending"), "Awaiting payment");
  assert.equal(paymentStatusLabel("needs_review"), "needs review");
});
