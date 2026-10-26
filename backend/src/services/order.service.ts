import type { Order, OrderItem, Product } from "../generated/client/client.js";
import { Prisma } from "../generated/client/client.js";
import { prisma } from "../config/prisma.js";
import type { CheckoutInput } from "../schemas/order.schema.js";
import {
  createRazorpayOrder,
  initPayment,
  toPaise,
  verifyRazorpayPaymentForOrder,
} from "./payment.service.js";
import { ApiError, ConflictError } from "../utils/apiError.js";
import {
  InsufficientStockError,
  claimStockEvent,
  deductStockWithinTx,
  placementDeductionEventId,
} from "./stock-ledger.service.js";
import { settleCapturedPaymentOnOrder } from "./webhook.service.js";

export type PublicOrderItem = {
  id: number;
  productId: number;
  productName: string;
  productImage: string | null;
  productCategory: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
};

export type PublicOrderAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
};

export type PublicOrderPayment = {
  method: string;
  status: string;
  ref: string | null;
};

export type PublicOrder = {
  id: number;
  customerId: number;
  status: string;
  total: string | null;
  createdAt: string;
  address: PublicOrderAddress;
  payment: PublicOrderPayment;
  items: PublicOrderItem[];
};

type OrderWithItems = Order & { items: (OrderItem & { product: Product })[] };

/**
 * Same-flight guard for order creation, keyed by customer. Stores the
 * idempotency key beside the in-flight promise so a duplicate submission with
 * the *same* key waits for the first attempt and answers as its replay, while
 * a genuinely different submission (no/other key) still gets a 409.
 */
const pendingOrderCreations = new Map<
  number,
  { key: string | undefined; promise: Promise<CreatedOrder> }
>();

const orderInclude = {
  items: {
    include: { product: true },
    orderBy: { createdAt: "asc" },
  },
} as const;

function toPublicOrderItem(item: OrderItem & { product: Product }): PublicOrderItem {
  const subtotal = (parseFloat(item.unitPrice.toString()) * item.quantity).toFixed(2);
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    productImage: item.product.image,
    productCategory: item.product.category,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toFixed(2),
    subtotal,
  };
}

function toPublicOrder(order: OrderWithItems): PublicOrder {
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status,
    total: order.total ? order.total.toFixed(2) : null,
    createdAt: order.createdAt.toISOString(),
    address: {
      fullName: order.fullName,
      phone: order.phone,
      addressLine1: order.addressLine1,
      addressLine2: order.addressLine2,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
    },
    payment: {
      method: order.paymentMethod,
      status: order.paymentStatus,
      ref: order.paymentRef,
    },
    items: order.items.map(toPublicOrderItem),
  };
}

async function loadOrder(orderId: number): Promise<OrderWithItems> {
  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: orderInclude,
  });
}

export async function listOrders(customerId: number): Promise<PublicOrder[]> {
  const orders = await prisma.order.findMany({
    where: { customerId },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });

  return orders.map(toPublicOrder);
}

export async function listOrdersAdmin(params: {
  status?: string;
  paymentStatus?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ orders: PublicOrder[]; total: number; page: number; pageSize: number }> {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.paymentStatus) where.paymentStatus = params.paymentStatus;
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) (where.createdAt as Record<string, unknown>).gte = new Date(params.from);
    if (params.to) (where.createdAt as Record<string, unknown>).lte = new Date(params.to);
  }
  if (params.search) {
    const q = params.search;
    const numeric = Number(q);
    where.OR = [
      ...(Number.isFinite(numeric) ? [{ id: numeric }] : []),
      { customer: { fullName: { contains: q } } },
      { customer: { email: { contains: q } } },
      { customer: { phone: { contains: q } } },
    ];
  }
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true }, orderBy: { createdAt: "asc" } },
        customer: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);
  return {
    orders: orders.map((o) => toPublicOrder(o as Order & { items: (OrderItem & { product: Product })[] })),
    total,
    page,
    pageSize,
  };
}

