import type { Request, Response } from "express";
import {
  createOrderFromCart,
  confirmRazorpayPayment,
  listOrders,
  getOrderById,
  resumeRazorpayPayment,
} from "../services/order.service.js";
import { checkoutSchema, verifyPaymentSchema } from "../schemas/order.schema.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Idempotency-Key header: 16–64 chars of [A-Za-z0-9._:-] (crypto.randomUUID()
 * is 36). Groups of the same key are scoped per customer by the unique index.
 */
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,64}$/;

function readIdempotencyKey(req: Request): string | undefined {
  const header = req.get("Idempotency-Key");
  if (header === undefined) return undefined;
  const key = header.trim();
  if (key === "") return undefined;
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new ApiError(
      400,
      "The idempotency key must be 16-64 characters of letters, digits, dots, hyphens, underscores or colons."
    );
  }
  return key;
}

export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");

  const orders = await listOrders(customer.id);
  res.json({ success: true, orders });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");

  const orderId = Number(req.params.id);
  if (isNaN(orderId)) throw new ApiError(400, "Invalid order ID.");

  const order = await getOrderById(customer.id, orderId);
  if (!order) throw new ApiError(404, "Order not found.");

  res.json({ success: true, order });
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Check your delivery details.";
    throw new ApiError(400, message);
  }

  // Errors thrown by the service are ApiError subclasses carrying the correct
  // status (400 business rule, 409 duplicate submit, 502 payment provider,
  // 503 gateway not configured). Let the central error handler render them.
  const { order, razorpay, replay } = await createOrderFromCart(
    customer.id,
    parsed.data,
    readIdempotencyKey(req)
  );
  // A replay is answered 200 (not 201): the order already existed and was
  // created by an earlier request with this same key.
  res.status(replay ? 200 : 201).json({ success: true, order, razorpay, replay });
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");

  const orderId = Number(req.params.id);
  if (isNaN(orderId)) throw new ApiError(400, "Invalid order ID.");

  const parsed = verifyPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid payment confirmation.");
  }

  const order = await confirmRazorpayPayment(
    customer.id,
    orderId,
    parsed.data.razorpayPaymentId,
    parsed.data.razorpaySignature
  );
  res.json({ success: true, order });
});

export const retryPayment = asyncHandler(async (req: Request, res: Response) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");

  const orderId = Number(req.params.id);
  if (isNaN(orderId)) throw new ApiError(400, "Invalid order ID.");

  const { order, razorpay } = await resumeRazorpayPayment(customer.id, orderId);
  res.json({ success: true, order, razorpay });
});
