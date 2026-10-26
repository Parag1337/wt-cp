import "dotenv/config";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import bcrypt from "bcrypt";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import {
  allowedTransitionsFor,
  ORDER_FULFILMENT_FLOW,
} from "../src/services/admin-order.service.js";
import { resolveProductImage } from "../src/services/admin-product.service.js";

// ── pure helpers ──────────────────────────────────────────────────────────

test("fulfilment transitions only move forward and are terminal after delivery", () => {
  for (const status of ORDER_FULFILMENT_FLOW) {
    const index = ORDER_FULFILMENT_FLOW.indexOf(status);
    for (const target of allowedTransitionsFor(status)) {
      if (target === "cancelled") continue;
      assert.ok(
        ORDER_FULFILMENT_FLOW.indexOf(target) > index,
        `${status} -> ${target} must move forward`
      );
    }
  }
  assert.deepEqual(allowedTransitionsFor("delivered"), []);
  assert.deepEqual(allowedTransitionsFor("cancelled"), []);
  assert.deepEqual(allowedTransitionsFor("shipped"), ["delivered", "cancelled"]);
  assert.deepEqual(allowedTransitionsFor("unknown"), []);
});

test("product images resolve URLs, root paths and bare filenames", () => {
  assert.equal(resolveProductImage(null), null);
  assert.equal(resolveProductImage("  "), null);
  assert.equal(resolveProductImage("https://x.test/a.jpg"), "https://x.test/a.jpg");
  assert.equal(resolveProductImage("/uploads/products/a.png"), "/uploads/products/a.png");
  assert.equal(resolveProductImage("a.png"), "/uploads/products/a.png");
});

// ── authorization + admin API over HTTP ───────────────────────────────────

