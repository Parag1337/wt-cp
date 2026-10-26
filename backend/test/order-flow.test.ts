import "dotenv/config";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

type ApiResult = { status: number; data: unknown; cookie: string | null };

type OrderBody = {
  success?: boolean;
  message?: string;
  order?: {
    id: number;
    status: string;
    total: string | null;
    payment: { method: string; status: string; ref: string | null };
  };
  razorpay?: unknown;
};

type CartBody = {
  cart?: {
    items: { id: number; productId: number; quantity: number }[];
    totalItems: number;
    subtotal: string | null;
  };
};

type ProductBody = { products?: { id: number; price: string | null; available: boolean }[] };

const suffix = String(Date.now()).slice(-9);
const emails = [`agent3a_${suffix}@example.com`, `agent3b_${suffix}@example.com`];
const phones = [`9${suffix}`, `8${suffix}`];
const productName = `Agent3 Test Product ${suffix}`;

let server: ReturnType<typeof app.listen> | null = null;
let baseUrl = "";
let cookie = "";
let otherCookie = "";
let product1StockBefore = 0;
let codOrderId = 0;
let testProductId = 0;

function firstCookie(setCookie: string | null): string {
  if (!setCookie) throw new Error("missing set-cookie header");
  return setCookie.split(";")[0];
}

async function api(
  path: string,
  options: { method?: string; cookie?: string; body?: unknown } = {}
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.cookie) headers.Cookie = options.cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  return {
    status: response.status,
    data: await response.json().catch(() => null),
    cookie: response.headers.get("set-cookie"),
  };
}

const validAddress = {
  fullName: "Agent Three Test",
  phone: phones[0],
  addressLine1: "12 Test Street",
  city: "Khamgaon",
  state: "Maharashtra",
  pincode: "444303",
};

async function addProduct(productId = 1, quantity = 1): Promise<ApiResult> {
  return api("/api/cart/items", {
    method: "POST",
    cookie,
    body: { productId, quantity },
  });
}

before(async () => {
  const httpServer = app.listen(0);
  server = httpServer;
  await new Promise<void>((resolve) => httpServer.once("listening", () => resolve()));
  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Checkout consumes stock per "Stock on order" — remember the pre-test value
  // so teardown restores exactly what this file consumed on product 1.
  const product1 = await prisma.product.findUniqueOrThrow({
    where: { id: 1 },
    select: { stockQuantity: true },
  });
  product1StockBefore = product1.stockQuantity;

  const first = await api("/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Agent Three A",
      email: emails[0],
      phone: phones[0],
      password: "testpass123",
    },
  });
  assert.equal(first.status, 201, JSON.stringify(first.data));
  cookie = firstCookie(first.cookie);

  const second = await api("/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Agent Three B",
      email: emails[1],
      phone: phones[1],
      password: "testpass123",
    },
  });
  assert.equal(second.status, 201, JSON.stringify(second.data));
  otherCookie = firstCookie(second.cookie);
});

after(async () => {
  if (testProductId) {
    await prisma.product.deleteMany({ where: { id: testProductId } });
  }
  await prisma.customer.deleteMany({ where: { email: { in: emails } } });
  // Stock on order: give back whatever this file's COD/UPI placements consumed.
  if (product1StockBefore > 0) {
    await prisma.product.update({ where: { id: 1 }, data: { stockQuantity: product1StockBefore } });
  }
  const httpServer = server;
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
  await prisma.$disconnect();
});

test("unauthenticated customers get 401 for cart and order data", async () => {
  assert.equal((await api("/api/cart")).status, 401);
  assert.equal((await api("/api/orders")).status, 401);
  assert.equal((await api("/api/orders/1")).status, 401);
});

test("empty cart checkout is rejected and keeps the customer signed in", async () => {
  const result = await api("/api/orders", {
    method: "POST",
    cookie,
    body: { ...validAddress, paymentMethod: "cod" },
  });

  assert.equal(result.status, 400);
  assert.match((result.data as OrderBody).message ?? "", /cart is empty/i);
});

test("cart quantities are validated and totals are computed server-side", async () => {
  const catalog = await api("/api/products");
  const product = (catalog.data as ProductBody).products?.find((p) => p.id === 1);
  assert.ok(product, "seed product 1 should exist");
  const unitPrice = parseFloat(product.price ?? "0");
  assert.ok(unitPrice > 0);

  for (const quantity of [0, 100, -1]) {
    const invalid = await addProduct(1, quantity);
    assert.equal(invalid.status, 400, `quantity ${quantity} should be rejected`);
  }

  const added = await addProduct(1, 2);
  assert.equal(added.status, 201);
  const cart = (added.data as CartBody).cart;
  assert.ok(cart);
  assert.equal(cart.totalItems, 2);
  assert.equal(cart.subtotal, (unitPrice * 2).toFixed(2));

  const itemId = cart.items[0].id;
  const updated = await api(`/api/cart/items/${itemId}`, {
    method: "PUT",
    cookie,
    body: { quantity: 3 },
  });
  assert.equal(updated.status, 200);
  assert.equal((updated.data as CartBody).cart?.subtotal, (unitPrice * 3).toFixed(2));

  const removed = await api(`/api/cart/items/${itemId}`, { method: "DELETE", cookie });
  assert.equal(removed.status, 200);
  assert.equal((removed.data as CartBody).cart?.totalItems, 0);
});