export async function getOrderById(customerId: number, orderId: number): Promise<PublicOrder | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: {
      items: { include: { product: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) return null;
  return toPublicOrder(order as Order & { items: (OrderItem & { product: Product })[] });
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export async function updateOrderStatusAdmin(
  orderId: number,
  adminId: number,
  newStatus: string,
  note?: string
): Promise<PublicOrder> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found.");
  const allowed = VALID_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${order.status} to ${newStatus}.`);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });
    await tx.orderStatusHistory.create({
      data: { orderId, adminId, status: newStatus, note: note ?? null },
    });
    return o;
  });
  const full = await prisma.order.findUniqueOrThrow({
    where: { id: updated.id },
    include: { items: { include: { product: true }, orderBy: { createdAt: "asc" } } },
  });
  return toPublicOrder(full as Order & { items: (OrderItem & { product: Product })[] });
}

export type CreatedOrder = {
  order: PublicOrder;
  razorpay: { keyId: string; orderId: string; amountPaise: number } | null;
  /** true when a validated Idempotency-Key matched an already-created order. */
  replay: boolean;
};

/**
 * Shapes the Checkout.js payload for an order that already exists (replay or
 * resume). Returns null when there is nothing useful to hand back (paid
 * order, COD/UPI, or keys not configured).
 */
function razorpayPayloadForExisting(
  order: OrderWithItems
): { keyId: string; orderId: string; amountPaise: number } | null {
  if (order.paymentMethod !== "razorpay" || !order.razorpayOrderId) return null;
  if (order.paymentStatus === "paid") return null;

  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) return null;

  const amountPaise = toPaise(order.total ? parseFloat(order.total.toString()) : 0);
  if (amountPaise <= 0) return null;

  return { keyId, orderId: order.razorpayOrderId, amountPaise };
}

/**
 * Creates an order from the cart.
 *
 * Duplicate protections, two layers:
 * 1. Durable: an `Idempotency-Key` header (validated by the controller) is
 *    stored in `orders.idempotency_key` with a unique (customer, key) index.
 *    A retry from another tab, machine, or next-day replay of the same key
 *    re-uses the first order — the second create hits the unique index
 *    (P2002), re-reads, and answers as a replay.
 * 2. Process-local: with no key (older clients), an in-process per-customer
 *    lock still collapses same-instant double submits.
 */
export async function createOrderFromCart(
  customerId: number,
  input: CheckoutInput,
  idempotencyKey?: string
): Promise<CreatedOrder> {
  const key = idempotencyKey?.trim() || undefined;

  if (key) {
    const existing = await loadOrderWithKey(customerId, key);
    if (existing) {
      return { order: toPublicOrder(existing), razorpay: razorpayPayloadForExisting(existing), replay: true };
    }
  }

  if (pendingOrderCreations.has(customerId)) {
    const inFlight = pendingOrderCreations.get(customerId);
    if (inFlight && key && inFlight.key === key) {
      // Same submission in flight: wait for it, then serve the replay instead
      // of a conflict — the key guarantees one order for both callers.
      try {
        const created = await inFlight.promise;
        // Not a replay of *this* key's order? Only possible if the winner just
        // committed — re-read by key to be exact.
        const existing = await loadOrderWithKey(customerId, key);
        if (existing && existing.id === created.order.id) {
          return {
            order: toPublicOrder(existing),
            razorpay: razorpayPayloadForExisting(existing),
            replay: true,
          };
        }
        return created;
      } catch (error) {
        // The first attempt failed; surface the same failure to the coalesced
        // caller — it was the same submission.
        throw error;
      }
    }
    throw new ConflictError(
      "An order is already being placed for your account. Please wait a moment."
    );
  }

  const creation = placeOrder(customerId, input, key);
  pendingOrderCreations.set(customerId, { key, promise: creation });

  try {
    return await creation;
  } catch (error) {
    // Two same-key creates can commit into a unique violation — the loser
    // replays the winner's order instead of failing the customer.
    if (
      key &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await loadOrderWithKey(customerId, key);
      if (existing) {
        return { order: toPublicOrder(existing), razorpay: razorpayPayloadForExisting(existing), replay: true };
      }
    }
    throw error;
  } finally {
    pendingOrderCreations.delete(customerId);
  }
}

async function loadOrderWithKey(
  customerId: number,
  idempotencyKey: string
): Promise<OrderWithItems | null> {
  const order = await prisma.order.findFirst({
    where: { customerId, idempotencyKey },
    include: orderInclude,
  });
  return order;
}

async function placeOrder(
  customerId: number,
  input: CheckoutInput,
  idempotencyKey?: string
): Promise<CreatedOrder> {
  const cart = await prisma.cart.findUnique({
    where: { customerId },
    include: { items: { include: { product: true } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, "Your cart is empty.");
  }

  for (const item of cart.items) {
    if (item.product.archivedAt) {
      throw new ApiError(
        400,
        `"${item.product.name}" is no longer available. Please remove it from your cart.`
      );
    }
    if (!item.product.available) {
      throw new ApiError(400, `"${item.product.name}" is out of stock.`);
    }
  }

  // Schema validation already enforces the 12-digit shape; keep the check here
  // so the service is safe when called directly.
  if (input.paymentMethod === "upi" && !/^\d{12}$/.test(input.paymentRef.trim())) {
    throw new ApiError(400, "Enter the 12-digit UPI transaction reference.");
  }

  // Resolve delivery address. A selected saved address overrides the entered
  // fields and is verified for ownership.
  let delivery = {
    fullName: input.fullName,
    phone: input.phone,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2 || null,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
  };
  if (input.addressId) {
    const saved = await prisma.address.findFirst({
      where: { id: input.addressId, customerId },
    });
    if (!saved) throw new ApiError(404, "Saved address not found.");
    delivery = {
      fullName: saved.fullName,
      phone: saved.phone,
      addressLine1: saved.addressLine1,
      addressLine2: saved.addressLine2,
      city: saved.city,
      state: saved.state,
      pincode: saved.pincode,
    };
  }
  const total = cart.items.reduce((sum, item) => {
    const price = item.product.price ? parseFloat(item.product.price.toString()) : 0;
    return sum + price * item.quantity;
  }, 0);

  // Payment setup happens before the order exists, so a provider outage leaves
  // the cart intact and creates no orphan order.
  const payment = await initPayment({
    method: input.paymentMethod,
    amountPaise: toPaise(total),
    receipt: `cart_cust${customerId}_${Date.now()}`,
  });

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        customerId,
        status: "pending",
        total,
        fullName: delivery.fullName,
        phone: delivery.phone,
        addressLine1: delivery.addressLine1,
        addressLine2: delivery.addressLine2,
        city: delivery.city,
        state: delivery.state,
        pincode: delivery.pincode,
        paymentMethod: input.paymentMethod,
        paymentStatus: payment.paymentStatus,
        paymentRef:
          input.paymentMethod === "upi" ? input.paymentRef.trim() : null,
        razorpayOrderId:
          payment.method === "razorpay" ? payment.razorpayOrderId : null,
        idempotencyKey: idempotencyKey ?? null,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.product.price ?? 0,
          })),
        },
      },
    });

    // Stock on order (docs/ordering-flow.md §4): COD/UPI orders have no
    // asynchronous payment step, so stock is consumed atomically at placement —
    // in the SAME transaction as the order row. A reused Razorpay order's stock
    // is consumed once the payment is captured (settleCapturedPaymentOnOrder).
    // Conditional updates make a concurrent checkout or admin adjustment
    // incapable of overselling: if stock dropped below the requested quantity,
    // the whole transaction rolls back and no order exists.
    if (payment.method !== "razorpay") {
      const claimed = await claimStockEvent(
        tx,
        placementDeductionEventId(created.id),
        `order #${created.id} placed (${input.paymentMethod}) → stock decremented`
      );
      if (claimed) {
        try {
          await deductStockWithinTx(
            tx,
            cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
            "order placement"
          );
        } catch (error) {
          if (error instanceof InsufficientStockError) {
            throw new ConflictError(
              `"${error.details.productName}" doesn't have enough stock left. Your order could not be placed.`
            );
          }
          throw error;
        }
      }
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return created;
  });

  const full = await loadOrder(order.id);

  if (input.saveAddress && !input.addressId) {
    const existingCount = await prisma.address.count({ where: { customerId } });
    await prisma.address.create({
      data: {
        customerId,
        fullName: delivery.fullName,
        phone: delivery.phone,
        addressLine1: delivery.addressLine1,
        addressLine2: delivery.addressLine2,
        city: delivery.city,
        state: delivery.state,
        pincode: delivery.pincode,
        landmark: null,
        label: null,
        isDefault: existingCount === 0,
      },
    });
  }
  return {
    order: toPublicOrder(full),
    razorpay:
      payment.method === "razorpay"
        ? {
            keyId: payment.keyId,
            orderId: payment.razorpayOrderId,
            amountPaise: payment.amountPaise,
          }
        : null,
    replay: false,
  };
}

