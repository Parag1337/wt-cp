import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { reconcilePendingRazorpayOrders } from "./services/webhook.service.js";

const server = app.listen(env.port, () => {
  console.log(`[server] API listening on http://localhost:${env.port}`);
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