test("a COD order uses server prices, stays unpaid and clears the cart", async () => {
  const catalog = await api("/api/products");
  const product = (catalog.data as ProductBody).products?.find((p) => p.id === 1);
  assert.ok(product?.price);
  const expectedTotal = (parseFloat(product.price) * 2).toFixed(2);

  assert.equal((await addProduct(1, 2)).status, 201);

  const result = await api("/api/orders", {
    method: "POST",
    cookie,
    body: { ...validAddress, paymentMethod: "cod" },
  });

  assert.equal(result.status, 201, JSON.stringify(result.data));
  const order = (result.data as OrderBody).order;
  assert.ok(order);
  assert.equal(order.total, expectedTotal);
  assert.equal(order.status, "pending");
  assert.equal(order.payment.method, "cod");
  assert.equal(order.payment.status, "cod_due");
  assert.equal((result.data as OrderBody).razorpay, null);
  codOrderId = order.id;

  const cart = await api("/api/cart", { cookie });
  assert.equal((cart.data as CartBody).cart?.totalItems, 0);

  const detail = await api(`/api/orders/${codOrderId}`, { cookie });
  assert.equal(detail.status, 200);
  assert.equal((detail.data as OrderBody).order?.id, codOrderId);
});

test("orders are scoped to their owner", async () => {
  const forbidden = await api(`/api/orders/${codOrderId}`, { cookie: otherCookie });
  assert.equal(forbidden.status, 404, "another customer must not see this order");

  const list = await api("/api/orders", { cookie: otherCookie });
  assert.equal(list.status, 200);
  assert.equal(
    (list.data as { orders: unknown[] }).orders.length,
    0,
    "other customer's order list must be empty"
  );
});

test("UPI references must be 12 digits and keep the order payment-pending", async () => {
  assert.equal((await addProduct(1, 1)).status, 201);

  const bad = await api("/api/orders", {
    method: "POST",
    cookie,
    body: { ...validAddress, paymentMethod: "upi", paymentRef: "12345678901" },
  });
  assert.equal(bad.status, 400);
  assert.match((bad.data as OrderBody).message ?? "", /12-digit UPI/i);

  const cartAfterFailure = await api("/api/cart", { cookie });
  assert.equal(
    (cartAfterFailure.data as CartBody).cart?.totalItems,
    1,
    "a rejected checkout must not clear the cart"
  );

  const good = await api("/api/orders", {
    method: "POST",
    cookie,
    body: { ...validAddress, paymentMethod: "upi", paymentRef: "412345678901" },
  });
  assert.equal(good.status, 201, JSON.stringify(good.data));
  const order = (good.data as OrderBody).order;
  assert.ok(order);
  assert.equal(order.payment.method, "upi");
  assert.equal(order.payment.status, "pending");
  assert.equal(order.payment.ref, "412345678901");
});

test("unavailable products cannot be ordered", async () => {
  const product = await prisma.product.create({
    data: {
      name: productName,
      category: "Agricultural Products",
      description: "Temporary test product used to verify stock handling.",
      price: 100,
      available: true,
      stockQuantity: 5,
    },
  });
  testProductId = product.id;

  // enter the cart while the product is still purchasable…
  const added = await addProduct(product.id, 1);
  assert.equal(added.status, 201, JSON.stringify(added.data));

  // …then the admin flag flips.
  await prisma.product.update({ where: { id: product.id }, data: { available: false } });

  // The cart boundary must reject further adds:
  const addedUnavailable = await addProduct(product.id, 1);
  assert.equal(addedUnavailable.status, 409);
  assert.match((addedUnavailable.data as OrderBody).message ?? "", /not currently available/i);

  // …and checkout REMAINS the authoritative blocker even for items that
  // were already sitting in the cart when availability changed.
  const result = await api("/api/orders", {
    method: "POST",
    cookie,
    body: { ...validAddress, paymentMethod: "cod" },
  });

  assert.equal(result.status, 400);
  assert.match((result.data as OrderBody).message ?? "", /out of stock/i);

  await api("/api/cart", { method: "DELETE", cookie });
  await prisma.product.delete({ where: { id: product.id } });
  testProductId = 0;
});

