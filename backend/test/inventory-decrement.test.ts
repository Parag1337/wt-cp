import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/config/prisma.js";
import { createOrderFromCart } from "../src/services/order.service.js";
import { applyCapturedRazorpayPayment } from "../src/services/webhook.service.js";
import { updateAdminOrderStatus } from "../src/services/admin-order.service.js";
import { claimStockEvent } from "../src/services/stock-ledger.service.js";
import { STOCK_LEDGER_PROVIDER } from "../src/services/stock-ledger.service.js";
import type { CheckoutInput } from "../src/schemas/order.schema.js";

/**
 * Stock lifecycle on the order path ("Stock on order", docs/ordering-flow.md §4):
 *
 *  - COD/UPI: stock is decremented atomically INSIDE the order-placement
 *    transaction; insufficient stock rolls the whole placement back (no order,
 *    no cart clear, no ledger claim).
 *  - Razorpay: stock is decremented exactly once at payment capture. Redelivery
 *    / double-apply / a different payment id can't move stock again.
 *  - A payment failure (non-captured event) leaves stock untouched.
 *  - Admin cancellation restores stock for orders that consumed it, once.
 *
 * Fixtures are throwaway rows (own product + own customer); everything is
 * deleted at teardown.
 */

const suffix = String(Date.now()).slice(-9);
const productName = `Stock Decrement ${suffix}`;

let productId = 0;
let adminId = 0;
let customerAId = 0;
let orderIdsToClean: number[] = [];
const createdLedgerFromCapture: string[] = [];

const codAddress: CheckoutInput = {
  fullName: "Stock Plan",
  phone: "9191801226",
  addressLine1: "9 Ledger Road",
  addressLine2: "",
  city: "Khamgaon",
  state: "Maharashtra",
  pincode: "444303",
  paymentMethod: "cod",
  paymentRef: "",
};

async function makeCartWithItem(customerId: number, quantity: number) {
  const cart = await prisma.cart.create({ data: { customerId } });
  await prisma.cartItem.create({
    data: { cartId: cart.id, productId, quantity },
  });
}

async function stockOf(): Promise<number> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { stockQuantity: true },
  });
  return product.stockQuantity;
}

type AdminStatusInput = Parameters<typeof updateAdminOrderStatus>[2];

function statusInput(status: "cancelled" | "confirmed"): AdminStatusInput {
  return { status } as AdminStatusInput;
}

async function makeRazorpayOrder(input: {
  customerId: number;
  total: number;
  quantity: number;
  seed: string;
  paymentStatus?: string;
  status?: string;
}): Promise<{ id: number; razorpayOrderId: string }> {
  const order = await prisma.order.create({
    data: {
      customerId: input.customerId,
      status: input.status ?? "pending",
      total: input.total,
      fullName: codAddress.fullName,
      phone: codAddress.phone,
      addressLine1: codAddress.addressLine1,
      city: codAddress.city,
      state: codAddress.state,
      pincode: codAddress.pincode,
      paymentMethod: "razorpay",
      paymentStatus: input.paymentStatus ?? "pending",
      razorpayOrderId: `order_stockdec_${suffix}_${input.seed}`,
      items: { create: [{ productId, quantity: input.quantity, unitPrice: 10 }] },
    },
  });
  orderIdsToClean.push(order.id);
  createdLedgerFromCapture.push(`order_stockdec_${suffix}_${input.seed}`);
  return { id: order.id, razorpayOrderId: `order_stockdec_${suffix}_${input.seed}` };
}

async function admin() {
  const admin = await prisma.customer.findFirst({
    where: { role: "ADMIN" },
    orderBy: { id: "asc" },
  });
  if (!admin) throw new Error("no admin account in the development database for admin_id");
  adminId = admin.id;
}

