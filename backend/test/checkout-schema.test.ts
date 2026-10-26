import test from "node:test";
import assert from "node:assert/strict";
import { checkoutSchema, verifyPaymentSchema } from "../src/schemas/order.schema.js";

const validAddress = {
  fullName: "Agent Three Test",
  phone: "9876543210",
  addressLine1: "12 Test Street",
  city: "Khamgaon",
  state: "Maharashtra",
  pincode: "444303",
};

function parse(overrides: Record<string, unknown>) {
  return checkoutSchema.safeParse({ ...validAddress, ...overrides });
}

function firstIssue(result: ReturnType<typeof parse>): string {
  return result.success ? "" : (result.error.issues[0]?.message ?? "");
}

test("a valid COD checkout passes and defaults to unpaid state inputs", () => {
  const result = parse({ paymentMethod: "cod" });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.paymentMethod, "cod");
  assert.equal(result.data.paymentRef, "");
  assert.equal(result.data.addressLine2, "");
});

test("the state defaults to Maharashtra", () => {
  const result = checkoutSchema.safeParse({
    ...validAddress,
    state: undefined,
    paymentMethod: "cod",
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.state, "Maharashtra");
});

test("invalid or missing delivery details are rejected", () => {
  assert.match(firstIssue(parse({ phone: "5876543210" })), /10-digit mobile/i);
  assert.match(firstIssue(parse({ phone: "98765" })), /10-digit mobile/i);
  assert.match(firstIssue(parse({ pincode: "44430" })), /6-digit pincode/i);
  assert.match(firstIssue(parse({ pincode: "4443031" })), /6-digit pincode/i);
  assert.match(firstIssue(parse({ addressLine1: "12" })), /street address/i);
  assert.match(firstIssue(parse({ city: "" })), /city/i);
  assert.match(firstIssue(parse({ fullName: "A" })), /full name/i);
});

test("unknown payment methods are rejected", () => {
  assert.equal(parse({ paymentMethod: "bitcoin" }).success, false);
});

test("UPI requires a 12-digit transaction reference", () => {
  assert.match(
    firstIssue(parse({ paymentMethod: "upi" })),
    /12-digit UPI transaction reference/i
  );
  assert.match(
    firstIssue(parse({ paymentMethod: "upi", paymentRef: "12345678901" })),
    /12-digit UPI transaction reference/i
  );
  assert.match(
    firstIssue(parse({ paymentMethod: "upi", paymentRef: "abcd56789012" })),
    /12-digit UPI transaction reference/i
  );

  const ok = parse({ paymentMethod: "upi", paymentRef: " 412345678901 " });
  assert.equal(ok.success, true);
  if (!ok.success) return;
  assert.equal(ok.data.paymentRef, "412345678901");
});

test("COD and Razorpay do not require a UPI reference", () => {
  assert.equal(parse({ paymentMethod: "cod" }).success, true);
  assert.equal(parse({ paymentMethod: "razorpay" }).success, true);
});

test("payment confirmation requires both provider fields", () => {
  assert.equal(
    verifyPaymentSchema.safeParse({ razorpayPaymentId: "pay_1", razorpaySignature: "sig" })
      .success,
    true
  );
  assert.equal(verifyPaymentSchema.safeParse({ razorpayPaymentId: "pay_1" }).success, false);
  assert.equal(verifyPaymentSchema.safeParse({ razorpaySignature: "sig" }).success, false);
});
