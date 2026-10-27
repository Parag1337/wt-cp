import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { reconcilePendingRazorpayOrders } from "./services/webhook.service.js";

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`[server] API listening on http://0.0.0.0:${env.port}`);

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID?.trim();
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

  if (!razorpayKeyId || !razorpayKeySecret) {
    console.warn(
      "[razorpay] Online payments are NOT configured: RAZORPAY_KEY_ID and/or RAZORPAY_KEY_SECRET are missing. Online payment option will be disabled."
    );
  } else {
    console.log("[razorpay] Online payments configured (test or live key id present).");
  }

  if (!razorpayWebhookSecret) {
    console.warn(
      "[razorpay] Webhook processing is NOT configured: RAZORPAY_WEBHOOK_SECRET is missing. Webhook endpoint returns 503."
    );
  }
});

/**
 * Reconciliation sweeper: re-checks payment-pending Razorpay orders against
 * the provider and confirms orders whose payment was captured server-side.
 * Off by default; set PAYMENTS_RECONCILE_MINUTES > 0 in production.
 */
const reconcileMinutes = Number(process.env.PAYMENTS_RECONCILE_MINUTES ?? 0);
if (Number.isFinite(reconcileMinutes) && reconcileMinutes > 0) {
  const interval = Math.min(600, Math.max(1, reconcileMinutes)) * 60_000;
  const timer = setInterval(() => {
    void reconcilePendingRazorpayOrders({
      olderThanMinutes: Math.ceil(reconcileMinutes),
    }).catch((error) => {
      console.error("[reconcile] sweep failed:", error instanceof Error ? error.message : error);
    });
  }, interval);
  timer.unref?.();
  console.log(`[server] payment reconciliation sweeps every ${Math.floor(interval / 60000)} minute(s)`);
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));