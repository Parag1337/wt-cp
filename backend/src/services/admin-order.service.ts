import type { Order, OrderItem, Product } from "../generated/client/client.js";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import {
  hasCaptureDeduction,
  hasPlacementDeduction,
  claimStockEvent,
  restoreEventId,
  restoreStockWithinTx,
} from "./stock-ledger.service.js";
import { ApiError, ConflictError } from "../utils/apiError.js";
import { resolveProductImage } from "./admin-product.service.js";

export const ORDER_FULFILMENT_FLOW = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
] as const;

export const ORDER_STATUSES = [...ORDER_FULFILMENT_FLOW, "cancelled"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Permitted moves. Forward steps can be skipped (a small shop may confirm and
 * deliver the same day), but nothing moves backwards, delivered is terminal,
 * and cancellation is only possible before dispatch.
 */
const TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ["confirmed", "processing", "cancelled"],
  confirmed: ["processing", "packed", "cancelled"],
  processing: ["packed", "shipped", "cancelled"],
  packed: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function allowedTransitionsFor(status: string): OrderStatus[] {
  return TRANSITIONS[status] ?? [];
}

const orderListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.string().trim().max(32).optional(),
  paymentStatus: z.string().trim().max(32).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const orderStatusInputSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

type OrderWithItems = Order & {
  items: (OrderItem & { product: Product })[];
  customer: { id: number; fullName: string; email: string; phone: string };
};

const adminOrderInclude = {
  items: { include: { product: true }, orderBy: { createdAt: "asc" } },
  customer: { select: { id: true, fullName: true, email: true, phone: true } },
} as const;

export type AdminOrderSummary = {
  id: number;
  createdAt: string;
  status: string;
  total: string | null;
  itemCount: number;
  customer: { id: number; fullName: string; email: string; phone: string };
  shippingTo: { fullName: string; phone: string; city: string; pincode: string };
  payment: { method: string; status: string; ref: string | null };
};

export function toAdminOrderSummary(order: OrderWithItems): AdminOrderSummary {
  return {
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    total: order.total ? order.total.toFixed(2) : null,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    customer: order.customer,
    shippingTo: {
      fullName: order.fullName,
      phone: order.phone,
      city: order.city,
      pincode: order.pincode,
    },
    payment: {
      method: order.paymentMethod,
      status: order.paymentStatus,
      ref: order.paymentRef,
    },
  };
}

export async function listAdminOrders(rawQuery: unknown) {
  const query = orderListQuerySchema.parse(rawQuery);
  const where: Record<string, unknown> = {};

  if (query.status) where.status = query.status;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
  if (query.q) {
    const or: Record<string, unknown>[] = [
      { fullName: { contains: query.q } },
      { phone: { contains: query.q } },
      { customer: { email: { contains: query.q } } },
      { customer: { fullName: { contains: query.q } } },
    ];
    if (/^#?\d+$/.test(query.q)) or.push({ id: Number(query.q.replace("#", "")) });
    where.OR = or;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: adminOrderInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data: orders.map(toAdminOrderSummary),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getAdminOrder(id: number) {
  const order = await prisma.order.findUnique({ where: { id }, include: adminOrderInclude });
  if (!order) throw new ApiError(404, "Order not found.");

  const history = await prisma.orderStatusHistory.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "asc" },
    include: { admin: { select: { fullName: true } } },
  });

  return {
    ...toAdminOrderSummary(order),
    address: {
      fullName: order.fullName,
      phone: order.phone,
      addressLine1: order.addressLine1,
      addressLine2: order.addressLine2,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
    },
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      productImage: resolveProductImage(item.product.image),
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      subtotal: (parseFloat(item.unitPrice.toString()) * item.quantity).toFixed(2),
    })),
    history: history.map((entry) => ({
      id: entry.id,
      status: entry.status,
      note: entry.note,
      at: entry.createdAt.toISOString(),
      by: entry.admin?.fullName ?? null,
    })),
    allowedTransitions: allowedTransitionsFor(order.status),
  };
}

/**
 * Moves an order to `next` inside a transaction and records the change in
 * `order_status_history`.
 *
 * Stock model (docs/ordering-flow.md §4 — "Stock on order"): checkout consumes
 * stock at placement (COD/UPI) or payment capture (Razorpay). Cancelling an
 * order therefore RESTORES the consumed stock — once, fenced by the stock
 * ledger (`restore:order:{id}`), inside the same transaction as the status
 * move. An unpaid Razorpay order that never captured money never consumed
 * stock, and is cancelled without a stock write.
 */
export async function updateAdminOrderStatus(
  orderId: number,
  adminId: number,
  input: z.infer<typeof orderStatusInputSchema>
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      paymentRef: true,
    },
  });
  if (!order) throw new ApiError(404, "Order not found.");

  const next = input.status;
  const allowed = allowedTransitionsFor(order.status);
  if (!allowed.includes(next)) {
    throw new ConflictError(
      `An order that is "${order.status}" can't be changed to "${next}".`
    );
  }

  await prisma.$transaction(async (tx) => {
    // Conditional update so two admins tapping at once can't both win.
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: next },
    });
    if (updated.count === 0) {
      throw new ConflictError("This order was just updated by someone else. Refresh and try again.");
    }

    await tx.orderStatusHistory.create({
      data: { orderId, adminId, status: next, note: input.note || null },
    });

    if (next !== "cancelled") return;

    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { productId: true, quantity: true },
    });
    if (items.length === 0) return;

    // Restore only if this order actually consumed stock: either a
    // placement-time deduction (COD/UPI ledger) or a captured razorpay payment
    // (payment-level ledger for the payment that got us to "paid").
    let consumed = false;
    if (order.paymentMethod === "razorpay") {
      consumed = !!order.paymentRef && (await hasCaptureDeduction(tx, order.paymentRef));
    } else {
      consumed = await hasPlacementDeduction(tx, orderId);
    }
    if (!consumed) return;

    const restored = await claimStockEvent(
      tx,
      restoreEventId(orderId),
      `order #${orderId} cancelled → stock restored (${order.paymentMethod})`
    );
    if (restored) {
      await restoreStockWithinTx(
        tx,
        items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        "cancellation"
      );
    }
  });

  return getAdminOrder(orderId);
}
