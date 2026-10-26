import { prisma } from "../config/prisma.js";
import { toAdminOrderSummary, type AdminOrderSummary } from "./admin-order.service.js";
import { toAdminInquiry } from "./admin-inquiry.service.js";

const ACTIVE_FULFILMENT = ["confirmed", "processing", "packed", "shipped"];

function sum(values: { total: { toString(): string } | null }[]): number {
  return values.reduce((acc, row) => acc + (row.total ? parseFloat(row.total.toString()) : 0), 0);
}

function money(value: number): string {
  return value.toFixed(2);
}

/**
 * Aggregates the dashboard. Financial figures are split by what has actually been
 * collected: only `payment_status = paid` counts as revenue; COD and unverified UPI
 * are reported separately and never added to collected revenue.
 */
export async function getAdminDashboard() {
  const notCancelled = { status: { not: "cancelled" } };
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalOrders,
    awaitingAction,
    processing,
    delivered,
    cancelled,
    todayCount,
    paid,
    codDue,
    upiPending,
    failed,
    nonCancelled,
    productsTotal,
    productsActive,
    productsInactive,
    lowStock,
    outOfStock,
    inquiriesTotal,
    inquiriesNew,
    recentOrders,
    recentInquiries,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.count({ where: { status: { in: ACTIVE_FULFILMENT } } }),
    prisma.order.count({ where: { status: "delivered" } }),
    prisma.order.count({ where: { status: "cancelled" } }),
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.order.findMany({ where: { paymentStatus: "paid", ...notCancelled }, select: { total: true } }),
    prisma.order.findMany({
      where: { paymentMethod: "cod", paymentStatus: "cod_due", ...notCancelled },
      select: { total: true },
    }),
    prisma.order.findMany({
      where: { paymentMethod: "upi", paymentStatus: { not: "paid" }, ...notCancelled },
      select: { total: true },
    }),
    prisma.order.findMany({ where: { paymentStatus: "failed" }, select: { total: true } }),
    prisma.order.findMany({ where: notCancelled, select: { total: true } }),
    prisma.product.count(),
    prisma.product.count({ where: { archivedAt: null, available: true } }),
    prisma.product.count({ where: { archivedAt: null, available: false } }),
    prisma.product.count({
      where: {
        archivedAt: null,
        available: true,
        stockQuantity: { gt: 0, lte: prisma.product.fields.lowStockThreshold },
      },
    }),
    prisma.product.count({ where: { archivedAt: null, stockQuantity: { lte: 0 } } }),
    prisma.inquiry.count(),
    prisma.inquiry.count({ where: { status: "PENDING" } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        items: { include: { product: true }, orderBy: { createdAt: "asc" } },
        customer: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    }),
    prisma.inquiry.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const recentOrderSummaries: AdminOrderSummary[] = recentOrders.map(toAdminOrderSummary);

  return {
    orders: {
      total: totalOrders,
      awaitingAction,
      processing,
      delivered,
      cancelled,
      todayCount,
    },
    payments: {
      verifiedCollected: money(sum(paid)),
      verifiedCollectedOrders: paid.length,
      codDue: money(sum(codDue)),
      codDueOrders: codDue.length,
      upiPending: money(sum(upiPending)),
      upiPendingOrders: upiPending.length,
      failed: money(sum(failed)),
      failedOrders: failed.length,
      nonCancelledOrderValue: money(sum(nonCancelled)),
    },
    products: {
      total: productsTotal,
      active: productsActive,
      inactive: productsInactive,
      lowStock,
      outOfStock,
    },
    inquiries: { total: inquiriesTotal, new: inquiriesNew },
    recentOrders: recentOrderSummaries,
    recentInquiries: recentInquiries.map(toAdminInquiry),
  };
}