after(async () => {
  // This file created ~10 orders, carts, ledger rows and one product; the FK
  // cascade lives on Customer→Order, so rows are removed child-first:
  // ledger rows (no FK), then customers (cascades orders + order items),
  // then the product (now unreferenced).
  const ledgerEventIds = orderIdsToClean.flatMap((orderId) => [
    `deduct:order:${orderId}`,
    `restore:order:${orderId}`,
  ]);
  await prisma.webhookEvent.deleteMany({
    where: {
      provider: STOCK_LEDGER_PROVIDER,
      OR: [
        { eventId: { in: ledgerEventIds } },
        { eventId: { startsWith: `deduct:pay:pay_stockdec_${suffix}` } },
        { eventId: { startsWith: `deduct:order:claim_probe_${suffix}` } },
      ],
    },
  });
  await prisma.order.deleteMany({ where: { customer: { email: { contains: `stockdec_${suffix}` } } } });
  await prisma.customer.deleteMany({ where: { email: { contains: `stockdec_${suffix}` } } });
  if (productId) {
    await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});

test("COD placement decrements stock atomically", async () => {
  await setup();
  const stockBefore = await stockOf();
  assert.equal(stockBefore, 10);

  const { order } = await createOrderFromCart(customerAId, { ...codAddress }, `stockdec_A_${suffix}`);
  orderIdsToClean.push(order.id);

  assert.equal(order.status, "pending");
  assert.equal(order.payment.method, "cod");
  assert.equal(await stockOf(), 8, "2 units consume stock at placement");

  const ledger = await prisma.webhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider: STOCK_LEDGER_PROVIDER,
        eventId: `deduct:order:${order.id}`,
      },
    },
  });
  assert.ok(ledger, "one-shot placement ledger row exists");
  assert.match(ledger?.note ?? "", new RegExp(String(order.id)));
});

test("replaying the same idempotency key does not double-decrement", async () => {
  const { order: replayed, replay } = await createOrderFromCart(
    customerAId,
    { ...codAddress },
    `stockdec_A_${suffix}`
  );
  assert.equal(replay, true);
  assert.ok(replayed.id > 0, "same order returned");
  assert.equal(await stockOf(), 8, "stock unchanged on replay");
});

test("insufficient stock rolls back the whole placement", async () => {
  const customerB = await prisma.customer.create({
    data: {
      fullName: "Stock B",
      email: `stockdec_b_${suffix}@example.com`,
      phone: `9${suffix.slice(0, 5)}77`,
      passwordHash: "irrelevant",
    },
  });
  await makeCartWithItem(customerB.id, 20); // only 8 left

  await assert.rejects(
    () => createOrderFromCart(customerB.id, { ...codAddress }, `stockdec_B_${suffix}`),
    /enough stock/i
  );
  assert.equal(await stockOf(), 8, "stock unchanged after rejected placement");
  const orders = await prisma.order.count({ where: { customerId: customerB.id } });
  assert.equal(orders, 0, "no order row survives a rolled-back placement");
});

test("a captured razorpay payment deducts stock exactly once", async () => {
  const rp = await makeRazorpayOrder({ customerId: customerAId, total: 10, quantity: 1, seed: "a" });
  const outcome = await applyCapturedRazorpayPayment(rp.razorpayOrderId, {
    id: `pay_stockdec_${suffix}_1`,
    amountPaise: 1000,
    currency: "INR",
    captured: true,
  });
  assert.equal(outcome.eventStatus, "processed", outcome.note);
  assert.equal(await stockOf(), 7);

  const dupe = await applyCapturedRazorpayPayment(rp.razorpayOrderId, {
    id: `pay_stockdec_${suffix}_1`,
    amountPaise: 1000,
    currency: "INR",
    captured: true,
  });
  assert.equal(dupe.eventStatus, "processed", "redelivery is acknowledged as a replay");
  assert.match(dupe.note, /already reconciled/);
  assert.equal(await stockOf(), 7, "no double deduction on redelivery");

  // A different payment id claiming the same razorpay order can't move stock.
  const other = await applyCapturedRazorpayPayment(rp.razorpayOrderId, {
    id: `pay_stockdec_${suffix}_2`,
    amountPaise: 1000,
    currency: "INR",
    captured: true,
  });
  assert.equal(other.eventStatus, "ignored");
  assert.equal(await stockOf(), 7);
});

