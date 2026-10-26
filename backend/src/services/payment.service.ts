import crypto from "node:crypto";
import Razorpay from "razorpay";
import type { PaymentMethod } from "../schemas/order.schema.js";
import { ApiError } from "../utils/apiError.js";

export type PaymentInit = {
  method: PaymentMethod;
  amountPaise: number;
  receipt: string;
};

export type PaymentInitResult =
  | { method: "cod"; paymentStatus: "cod_due"; instructions: string }
  | { method: "upi"; paymentStatus: "pending"; upiId: string | null; instructions: string }
  | {
      method: "razorpay";
      paymentStatus: "pending";
      razorpayOrderId: string;
      keyId: string;
      amountPaise: number;
    };

/** Raised when Razorpay (or our credentials) can't be reached. 502 = upstream failure. */
export class PaymentProviderError extends ApiError {
  constructor(
    message = "Online payments are temporarily unavailable. Please choose Cash on Delivery or UPI, or try again shortly."
  ) {
    super(502, message);
    this.name = "PaymentProviderError";
  }
}

/** Raised when a payment can't be trusted (bad signature, wrong amount, not captured). */
export class PaymentVerificationError extends ApiError {
  constructor(message = "We couldn't verify this payment.") {
    super(422, message);
    this.name = "PaymentVerificationError";
  }
}

/** Shape of the Razorpay payment entity we rely on for reconciliation. */
export type VerifiedRazorpayPayment = {
  id: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  status: string;
  captured: boolean;
  method: string | null;
};

type RawRazorpayPayment = {
  id: string;
  order_id: string;
  amount: number | string;
  currency: string;
  status: string;
  captured?: boolean;
  method?: string | null;
};

export function getRazorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function isRazorpayConfigured(): boolean {
  return getRazorpayClient() !== null;
}

/**
 * Log-safe description of a Razorpay SDK error.
 * Never logs key ids, secrets, card data or the full response body.
 */
function describeRazorpayError(error: unknown): string {
  if (error && typeof error === "object") {
    const candidate = error as {
      statusCode?: number;
      error?: { code?: string; description?: string };
    };
    const code = candidate.error?.code ?? "unknown";
    const description = candidate.error?.description ?? "";
    return `status=${candidate.statusCode ?? "?"} code=${code} description=${description}`.slice(
      0,
      300
    );
  }
  return "unknown error";
}

export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Creates a Razorpay order (INR) for Checkout.js.
 * Throws ApiError subclasses so controllers can surface an accurate status.
 */
export async function createRazorpayOrder(init: {
  amountPaise: number;
  receipt: string;
}): Promise<{ razorpayOrderId: string; keyId: string; amountPaise: number }> {
  const client = getRazorpayClient();
  const keyId = process.env.RAZORPAY_KEY_ID;

  if (!client || !keyId) {
    throw new ApiError(
      503,
      "Online payments are not enabled right now. Choose Cash on Delivery or UPI."
    );
  }

  if (!Number.isInteger(init.amountPaise) || init.amountPaise <= 0) {
    throw new ApiError(400, "This order has no payable amount.");
  }

  try {
    const rpOrder = await client.orders.create({
      amount: init.amountPaise,
      currency: "INR",
      receipt: init.receipt,
    });

    return {
      razorpayOrderId: rpOrder.id,
      keyId,
      amountPaise: init.amountPaise,
    };
  } catch (error) {
    console.error("[razorpay] order creation failed", describeRazorpayError(error));
    throw new PaymentProviderError(
      "We couldn't start the online payment. Choose Cash on Delivery or UPI, or try again in a moment."
    );
  }
}

/**
 * Payment gateway adapter.
 *
 * - COD: no online payment, payable on delivery.
 * - UPI: customer pays to the store's UPI ID and submits the txn ref.
 * - Razorpay: creates a Razorpay order (INR) for checkout.js.
 */
export async function initPayment(init: PaymentInit): Promise<PaymentInitResult> {
  if (init.method === "cod") {
    return {
      method: "cod",
      paymentStatus: "cod_due",
      instructions: "Pay in cash or UPI when your order is delivered.",
    };
  }

  if (init.method === "upi") {
    return {
      method: "upi",
      paymentStatus: "pending",
      upiId: process.env.STORE_UPI_ID ?? null,
      instructions: process.env.STORE_UPI_ID
        ? `Pay to ${process.env.STORE_UPI_ID} and enter your 12-digit UPI transaction reference.`
        : "Pay via UPI and enter your transaction reference.",
    };
  }

  const rpOrder = await createRazorpayOrder({
    amountPaise: init.amountPaise,
    receipt: init.receipt,
  });

  return {
    method: "razorpay",
    paymentStatus: "pending",
    razorpayOrderId: rpOrder.razorpayOrderId,
    keyId: rpOrder.keyId,
    amountPaise: rpOrder.amountPaise,
  };
}

/** Verify the checkout.js callback signature: HMAC_SHA256(orderId|paymentId). */
export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(razorpaySignature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Loads the authoritative payment record from Razorpay.
 * Never trust the browser callback alone — this is the source of truth.
 */
export async function fetchRazorpayPayment(
  paymentId: string
): Promise<VerifiedRazorpayPayment> {
  const client = getRazorpayClient();
  if (!client) {
    throw new ApiError(
      503,
      "Online payments are not configured, so this payment can't be verified. Please contact the store."
    );
  }

  if (!paymentId || !paymentId.trim()) {
    throw new PaymentVerificationError("Missing payment id.");
  }

  try {
    const payment = (await client.payments.fetch(
      paymentId
    )) as unknown as RawRazorpayPayment;

    return {
      id: payment.id,
      orderId: payment.order_id,
      amountPaise: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      captured: payment.captured === true || payment.status === "captured",
      method: payment.method ?? null,
    };
  } catch (error) {
    console.error("[razorpay] payment lookup failed", describeRazorpayError(error));
    throw new PaymentProviderError(
      "We couldn't reach the payment provider to confirm this payment. Please try again in a moment."
    );
  }
}

/**
 * Full payment verification:
 * 1. HMAC signature from Checkout.js
 * 2. payment belongs to the Razorpay order we created
 * 3. amount + currency match the server-calculated order total
 * 4. payment is captured
 */
export async function verifyRazorpayPaymentForOrder(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  expectedAmountPaise: number;
}): Promise<VerifiedRazorpayPayment> {
  if (
    !verifyRazorpaySignature(
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature
    )
  ) {
    throw new PaymentVerificationError(
      "Payment signature verification failed. Your order is still pending."
    );
  }

  const payment = await fetchRazorpayPayment(input.razorpayPaymentId);

  if (payment.orderId !== input.razorpayOrderId) {
    throw new PaymentVerificationError(
      "This payment doesn't belong to this order. Your order is still pending."
    );
  }

  if (payment.currency !== "INR") {
    throw new PaymentVerificationError(
      "This payment was made in an unsupported currency. Your order is still pending."
    );
  }

  if (payment.amountPaise !== input.expectedAmountPaise) {
    throw new PaymentVerificationError(
      "The paid amount doesn't match this order. Please contact the store before retrying."
    );
  }

  if (!payment.captured) {
    throw new PaymentVerificationError(
      "Your payment hasn't been captured yet. Please refresh this order in a moment."
    );
  }

  return payment;
}
