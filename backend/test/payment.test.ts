import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  createRazorpayOrder,
  initPayment,
  toPaise,
  verifyRazorpayPaymentForOrder,
  verifyRazorpaySignature,
} from "../src/services/payment.service.js";
import { ApiError } from "../src/utils/apiError.js";

const SECRET = "test_secret_for_unit_tests";
const originalSecret = process.env.RAZORPAY_KEY_SECRET;

function sign(orderId: string, paymentId: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

test.beforeEach(() => {
  process.env.RAZORPAY_KEY_SECRET = SECRET;
});

test.after(() => {
  if (originalSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
  else process.env.RAZORPAY_KEY_SECRET = originalSecret;
});

test("valid Razorpay signatures are accepted", () => {
  assert.equal(
    verifyRazorpaySignature("order_abc", "pay_123", sign("order_abc", "pay_123")),
    true
  );
});

test("tampered, mismatched and empty signatures are rejected", () => {
  assert.equal(
    verifyRazorpaySignature("order_abc", "pay_123", sign("order_abc", "pay_999")),
    false
  );
  assert.equal(
    verifyRazorpaySignature("order_abc", "pay_123", sign("order_other", "pay_123")),
    false
  );
  assert.equal(verifyRazorpaySignature("order_abc", "pay_123", ""), false);
  assert.equal(verifyRazorpaySignature("order_abc", "pay_123", "not-hex"), false);
});

test("signatures are rejected when no secret is configured", () => {
  delete process.env.RAZORPAY_KEY_SECRET;
  assert.equal(
    verifyRazorpaySignature("order_abc", "pay_123", sign("order_abc", "pay_123")),
    false
  );
});

test("payment verification refuses a bad signature before contacting Razorpay", async () => {
  await assert.rejects(
    verifyRazorpayPaymentForOrder({
      razorpayOrderId: "order_abc",
      razorpayPaymentId: "pay_123",
      razorpaySignature: "0".repeat(64),
      expectedAmountPaise: 54000,
    }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 422);
      assert.match(error.message, /signature verification failed/i);
      return true;
    }
  );
});

test("paise conversion rounds to the nearest integer", () => {
  assert.equal(toPaise(540), 54000);
  assert.equal(toPaise(266.5), 26650);
  assert.equal(toPaise(499.99), 49999);
});

test("COD creates an unpaid, pay-on-delivery state", async () => {
  const result = await initPayment({
    method: "cod",
    amountPaise: 54000,
    receipt: "test_receipt",
  });

  assert.equal(result.method, "cod");
  assert.equal(result.paymentStatus, "cod_due");
  assert.match(
    "instructions" in result ? result.instructions : "",
    /when your order is delivered/i
  );
});

test("UPI stays pending and surfaces the configured store UPI id", async () => {
  const originalUpi = process.env.STORE_UPI_ID;
  process.env.STORE_UPI_ID = "store@upi";

  try {
    const result = await initPayment({
      method: "upi",
      amountPaise: 26600,
      receipt: "test_receipt",
    });

    assert.equal(result.method, "upi");
    assert.equal(result.paymentStatus, "pending");
    assert.equal("upiId" in result ? result.upiId : null, "store@upi");
  } finally {
    if (originalUpi === undefined) delete process.env.STORE_UPI_ID;
    else process.env.STORE_UPI_ID = originalUpi;
  }
});

test("Razorpay is refused when credentials are missing", async () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;

  try {
    await assert.rejects(
      createRazorpayOrder({ amountPaise: 54000, receipt: "test_receipt" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.statusCode, 503);
        return true;
      }
    );
  } finally {
    if (keyId !== undefined) process.env.RAZORPAY_KEY_ID = keyId;
    if (keySecret !== undefined) process.env.RAZORPAY_KEY_SECRET = keySecret;
  }
});

test("Razorpay refuses a non-payable amount", async () => {
  await assert.rejects(
    createRazorpayOrder({ amountPaise: 0, receipt: "test_receipt" }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 400);
      return true;
    }
  );
});