test("a captured payment without stock still honours the money state with an alert", async () => {
  const rp = await makeRazorpayOrder({ customerId: customerAId, total: 2000, quantity: 900, seed: "b" });
  const outcome = await applyCapturedRazorpayPayment(rp.razorpayOrderId, {
    id: `pay_stockdec_${suffix}_3`,
    amountPaise: 200000,
    currency: "INR",
    captured: true,
  });
  assert.equal(outcome.eventStatus, "processed", outcome.note);
  assert.match(outcome.note, /stock insufficient/);

  const order = await prisma.order.findUnique({
    where: { id: rp.id },
    select: { status: true, paymentStatus: true, paymentRef: true },
  });
  assert.equal(order?.paymentStatus, "paid", "money must be honoured");
  assert.equal(order?.status, "confirmed");
  assert.equal(order?.paymentRef, `pay_stockdec_${suffix}_3`);
  assert.equal(await stockOf(), 7, "stock not decremented below zero");

  const history = await prisma.orderStatusHistory.findMany({ where: { orderId: rp.id } });
  assert.ok(
    history.some((row) => /stock insufficient/.test(row.note ?? "")),
    "manual-reconciliation alert recorded"
  );
});

test("a non-captured payment event never touches stock", async () => {
  const rp = await makeRazorpayOrder({ customerId: customerAId, total: 10, quantity: 1, seed: "c" });
  const outcome = await applyCapturedRazorpayPayment(rp.razorpayOrderId, {
    id: `pay_stockdec_${suffix}_4`,
    amountPaise: 1000,
    currency: "INR",
    captured: false,
    status: "created",
  });
  assert.equal(outcome.eventStatus, "ignored");
  const order = await prisma.order.findUnique({ where: { id: rp.id }, select: { paymentStatus: true } });
  assert.equal(order?.paymentStatus, "pending");
  assert.equal(await stockOf(), 7);
});

test("cancelling a COD order restores its stock exactly once", async () => {
  const codOrder = await prisma.order.findFirst({
    where: { customerId: customerAId, paymentMethod: "cod", idempotencyKey: `stockdec_A_${suffix}` },
    select: { id: true },
  });
  assert.ok(codOrder, "the COD order from the first test must exist");

  await updateAdminOrderStatus(codOrder.id, adminId, statusInput("cancelled"));
  assert.equal(await stockOf(), 9, "7 → 9: the 2 placed units returned on cancellation");

  const restore = await prisma.webhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider: STOCK_LEDGER_PROVIDER,
        eventId: `restore:order:${codOrder.id}`,
      },
    },
  });
  assert.ok(restore, "one-shot restore ledger row exists");
});

test("cancelling an unpaid razorpay order does not restore stock", async () => {
  const stockBefore = await stockOf(); // 9 after the COD restore
  const rp = await makeRazorpayOrder({ customerId: customerAId, total: 30, quantity: 3, seed: "d" });
  await updateAdminOrderStatus(rp.id, adminId, statusInput("cancelled"));
  assert.equal(await stockOf(), stockBefore, "no stock returned for an order that never consumed stock");
  const restore = await prisma.webhookEvent.findFirst({
    where: { provider: STOCK_LEDGER_PROVIDER, eventId: `restore:order:${rp.id}` },
  });
  assert.equal(restore, null, "no restore ledger row for a never-deducted order");
});

test("ledger claims are one-shot", async () => {
  const eventId = `deduct:order:claim_probe_${suffix}`;
  const first = await prisma.$transaction((tx) =>
    claimStockEvent(tx, eventId, `claim probe for ${productName}`)
  );
  assert.equal(first, true);

  const again = await prisma.$transaction((tx) =>
    claimStockEvent(tx, eventId, `claim probe for ${productName}`)
  );
  assert.equal(again, false, "second claim of the same event id loses");

  const probed = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: STOCK_LEDGER_PROVIDER, eventId } },
  });
  assert.ok(probed, "claim row is visible after winning");
});

async function setup() {
  const product = await prisma.product.create({
    data: {
      name: productName,
      category: "Agricultural Products",
      description: "Temporary product for stock-decrement tests.",
      price: 10,
      available: true,
      stockQuantity: 10,
    },
  });
  productId = product.id;
  await admin();

  const customerA = await prisma.customer.create({
    data: {
      fullName: "Stock A",
      email: `stockdec_a_${suffix}@example.com`,
      phone: `9${suffix.slice(0, 5)}66`,
      passwordHash: "irrelevant",
    },
  });
  customerAId = customerA.id;
  await makeCartWithItem(customerA.id, 2);
}

// Setup runs lazily in the first test (node:test runs tests in file order top
// to bottom; the first test initialises shared fixtures).
