import { prisma } from "../config/prisma.js";

export async function getDashboardSummary() {
  const [
    totalOrders,
    ordersByStatus,
    lowStockCount,
    outOfStockCount,
    recentOrders,
    recentInquiries,
    revenueAgg,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.product.count({ where: { stockQuantity: { gt: 0, lte: 5 } } }),
    prisma.product.count({ where: { stockQuantity: { lte: 0 } } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: { include: { product: true } } },
    }),
    prisma.inquiry.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.order.aggregate({
      where: { paymentStatus: "paid" },
      _sum: { total: true },
    }),
  ]);

  const ordersRequiringAction = await prisma.order.count({
    where: { status: { in: ["pending", "confirmed", "processing"] } },
  });

  return {
    totalOrders,
    ordersRequiringAction,
    ordersByStatus: ordersByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    lowStockCount,
    outOfStockCount,
    collectedRevenue: revenueAgg._sum.total?.toString() ?? "0.00",
    recentOrders,
    recentInquiries,
  };
}