/** Loosely typed JSON body for assertions in this HTTP-level test. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
type ApiResult = { status: number; data: Json; cookie: string | null };

const suffix = String(Date.now()).slice(-9);
const adminEmail = `admin_${suffix}@example.test`;
const customerEmail = `cust_${suffix}@example.test`;
const password = "AdminTest#2026";
const productName = `Admin Test Product ${suffix}`;

let server: ReturnType<typeof app.listen> | null = null;
let baseUrl = "";
let adminId = 0;
let customerId = 0;
let adminCookie = "";
let customerCookie = "";
let productId = 0;
let orderId = 0;

async function api(
  path: string,
  options: { method?: string; cookie?: string; body?: unknown; form?: FormData } = {}
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.Cookie = options.cookie;
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });
  const data = await response.json().catch(() => null);
  const setCookie = response.headers.get("set-cookie");
  return { status: response.status, data, cookie: setCookie ? setCookie.split(";")[0] : null };
}

before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  const address = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${address.port}`;

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.customer.create({
    data: { fullName: "Test Owner", email: adminEmail, phone: `7${suffix}`, passwordHash, role: "ADMIN" },
  });
  const customer = await prisma.customer.create({
    data: { fullName: "Test Customer", email: customerEmail, phone: `8${suffix}`, passwordHash, role: "CUSTOMER" },
  });
  adminId = admin.id;
  customerId = customer.id;

  adminCookie = (await api("/api/auth/login", { method: "POST", body: { email: adminEmail, password } })).cookie ?? "";
  customerCookie = (await api("/api/auth/login", { method: "POST", body: { email: customerEmail, password } })).cookie ?? "";
});

after(async () => {
  if (orderId) await prisma.order.deleteMany({ where: { id: orderId } });
  if (productId) {
    await prisma.stockAdjustment.deleteMany({ where: { productId } });
  }
  // History rows cascade with the order, but products referenced by order items
  // must survive the order until its items are gone.
  await prisma.order.deleteMany({ where: { customerId } });
  if (productId) {
    await prisma.product.deleteMany({ where: { id: productId } });
  }
  await prisma.customer.deleteMany({ where: { id: { in: [adminId, customerId] } } });
  server?.close();
  await prisma.$disconnect();
});

test("auth/me exposes the server-side role", async () => {
  const adminMe = await api("/api/auth/me", { cookie: adminCookie });
  assert.equal(adminMe.status, 200);
  assert.equal(adminMe.data.customer.role, "ADMIN");

  const customerMe = await api("/api/auth/me", { cookie: customerCookie });
  assert.equal(customerMe.data.customer.role, "CUSTOMER");

  const anon = await api("/api/auth/me");
  assert.equal(anon.status, 401);
});

test("admin endpoints reject anonymous and customer sessions", async () => {
  for (const path of ["/api/admin/dashboard", "/api/admin/orders", "/api/admin/products", "/api/admin/inventory", "/api/admin/inquiries"]) {
    const anon = await api(path);
    assert.equal(anon.status, 401, `${path} without session`);
    const customer = await api(path, { cookie: customerCookie });
    assert.equal(customer.status, 403, `${path} with a customer account`);
  }
  const mutate = await api("/api/admin/products", {
    method: "POST",
    cookie: customerCookie,
    body: { name: "Hack", category: "Seeds", description: "x", price: null, available: true, stockQuantity: 1, lowStockThreshold: 1 },
  });
  assert.equal(mutate.status, 403);
});

test("admin can create, patch and archive a product", async () => {
  const created = await api("/api/admin/products", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: productName,
      category: "Seeds",
      description: "Created by the admin API test.",
      price: "266.50",
      image: null,
      available: true,
      stockQuantity: 10,
      lowStockThreshold: 4,
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  productId = created.data.product.id;
  assert.equal(created.data.product.price, "266.50");
  assert.equal(created.data.product.stockQuantity, 10);
  assert.equal(created.data.product.hasOrders, false);

  const patched = await api(`/api/admin/products/${productId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { price: "300" },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.product.price, "300.00");

  const invalid = await api(`/api/admin/products/${productId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { price: "12.345" },
  });
  assert.equal(invalid.status, 400);

  const archived = await api(`/api/admin/products/${productId}/archive`, { method: "POST", cookie: adminCookie });
  assert.equal(archived.status, 200);
  assert.ok(archived.data.product.archivedAt);
  assert.equal(archived.data.product.available, false);

  // Archived products disappear from the storefront.
  const publicList = await api("/api/products");
  assert.equal(publicList.data.products.some((p: { id: number }) => p.id === productId), false);

  const restored = await api(`/api/admin/products/${productId}/restore`, { method: "POST", cookie: adminCookie });
  assert.equal(restored.status, 200);
  assert.equal(restored.data.product.archivedAt, null);
});

test("image upload validates type and stores a server path", async () => {
  const png = Uint8Array.from(
    Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5f3d3b50000000049454e44ae426082",
      "hex"
    )
  );
  const form = new FormData();
  form.append("image", new Blob([png], { type: "image/png" }), "test.png");
  const uploaded = await api(`/api/admin/products/${productId}/image`, { method: "POST", cookie: adminCookie, form });
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.data));
  assert.match(uploaded.data.product.image, /^\/uploads\/products\/.+\.png$/);

  const served = await fetch(`${baseUrl}${uploaded.data.product.image}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/png");

  const badForm = new FormData();
  badForm.append("image", new Blob(["not an image"], { type: "text/plain" }), "x.txt");
  const rejected = await api(`/api/admin/products/${productId}/image`, { method: "POST", cookie: adminCookie, form: badForm });
  assert.equal(rejected.status, 415);

  const removed = await api(`/api/admin/products/${productId}/image`, { method: "DELETE", cookie: adminCookie });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.product.image, null);
});

test("stock adjustments are audited and cannot go negative", async () => {
  const added = await api(`/api/admin/products/${productId}/stock`, {
    method: "POST",
    cookie: adminCookie,
    body: { delta: 5, reason: "Delivery from supplier" },
  });
  assert.equal(added.status, 200);
  assert.equal(added.data.product.stockQuantity, 15);
  assert.equal(added.data.adjustment.delta, 5);
  assert.equal(added.data.adjustment.previousQuantity, 10);
  assert.equal(added.data.adjustment.newQuantity, 15);

  const negative = await api(`/api/admin/products/${productId}/stock`, {
    method: "POST",
    cookie: adminCookie,
    body: { delta: -100, reason: "Damaged bags" },
  });
  assert.equal(negative.status, 400);

  const zero = await api(`/api/admin/products/${productId}/stock`, {
    method: "POST",
    cookie: adminCookie,
    body: { delta: 0, reason: "No change" },
  });
  assert.equal(zero.status, 400);

  const noReason = await api(`/api/admin/products/${productId}/stock`, {
    method: "POST",
    cookie: adminCookie,
    body: { delta: 1, reason: "" },
  });
  assert.equal(noReason.status, 400);

  const history = await api(`/api/admin/products/${productId}/stock-adjustments`, { cookie: adminCookie });
  assert.equal(history.status, 200);
  assert.equal(history.data.data.length, 1);
  assert.equal(history.data.data[0].admin.id, adminId);
});

test("inventory list reports the adjusted product", async () => {
  const invoice = await api(`/api/admin/inventory?q=${encodeURIComponent(productName)}`, { cookie: adminCookie });
  assert.equal(invoice.status, 200);
  assert.equal(invoice.data.data.length, 1);
  assert.equal(invoice.data.data[0].stockQuantity, 15);
});

test("order status transitions are validated and audited", async () => {
  await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 100 } });
  const order = await prisma.order.create({
    data: {
      customerId,
      status: "pending",
      total: 300,
      fullName: "Test Customer",
      phone: "9800000000",
      addressLine1: "1 Test Road",
      city: "Khamgaon",
      state: "Maharashtra",
      pincode: "444303",
      paymentMethod: "cod",
      paymentStatus: "cod_due",
      items: { create: [{ productId, quantity: 1, unitPrice: 300 }] },
    },
  });
  orderId = order.id;

  const detail = await api(`/api/admin/orders/${orderId}`, { cookie: adminCookie });
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.data.order.allowedTransitions, ["confirmed", "processing", "cancelled"]);

  const illegal = await api(`/api/admin/orders/${orderId}/status`, {
    method: "POST",
    cookie: adminCookie,
    body: { status: "delivered" },
  });
  assert.equal(illegal.status, 409);

  const confirmed = await api(`/api/admin/orders/${orderId}/status`, {
    method: "POST",
    cookie: adminCookie,
    body: { status: "confirmed", note: "Stock available" },
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.data));
  assert.equal(confirmed.data.order.status, "confirmed");
  assert.equal(confirmed.data.order.history.length, 1);
  assert.equal(confirmed.data.order.history[0].status, "confirmed");
  assert.equal(confirmed.data.order.history[0].note, "Stock available");
  assert.equal(confirmed.data.order.history[0].by, "Test Owner");

  const stale = await api(`/api/admin/orders/${orderId}/status`, {
    method: "POST",
    cookie: adminCookie,
    body: { status: "confirmed" },
  });
  assert.equal(stale.status, 409);
});

test("dashboard splits collected, COD and unverified UPI money", async () => {
  const response = await api("/api/admin/dashboard", { cookie: adminCookie });
  assert.equal(response.status, 200);
  const data = response.data.data;
  assert.equal(typeof data.payments.verifiedCollected, "string");
  // The COD order created above must be in the COD bucket, never in collected revenue.
  assert.ok(data.payments.codDueOrders >= 1);
  assert.ok(Number(data.payments.codDue) >= 300);
  assert.equal(data.recentOrders.every((o: { id: number }) => typeof o.id === "number"), true);
});

test("inquiry status updates are persisted", async () => {
  const created = await prisma.inquiry.create({
    data: {
      name: "Test Farmer",
      phone: "9700000000",
      email: `inquiry_${suffix}@example.test`,
      message: "Is urea available?",
      status: "PENDING",
    },
  });

  const list = await api("/api/admin/inquiries?status=PENDING", { cookie: adminCookie });
  assert.equal(list.status, 200);
  assert.ok(list.data.data.some((row: { id: number }) => row.id === created.id));

  const updated = await api(`/api/admin/inquiries/${created.id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "RESOLVED", internalNotes: "Called back" },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.inquiry.status, "RESOLVED");
  assert.equal(updated.data.inquiry.internalNotes, "Called back");

  await prisma.inquiry.delete({ where: { id: created.id } });
});
