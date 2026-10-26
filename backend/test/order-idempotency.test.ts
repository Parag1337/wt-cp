import "dotenv/config";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

/**
 * Durable idempotency of order submission (orders.idempotency_key + the
 * Idempotency-Key header). Provider-independent: razorpay-style orders are
 * inserted directly; checkout creation only uses COD, which never leaves
 * the network.
 */

const suffix = String(Date.now()).slice(-9);
const emailA = `idem_a_${suffix}@example.com`;
const emailB = `idem_b_${suffix}@example.com`;
const emailC = `idem_c_${suffix}@example.com`;

let baseUrl = "";
let cookieA = "";
let cookieB = "";
let cookieC = "";
let server: ReturnType<typeof app.listen> | null = null;
let customerAId = 0;
let customerCId = 0;
let product1StockBefore = 0;

const validAddress = {
  fullName: "Idempotency Test",
  phone: `7${suffix}`,
  addressLine1: "12 Test Street",
  addressLine2: "",
  city: "Khamgaon",
  state: "Maharashtra",
  pincode: "444303",
};

async function api(
  path: string,
  options: { method?: string; cookie?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<{ status: number; data: any; setCookie: string | null }> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
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
    setCookie: response.headers.get("set-cookie"),
  };
}

async function placeOrder(
  cookie: string,
  paymentMethod: "cod" | "upi",
  idempotencyKey?: string,
  paymentRef?: string
): Promise<{ status: number; data: any }> {
  const body: Record<string, unknown> = { ...validAddress, paymentMethod };
  if (paymentRef) body.paymentRef = paymentRef;
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  return api("/api/orders", { method: "POST", cookie, body, headers });
}

async function addProductToCart(cookie: string, productId: number, quantity: number) {
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

  for (const [cookieRef, email] of [
    ["cookieA", emailA],
    ["cookieB", emailB],
    ["cookieC", emailC],
  ] as const) {
    const register = await api("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Idempotency Test",
        email,
        phone: /cookieA/.test(cookieRef) ? `7${suffix}` : /cookieB/.test(cookieRef) ? `8${suffix}` : `9${suffix}`,
        password: "testpass123",
      },
    });
    assert.equal(register.status, 201, JSON.stringify(register.data));
    const setCookie = register.setCookie;
    if (cookieRef === "cookieA") {
      cookieA = setCookie ? setCookie.split(";")[0] : "";
      customerAId = (await prisma.customer.findUniqueOrThrow({ where: { email } })).id;
    } else if (cookieRef === "cookieB") {
      cookieB = setCookie ? setCookie.split(";")[0] : "";
    } else {
      cookieC = setCookie ? setCookie.split(";")[0] : "";
      customerCId = (await prisma.customer.findUniqueOrThrow({ where: { email } })).id;
    }
  }
});