test("archived products cannot be ordered at checkout", async () => {
  const product = await prisma.product.create({
    data: {
      name: `${productName} archived`,
      category: "Agricultural Products",
      description: "Temporary archived product.",
      price: 100,
      available: true,
      stockQuantity: 5,
    },
  });
  testProductId = product.id;

  // Adding to the cart works while the product is live…
  assert.equal((await addProduct(product.id, 1)).status, 201);

  // …but once archived, the cart boundary refuses further adds…
  await prisma.product.update({ where: { id: product.id }, data: { archivedAt: new Date() } });
  const addedArchived = await addProduct(product.id, 1);
  assert.equal(addedArchived.status, 409);
  assert.match((addedArchived.data as OrderBody).message ?? "", /not currently available/i);

  // …and checkout still blocks items archived after they entered the cart.
  const result = await api("/api/orders", {
    method: "POST",
    cookie,
    body: { ...validAddress, paymentMethod: "cod" },
  });
  assert.equal(result.status, 400);
  assert.match((result.data as OrderBody).message ?? "", /no longer available/i);

  await api("/api/cart", { method: "DELETE", cookie });
  await prisma.product.delete({ where: { id: product.id } });
  testProductId = 0;
});

test("duplicate submissions never create two orders", async () => {
  assert.equal((await addProduct(1, 1)).status, 201);

  const before = await prisma.order.count({
    where: { customer: { email: emails[0] } },
  });

  const payload = { ...validAddress, paymentMethod: "cod" as const };
  const [first, second] = await Promise.all([
    api("/api/orders", { method: "POST", cookie, body: payload }),
    api("/api/orders", { method: "POST", cookie, body: payload }),
  ]);

  const created = [first, second].filter((result) => result.status === 201);
  const rejected = [first, second].filter((result) => result.status !== 201);

  assert.equal(created.length, 1, "exactly one request may create the order");
  assert.equal(rejected.length, 1);
  assert.ok(
    [400, 409].includes(rejected[0].status),
    `unexpected rejection status ${rejected[0].status}`
  );

  const after = await prisma.order.count({
    where: { customer: { email: emails[0] } },
  });
  assert.equal(after, before + 1);
});

test("verification rejects non-online orders and forged signatures", async () => {
  const codVerify = await api(`/api/orders/${codOrderId}/verify-payment`, {
    method: "POST",
    cookie,
    body: { razorpayPaymentId: "pay_fake", razorpaySignature: "sig_fake" },
  });
  assert.equal(codVerify.status, 400);
  assert.match((codVerify.data as OrderBody).message ?? "", /doesn't use online payment/i);

  const customer = await prisma.customer.findUniqueOrThrow({
    where: { email: emails[0] },
  });

  const forged = await prisma.order.create({
    data: {
      customerId: customer.id,
      status: "pending",
      total: 500,
      ...validAddress,
      paymentMethod: "razorpay",
      paymentStatus: "pending",
      razorpayOrderId: `order_forged_${suffix}`,
    },
  });

  const forgedResult = await api(`/api/orders/${forged.id}/verify-payment`, {
    method: "POST",
    cookie,
    body: { razorpayPaymentId: "pay_forged", razorpaySignature: "0".repeat(64) },
  });
  assert.equal(forgedResult.status, 422, JSON.stringify(forgedResult.data));

  const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: forged.id } });
  assert.equal(unchanged.paymentStatus, "pending");
  assert.equal(unchanged.status, "pending");

  const missing = await api(`/api/orders/${forged.id}/verify-payment`, {
    method: "POST",
    cookie,
    body: {},
  });
  assert.equal(missing.status, 400);

  const codRetry = await api(`/api/orders/${codOrderId}/retry-payment`, {
    method: "POST",
    cookie,
  });
  assert.equal(codRetry.status, 400);
});

test("repeated verification callbacks are idempotent for a paid order", async () => {
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { email: emails[0] },
  });

  const paid = await prisma.order.create({
    data: {
      customerId: customer.id,
      status: "confirmed",
      total: 500,
      ...validAddress,
      paymentMethod: "razorpay",
      paymentStatus: "paid",
      paymentRef: `pay_paid_${suffix}`,
      razorpayOrderId: `order_paid_${suffix}`,
    },
  });

  const same = await api(`/api/orders/${paid.id}/verify-payment`, {
    method: "POST",
    cookie,
    body: {
      razorpayPaymentId: `pay_paid_${suffix}`,
      razorpaySignature: "already-verified",
    },
  });
  assert.equal(same.status, 200, JSON.stringify(same.data));
  assert.equal((same.data as OrderBody).order?.payment.status, "paid");

  const conflicting = await api(`/api/orders/${paid.id}/verify-payment`, {
    method: "POST",
    cookie,
    body: { razorpayPaymentId: "pay_other", razorpaySignature: "sig" },
  });
  assert.equal(conflicting.status, 409);
});