/**
 * Confirms a Razorpay payment using trusted server-side data:
 * HMAC signature + payment lookup (order association, amount, currency, capture).
 * Idempotent: repeated callbacks for the same payment return the same order.
 */
export async function confirmRazorpayPayment(
  customerId: number,
  orderId: number,
  razorpayPaymentId: string,
  razorpaySignature: string
): Promise<PublicOrder> {
  const existing = await prisma.order.findFirst({
    where: { id: orderId, customerId },
  });
  if (!existing) throw new ApiError(404, "Order not found.");
  if (existing.paymentMethod !== "razorpay" || !existing.razorpayOrderId) {
    throw new ApiError(400, "This order doesn't use online payment.");
  }

  if (existing.paymentStatus === "paid") {
    if (existing.paymentRef === razorpayPaymentId) {
      return toPublicOrder(await loadOrder(existing.id));
    }
    throw new ConflictError("This order has already been paid.");
  }

  const expectedAmountPaise = toPaise(
    existing.total ? parseFloat(existing.total.toString()) : 0
  );
  if (expectedAmountPaise <= 0) {
    throw new ApiError(400, "This order has no payable amount.");
  }

  await verifyRazorpayPaymentForOrder({
    razorpayOrderId: existing.razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    expectedAmountPaise,
  });

  // Winner settlement, single transaction payment→paid + pending→confirmed +
  // one-shot stock deduction. Loses gracefully when the captured webhook (or
  // the sweeper) settled first.
  const outcome = await settleCapturedPaymentOnOrder({
    orderId: existing.id,
    paymentRef: razorpayPaymentId,
    previousStatus: existing.status,
    historyNote: `payment verified by checkout confirmation (${razorpayPaymentId})`,
  });

  const full = await loadOrder(existing.id);

  if (!outcome.won) {
    if (full.paymentRef !== razorpayPaymentId) {
      throw new ConflictError("This order has already been paid.");
    }
  }

  return toPublicOrder(full);
}

