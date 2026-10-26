import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

let server: Awaited<ReturnType<typeof app.listen>> | null = null;
let baseUrl = "";
let adminCookie = "";
let customerCookie = "";
let customerId = 0;
let stockedProductId = 0;
let emptyProductId = 0;
let unavailableProductId = 0;
const createdOrderIds: number[] = [];
const suffix = Date.now();

type Result = { status: number; data: unknown; setCookie: string | null };

async function api(
  path: string,
  options: { method?: string; cookie?: string; body?: unknown } = {}
): Promise<Result> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.cookie) headers["Cookie"] = options.cookie;
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = (await res.json().catch(() => null)) as unknown;
  return { status: res.status, data, setCookie: res.headers.get("set-cookie") };
}

function messageOf(result: Result): string {
  const data = result.data as { message?: string } | null;
  return data?.message ?? "";
}

test.before(async () => {
  const httpServer = app.listen(0);
  server = httpServer;
  await new Promise<void>((resolve) => httpServer.once("listening", () => resolve()));
  const address = httpServer.address() as { port: number };
  baseUrl = `http://127.0.0.1:${address.port}`;

  const password = "cartpass123";
  const bcrypt = (await import("bcrypt")).default ?? (await import("bcrypt"));
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.customer.create({
    data: {
      fullName: "Cart Guard Admin",
      email: `cartguard-admin-${suffix}@cartguard.test`,
      phone: `7${`${suffix}`.slice(-9)}`,
      passwordHash,
      role: "ADMIN",
    },
  });
  const customer = await prisma.customer.create({
    data: {
      fullName: "Cart Guard Customer",
      email: `cartguard-customer-${suffix}@cartguard.test`,
      phone: `8${`${suffix}`.slice(-9)}`,
      passwordHash,
      role: "CUSTOMER",
    },
  });
  customerId = customer.id;

  adminCookie = (await api("/api/auth/login", { method: "POST", body: { email: admin.email, password } })).setCookie ?? "";
  customerCookie = (await api("/api/auth/login", { method: "POST", body: { email: customer.email, password } })).setCookie ?? "";

  async function createProduct(name: string, stock: number): Promise<number> {
    const res = await api("/api/admin/products", {
      method: "POST",
      cookie: adminCookie,
      body: { name, category: "Agricultural Products", description: "Cart guard regression fixture.", price: 100, stockQuantity: stock, lowStockThreshold: 2, available: true },
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    return (res.data as { product: { id: number } }).product.id;
  }

  stockedProductId = await createProduct(`Cart Guard Stocked ${suffix}`, 5);
  emptyProductId = await createProduct(`Cart Guard Empty ${suffix}`, 0);
  unavailableProductId = await createProduct(`Cart Guard Unavailable ${suffix}`, 4);
  await api(`/api/admin/products/${unavailableProductId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { available: false },
  });
});

test.after(async () => {
  await prisma.order.deleteMany({ where: { customerId } });
  await prisma.product.deleteMany({ where: { id: { in: [stockedProductId, emptyProductId, unavailableProductId] } } });
  await prisma.customer.deleteMany({ where: { id: customerId } });
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  await prisma.$disconnect();
});

const checkoutBody = {
  paymentMethod: "cod",
  fullName: "Cart Guard Customer",
  phone: `8${`${suffix}`.slice(-9)}`,
  addressLine1: "12 Test Farm Road",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411001",
};

test("adding a zero-stock product is rejected at the cart boundary", async () => {
  const res = await api("/api/cart/items", {
    method: "POST",
    cookie: customerCookie,
    body: { productId: emptyProductId, quantity: 1 },
  });
  assert.equal(res.status, 409);
  assert.match(messageOf(res), /out of stock/i);
});

test("adding an admin-unavailable product is rejected at the cart boundary", async () => {
  const res = await api("/api/cart/items", {
    method: "POST",
    cookie: customerCookie,
    body: { productId: unavailableProductId, quantity: 1 },
  });
  assert.equal(res.status, 409);
  assert.match(messageOf(res), /not currently available/i);
});

test("cart quantities are capped at current stock and can be updated within it", async () => {
  const added = await api("/api/cart/items", {
    method: "POST",
    cookie: customerCookie,
    body: { productId: stockedProductId, quantity: 5 },
  });
  assert.equal(added.status, 201, JSON.stringify(added.data));

  const topped = await api("/api/cart/items", {
    method: "POST",
    cookie: customerCookie,
    body: { productId: stockedProductId, quantity: 1 },
  });
  assert.equal(topped.status, 409);
  assert.match(messageOf(topped), /only 5 units/i);
  assert.match(messageOf(topped), /left in stock/i);

  const itemId = ((added.data as { cart: { items: { id: number }[] } }).cart.items[0]).id;
  const tooMany = await api(`/api/cart/items/${itemId}`, {
    method: "PUT",
    cookie: customerCookie,
    body: { quantity: 7 },
  });
  assert.equal(tooMany.status, 409);

  const within = await api(`/api/cart/items/${itemId}`, {
    method: "PUT",
    cookie: customerCookie,
    body: { quantity: 4 },
  });
  assert.equal(within.status, 200);
});

test("checkout remains authoritative and drains stock; the cart boundary then blocks repeat adds", async () => {
  // the capped-cart test above left 4 units in the cart; start clean so the
  // placement below consumes exactly the full stock of 5
  await clearCart();

  // add to full stock and place the COD order
  await api("/api/cart/items", {
    method: "POST",
    cookie: customerCookie,
    body: { productId: stockedProductId, quantity: 5 },
  });

  const placed = await api("/api/orders", {
    method: "POST",
    cookie: customerCookie,
    body: checkoutBody,
  });
  assert.equal(placed.status, 201, JSON.stringify(placed.data));
  const order = (placed.data as { order?: { id: number; payment?: { status: string } } }).order;
  assert.ok(order?.id);
  assert.equal(order.payment?.status, "cod_due");
  createdOrderIds.push(order.id);

  const stockAfter = await prisma.product.findUniqueOrThrow({
    where: { id: stockedProductId },
    select: { stockQuantity: true },
  });
  assert.equal(stockAfter.stockQuantity, 0, "placement must have consumed all 5 units");

  // stock is zero now — the cart boundary reflects it immediately
  const blocked = await api("/api/cart/items", {
    method: "POST",
    cookie: customerCookie,
    body: { productId: stockedProductId, quantity: 1 },
  });
  assert.equal(blocked.status, 409);
  assert.match(messageOf(blocked), /out of stock/i);
});

test("cancelling the order restores stock and the product becomes purchasable again", async () => {
  // discard the leftover cart so nothing interferes with the next add
  await clearCart();

  const cancelled = await api(`/api/admin/orders/${createdOrderIds[0]}/status`, {
    method: "POST",
    cookie: adminCookie,
    body: { status: "cancelled", note: "cart-guard restore verification" },
  });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));

  const stockRestored = await prisma.product.findUniqueOrThrow({
    where: { id: stockedProductId },
    select: { stockQuantity: true },
  });
  assert.equal(stockRestored.stockQuantity, 5, "restore must return exactly the consumed units");

  const repurchasable = await api("/api/cart/items", {
    method: "POST",
    cookie: customerCookie,
    body: { productId: stockedProductId, quantity: 1 },
  });
  assert.equal(repurchasable.status, 201, JSON.stringify(repurchasable.data));
});

async function clearCart(): Promise<void> {
  const cart = await api("/api/cart", { cookie: customerCookie });
  const items = ((cart.data as { cart?: { items: { id: number }[] } }).cart?.items) ?? [];
  for (const item of items) {
    await api(`/api/cart/items/${item.id}`, { method: "DELETE", cookie: customerCookie });
  }
}

