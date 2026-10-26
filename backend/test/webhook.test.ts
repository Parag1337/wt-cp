import "dotenv/config";
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import {
  overrideCapturedPaymentLookup,
  reconcilePendingRazorpayOrders,
} from "../src/services/webhook.service.js";

const WEBHOOK_SECRET = "whsec_unit_test_secret_0123456789";
const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
const originalKeyId = process.env.RAZORPAY_KEY_ID;
const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;

const suffix = String(Date.now()).slice(-9);
const email = `webhook_agent_${suffix}@example.com`;
const phone = `9${suffix}`;
const eventBase = `evt_test_${suffix}`;

let baseUrl = "";
let cookie = "";
let server: ReturnType<typeof app.listen> | null = null;
let customerId = 0;
let razorpayOrderIdCounter = 0;

function signRaw(raw: Buffer, secret = WEBHOOK_SECRET): string {
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

function capturedEvent(input: {
  orderId: string;
  paymentId: string;
  amountPaise: number;
  currency?: string;
  status?: string;
}): { raw: Buffer; eventId: string; signature: string } {
  const raw = Buffer.from(
    JSON.stringify({
      entity: "event",
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: input.paymentId,
            order_id: input.orderId,
            amount: input.amountPaise,
            currency: input.currency ?? "INR",
            status: input.status ?? "captured",
            captured: (input.status ?? "captured") === "captured",
            method: "upi",
          },
        },
      },
    })
  );
  return { raw, eventId: input.paymentId, signature: signRaw(raw) };
}

async function postWebhook(
  raw: Buffer,
  signature: string,
  eventId: string,
  contentType = "application/json"
): Promise<{ status: number; data: any }> {
  const response = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "X-Razorpay-Signature": signature,
      "X-Razorpay-Event-Id": eventId,
    },
    body: raw as unknown as BodyInit,
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

async function createTestOrder(input: {
  paymentStatus?: string;
  status?: string;
  total?: number;
  paymentRef?: string | null;
  razorpayOrderId: string;
}): Promise<{ id: number; razorpayOrderId: string }> {
  razorpayOrderIdCounter += 1;
  const rpOrderId = input.razorpayOrderId;
  const order = await prisma.order.create({
    data: {
      customerId,
      status: input.status ?? "pending",
      total: input.total ?? 540,
      fullName: "Webhook Test",
      phone,
      addressLine1: "1 Webhook Street",
      city: "Khamgaon",
      state: "Maharashtra",
      pincode: "444303",
      paymentMethod: "razorpay",
      paymentStatus: input.paymentStatus ?? "pending",
      paymentRef: input.paymentRef ?? null,
      razorpayOrderId: rpOrderId,
    },
  });
  return { id: order.id, razorpayOrderId: rpOrderId };
}

async function eventRow(noteFrag: string) {
  return prisma.webhookEvent.findFirst({ where: { note: { contains: noteFrag } } });
}

before(async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  // A fake key id makes razorpayPayload-style helpers work without network;
  // webhook tests never call Razorpay (provider lookup is overridden).
  process.env.RAZORPAY_KEY_ID = "rzp_test_fake_webhook";
  process.env.RAZORPAY_KEY_SECRET = "rzp_test_fake_secret";

  const httpServer = app.listen(0);
  server = httpServer;
  await new Promise<void>((resolve) => httpServer.once("listening", () => resolve()));
  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Webhook Test",
      email,
      phone,
      password: "testpass123",
    }),
  });
  assert.equal(register.status, 201);
  const setCookie = register.headers.get("set-cookie");
  cookie = setCookie ? setCookie.split(";")[0] : "";
  const me = await prisma.customer.findUnique({ where: { email } });
  assert.ok(me);
  customerId = me.id;
});

after(async () => {
  if (originalWebhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
  else process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
  if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
  else process.env.RAZORPAY_KEY_ID = originalKeyId;
  if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
  else process.env.RAZORPAY_KEY_SECRET = originalKeySecret;

  await prisma.order.deleteMany({ where: { customerId } });
  await prisma.webhookEvent.deleteMany({});
  const httpServer = server;
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
  await prisma.$disconnect();
});

test("webhook endpoint is fail-closed: 503 without a configured secret", async () => {
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  const body = Buffer.from('{"event":"payment.captured"}');
  const result = await postWebhook(body, signRaw(body, WEBHOOK_SECRET), `${eventBase}_503`);
  assert.equal(result.status, 503);
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

test("tampered, missing and mis-signed payloads are rejected with 400", async () => {
  const order = await createTestOrder({ razorpayOrderId: `order_wt${suffix}_a` });
  const event = capturedEvent({
    orderId: order.razorpayOrderId,
    paymentId: `pay_wt${suffix}_bad1`,
    amountPaise: 54000,
  });

  const tampered = await postWebhook(event.raw, signRaw(event.raw, "wrong_secret"), `${eventBase}_bad`);
  assert.equal(tampered.status, 400);

  const missing = await postWebhook(event.raw, "", `${eventBase}_bad2`);
  assert.equal(missing.status, 400);

  const noEventId = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Razorpay-Signature": event.signature,
    },
    body: event.raw as unknown as BodyInit,
  });
  assert.equal(noEventId.status, 400);

  const untouched = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(untouched.paymentStatus, "pending");
});