export type ResumablePayment = {
  order: PublicOrder;
  razorpay: { keyId: string; orderId: string; amountPaise: number };
};

/**
 * Starts a fresh Razorpay payment attempt for an order that is still unpaid
 * (popup closed, network drop, failed attempt). Creates a new Razorpay order for
 * the authoritative server-side total and stores its id.
 */
export async function resumeRazorpayPayment(
  customerId: number,
  orderId: number
): Promise<ResumablePayment> {
  const existing = await prisma.order.findFirst({
    where: { id: orderId, customerId },
  });
  if (!existing) throw new ApiError(404, "Order not found.");
  if (existing.paymentMethod !== "razorpay") {
    throw new ApiError(400, "This order doesn't use online payment.");
  }
  if (existing.paymentStatus === "paid") {
    throw new ConflictError("This order has already been paid.");
  }
  if (existing.status === "cancelled") {
    throw new ApiError(400, "This order was cancelled and can't be paid.");
  }

  const amountPaise = toPaise(
    existing.total ? parseFloat(existing.total.toString()) : 0
  );
  if (amountPaise <= 0) {
    throw new ApiError(400, "This order has no payable amount.");
  }

  const rp = await createRazorpayOrder({
    amountPaise,
    receipt: `retry_order${existing.id}_${Date.now()}`,
  });

  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: {
      razorpayOrderId: rp.razorpayOrderId,
      paymentStatus: "pending",
    },
    include: orderInclude,
  });

  return {
    order: toPublicOrder(updated),
    razorpay: {
      keyId: rp.keyId,
      orderId: rp.razorpayOrderId,
      amountPaise: rp.amountPaise,
    },
  };
}