after(async () => {
  await prisma.order.deleteMany({
    where: { customerId: { in: [customerAId, customerCId] } },
  });
  await prisma.customer.deleteMany({
    where: { email: { in: [emailA, emailB, emailC] } },
  });
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

const KEY = `idem-key-0123456789-${suffix}`;

test("a malformed Idempotency-Key header is rejected with 400", async () => {
  assert.equal((await addProductToCart(cookieA, 1, 1)).status, 201);
  const bad = await placeOrder(cookieA, "cod", "short");
  assert.equal(bad.status, 400);
  assert.match(bad.data.message ?? "", /idempotency key/i);

  const badChars = await placeOrder(cookieA, "cod", `${KEY} $\n`);
  assert.equal(badChars.status, 400);

  // The cart was untouched: a rejected header must not consume the checkout.
  const cart = await api("/api/cart", { cookie: cookieA });
  assert.equal(cart.data.cart?.totalItems, 1);
});

test("a retry with the same idempotency key re-uses the original order (200 replay)", async () => {
  const first = await placeOrder(cookieA, "cod", KEY);
  assert.equal(first.status, 201, JSON.stringify(first.data));
  const orderId = first.data.order.id;
  assert.equal(first.data.replay, false);

  const retry = await placeOrder(cookieA, "cod", KEY);
  assert.equal(retry.status, 200);
  assert.equal(retry.data.replay, true);
  assert.equal(retry.data.order.id, orderId, "the same order, not a new one");

  const count = await prisma.order.count({ where: { customerId: customerAId } });
  assert.equal(count, 1, "exactly one order row exists for the customer");

  await prisma.order.deleteMany({ where: { customerId: customerAId } });
});

test("a razorpay replay returns a usable checkout payload for the stored provider order", async () => {
  const stored = await prisma.order.create({
    data: {
      customerId: customerAId,
      status: "pending",
      total: 550,
      ...validAddress,
      paymentMethod: "razorpay",
      paymentStatus: "pending",
      razorpayOrderId: `order_idem_${suffix}`,
      idempotencyKey: KEY,
      items: {
        create: [{ productId: 1, quantity: 1, unitPrice: 550 }],
      },
    },
  });

  const replay = await placeOrder(cookieA, "cod", KEY);
  assert.equal(replay.status, 200, JSON.stringify(replay.data));
  assert.equal(replay.data.replay, true);
  assert.equal(replay.data.order.id, stored.id);
  assert.ok(replay.data.razorpay);
  assert.equal(replay.data.razorpay.orderId, `order_idem_${suffix}`);
  assert.equal(replay.data.razorpay.amountPaise, 55000);

  // Paid orders replay without a checkout payload: nothing left to pay.
  await prisma.order.update({
    where: { id: stored.id },
    data: { paymentStatus: "paid", paymentRef: "pay_x" },
  });
  const paidReplay = await placeOrder(cookieA, "cod", KEY);
  assert.equal(paidReplay.status, 200);
  assert.equal(paidReplay.data.razorpay, null);
});

test("two concurrent submissions with the same key create exactly one order", async () => {
  assert.equal((await addProductToCart(cookieA, 1, 2)).status, 201);

  const [first, second] = await Promise.all([
    placeOrder(cookieA, "cod", `concurrent-key-0123456-${suffix}`),
    placeOrder(cookieA, "cod", `concurrent-key-0123456-${suffix}`),
  ]);

  const statuses = [first, second].map((r) => r.status).sort();
  assert.deepEqual(
    statuses,
    [200, 201],
    "one creation (201) and one replay (200), no 409 and no second order"
  );
  const ids = new Set([first.data.order.id, second.data.order.id]);
  assert.equal(ids.size, 1, "both responses carry the same order");

  const count = await prisma.order.count({
    where: { customerId: customerAId, idempotencyKey: `concurrent-key-0123456-${suffix}` },
  });
  assert.equal(count, 1);
});

test("two different submissions without a key still conflict (process-local guard)", async () => {
  await prisma.order.deleteMany({ where: { customerId: customerAId } });
  assert.equal((await addProductToCart(cookieA, 1, 1)).status, 201);

  const payload = { ...validAddress, paymentMethod: "cod" as const };
  const [first, second] = await Promise.all([
    api("/api/orders", { method: "POST", cookie: cookieA, body: payload }),
    api("/api/orders", { method: "POST", cookie: cookieA, body: payload }),
  ]);
  const created = [first, second].filter((r) => r.status === 201);
  const rejected = [first, second].filter((r) => r.status !== 201);
  assert.equal(created.length, 1);
  assert.equal(rejected.length, 1, "no-key duplicates keep the 400/409 behaviour");
});

test("the same idempotency key from different customers creates independent orders", async () => {
  await addProductToCart(cookieA, 1, 1);
  await addProductToCart(cookieC, 1, 1);

  const key = `shared-key-0123456789-${suffix}`;
  const a = await placeOrder(cookieA, "cod", key);
  const c = await placeOrder(cookieC, "cod", key);
  assert.equal(a.status, 201, JSON.stringify(a.data));
  assert.equal(c.status, 201, JSON.stringify(c.data));
  assert.notEqual(a.data.order.id, c.data.order.id,
    "the key is scoped per customer: no cross-customer interference");
});