test("a valid payment.captured event reconciles the order and records the event", async () => {
  const order = await createTestOrder({ razorpayOrderId: `order_wt${suffix}_b` });
  const event = capturedEvent({
    orderId: order.razorpayOrderId,
    paymentId: `pay_wt${suffix}_good`,
    amountPaise: 54000,
  });

  const result = await postWebhook(event.raw, event.signature, `${eventBase}_good`);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.replay, false);

  const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(dbOrder.paymentStatus, "paid");
  assert.equal(dbOrder.status, "confirmed");
  assert.equal(dbOrder.paymentRef, `pay_wt${suffix}_good`);

  const recorded = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "razorpay", eventId: `${eventBase}_good` } },
  });
  assert.ok(recorded);
  assert.equal(recorded.status, "processed");
  assert.ok(recorded.processedAt);

  // One audit row for the status transition, carried by the webhook path.
  const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id } });
  assert.equal(history.length, 1);
  assert.match(history[0].note ?? "", /payment captured/i);
});

test("redelivery of the same event id is acknowledged as a replay without re-processing", async () => {
  // order_wt{suffix}_b was paid by the earlier test in this file.
  const paidOrder = await prisma.order.findFirst({
    where: { razorpayOrderId: `order_wt${suffix}_b` },
  });
  assert.ok(paidOrder, "the previously reconciled order should exist");
  const event = capturedEvent({
    orderId: `order_wt${suffix}_b`,
    paymentId: `pay_wt${suffix}_good`,
    amountPaise: 54000,
  });

  const before = await prisma.orderStatusHistory.count({ where: { orderId: paidOrder.id } });
  const result = await postWebhook(event.raw, event.signature, `${eventBase}_good`);
  assert.equal(result.status, 200);
  assert.equal(result.data.replay, true);

  const after = await prisma.orderStatusHistory.count({ where: { orderId: paidOrder.id } });
  assert.equal(after, before, "no duplicate processing");

  const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: paidOrder.id } });
  assert.equal(dbOrder.paymentStatus, "paid");

  const rows = await prisma.webhookEvent.findMany({
    where: { eventId: `${eventBase}_good` },
  });
  assert.equal(rows.length, 1, "no duplicate event row");
});

test("a captured event with a wrong amount is recorded as failed and leaves the order pending", async () => {
  const order = await createTestOrder({ razorpayOrderId: `order_wt${suffix}_c` });
  const event = capturedEvent({
    orderId: order.razorpayOrderId,
    paymentId: `pay_wt${suffix}_mismatch`,
    amountPaise: 9999,
  });

  const result = await postWebhook(event.raw, event.signature, `${eventBase}_mismatch`);
  assert.equal(result.status, 200, "acknowledged so Razorpay stops retrying");

  const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(dbOrder.paymentStatus, "pending");

  const recorded = await eventRow("amount mismatch");
  assert.ok(recorded);
  assert.equal(recorded.eventType, "payment.captured");
});

test("an event for an unknown razorpay order is ignored, not failed", async () => {
  const event = capturedEvent({
    orderId: `order_nosuch_${suffix}`,
    paymentId: `pay_wt${suffix}_ghost`,
    amountPaise: 54000,
  });
  const result = await postWebhook(event.raw, event.signature, `${eventBase}_ghost`);
  assert.equal(result.status, 200);
  const recorded = await eventRow("no local order");
  assert.ok(recorded);
  assert.equal(recorded.status, "ignored");
});

test("an already-paid order (different payment) is not overwritten", async () => {
  const order = await createTestOrder({
    razorpayOrderId: `order_wt${suffix}_d`,
    paymentStatus: "paid",
    paymentRef: `pay_wt${suffix}_first`,
    status: "confirmed",
  });
  const event = capturedEvent({
    orderId: order.razorpayOrderId,
    paymentId: `pay_wt${suffix}_second`,
    amountPaise: 54000,
  });
  const result = await postWebhook(event.raw, event.signature, `${eventBase}_second`);
  assert.equal(result.status, 200);
  const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(dbOrder.paymentStatus, "paid");
  assert.equal(dbOrder.paymentRef, `pay_wt${suffix}_first`);
  const recorded = await eventRow("already paid by a different payment");
  assert.ok(recorded);
  assert.equal(recorded.status, "ignored");
});

test("a cancelled order with a captured payment is flagged for manual refunds", async () => {
  const order = await createTestOrder({
    razorpayOrderId: `order_wt${suffix}_e`,
    status: "cancelled",
  });
  const event = capturedEvent({
    orderId: order.razorpayOrderId,
    paymentId: `pay_wt${suffix}_cancel`,
    amountPaise: 54000,
  });
  const result = await postWebhook(event.raw, event.signature, `${eventBase}_cancel`);
  assert.equal(result.status, 200);
  const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(dbOrder.status, "cancelled");
  assert.equal(dbOrder.paymentStatus, "pending", "money moved; requires a human decision");
  const recorded = await eventRow("captured after cancellation");
  assert.ok(recorded);
});

test("payment.failed events are recorded and leave the order retryable", async () => {
  const order = await createTestOrder({ razorpayOrderId: `order_wt${suffix}_f` });
  const raw = Buffer.from(
    JSON.stringify({
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: `pay_wt${suffix}_failed`,
            order_id: order.razorpayOrderId,
            amount: 54000,
            currency: "INR",
            status: "failed",
            error_description: "Card was declined by the bank",
          },
        },
      },
    })
  );
  const result = await postWebhook(raw, signRaw(raw), `${eventBase}_failed`);
  assert.equal(result.status, 200);
  const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(dbOrder.paymentStatus, "pending");
  const recorded = await eventRow("Card was declined");
  assert.ok(recorded);
  assert.equal(recorded.status, "processed");
});

test("unhandled event types are recorded and acknowledged", async () => {
  const raw = Buffer.from(JSON.stringify({ event: "refund.processed" }));
  const result = await postWebhook(raw, signRaw(raw), `${eventBase}_refund`);
  assert.equal(result.status, 200);
  const recorded = await eventRow("event type not handled");
  assert.ok(recorded);
  assert.equal(recorded.status, "ignored");
});

test("an oversized body is rejected by the parser (413) before touching the DB", async () => {
  const big = Buffer.alloc(300_000, 0x41); // > 256kb limit
  const response = await fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Razorpay-Signature": signRaw(big),
      "X-Razorpay-Event-Id": `${eventBase}_big`,
    },
    body: big as unknown as BodyInit,
  });
  assert.equal(response.status, 413);
  const recorded = await prisma.webhookEvent.findFirst({
    where: { eventId: `${eventBase}_big` },
  });
  assert.equal(recorded, null, "the body must not reach the handler");
});

test("charset-suffixed content types still verify over the exact raw bytes", async () => {
  const order = await createTestOrder({ razorpayOrderId: `order_wt${suffix}_g` });
  const event = capturedEvent({
    orderId: order.razorpayOrderId,
    paymentId: `pay_wt${suffix}_charset`,
    amountPaise: 54000,
  });
  const result = await postWebhook(
    event.raw,
    event.signature,
    `${eventBase}_charset`,
    "application/json; charset=utf-8"
  );
  assert.equal(result.status, 200, JSON.stringify(result.data));
  const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(dbOrder.paymentStatus, "paid");
});

test("reconciliation sweep confirms a pending order whose payment was captured at the provider", async () => {
  const order = await createTestOrder({
    razorpayOrderId: `order_wt${suffix}_sweep`,
    total: 300,
  });
  // Make the order old enough for the sweep window.
  await prisma.$executeRaw`UPDATE orders SET updated_at = DATE_SUB(NOW(0), INTERVAL 20 MINUTE) WHERE id = ${order.id}`;

  // Pretend the provider says this payment got captured.
  overrideCapturedPaymentLookup(async (razorpayOrderId) => {
    if (razorpayOrderId !== order.razorpayOrderId) return null;
    return {
      id: `pay_wt${suffix}_sweep`,
      amountPaise: 30000,
      currency: "INR",
      captured: true,
    };
  });

  const summary = await reconcilePendingRazorpayOrders({ olderThanMinutes: 10, limit: 10 });
  assert.ok(summary.scanned >= 1);
  assert.ok(summary.confirmed >= 1);

  const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(dbOrder.paymentStatus, "paid");
  assert.equal(dbOrder.paymentRef, `pay_wt${suffix}_sweep`);
  assert.equal(dbOrder.status, "confirmed");

  // A second sweep is idempotent: same event eventually, no state change.
  const second = await reconcilePendingRazorpayOrders({ olderThanMinutes: 10, limit: 10 });
  assert.equal(second.confirmed, 0);
  const reOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(reOrder.paymentRef, `pay_wt${suffix}_sweep`);
});

test("sweep does not confirm when the provider has no captured payment", async () => {
  const order = await createTestOrder({
    razorpayOrderId: `order_wt${suffix}_nosweep`,
    total: 200,
  });
  await prisma.$executeRaw`UPDATE orders SET updated_at = DATE_SUB(NOW(0), INTERVAL 20 MINUTE) WHERE id = ${order.id}`;

  overrideCapturedPaymentLookup(async (razorpayOrderId) => {
    if (razorpayOrderId !== order.razorpayOrderId) return null;
    return { id: "pay_none", amountPaise: 20000, currency: "INR", captured: false };
  });

  const summary = await reconcilePendingRazorpayOrders({ olderThanMinutes: 10, limit: 10 });
  const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(dbOrder.paymentStatus, "pending");
  await prisma.order.delete({ where: { id: order.id } });
  void summary;
});
