import { z } from "zod";
import { Prisma } from "../generated/client/client.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import {
  getAdminProduct,
  resolveProductImage,
  type PublicAdminProduct,
} from "./admin-product.service.js";

const inventoryQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  filter: z.enum(["low", "out", "ok"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const stockAdjustmentSchema = z
  .object({
    delta: z.coerce.number().int().min(-100000).max(100000).optional(),
    newQuantity: z.coerce.number().int().min(0).max(1000000).optional(),
    reason: z.string().trim().min(3, "Add a short reason for this adjustment.").max(255, "Reason is too long."),
  })
  .refine((value) => (value.delta === undefined) !== (value.newQuantity === undefined), {
    message: "Send either a delta or a new quantity.",
    path: ["delta"],
  })
  .refine((value) => value.delta === undefined || value.delta !== 0, {
    message: "The change must be a non-zero number of units.",
    path: ["delta"],
  });

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

/** Non-archived products, worst stock first (MySQL: out of stock, then low, then rest). */
export async function listInventory(rawQuery: unknown) {
  const query = inventoryQuerySchema.parse(rawQuery);
  const lowStockWhere = { stockQuantity: { lte: prisma.product.fields.lowStockThreshold } };

  const where: Record<string, unknown> = { archivedAt: null };
  if (query.q) {
    where.OR = [
      { name: { contains: query.q } },
      ...(/^\d+$/.test(query.q) ? [{ id: Number(query.q) }] : []),
    ];
  }
  if (query.filter === "out") where.stockQuantity = { lte: 0 };
  if (query.filter === "low") {
    where.stockQuantity = { gt: 0 };
    where.AND = [lowStockWhere];
  }
  if (query.filter === "ok") {
    where.NOT = lowStockWhere;
    where.stockQuantity = { gt: 0 };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ stockQuantity: "asc" }, { name: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  const referenced = await prisma.orderItem.findMany({
    where: { productId: { in: products.map((product) => product.id) } },
    select: { productId: true },
    distinct: ["productId"],
  });
  const referencedIds = new Set(referenced.map((row) => row.productId));

  const data: PublicAdminProduct[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    image: resolveProductImage(product.image),
    price: product.price ? product.price.toFixed(2) : null,
    available: product.available,
    stockQuantity: product.stockQuantity,
    lowStockThreshold: product.lowStockThreshold,
    archivedAt: product.archivedAt ? product.archivedAt.toISOString() : null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    hasOrders: referencedIds.has(product.id),
  }));

  return {
    data,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

/**
 * Applies a stock adjustment in a transaction against the freshly-read quantity and
 * writes the audit row. The new quantity comes from the server, never the client,
 * and a negative result is rejected (400) instead of silently clamped.
 *
 * Concurrency: the product row is locked with SELECT ... FOR UPDATE inside the
 * transaction, so two admins adjusting stock at the same time serialize on the
 * live quantity. Without the lock both read the same previous value and the
 * second write wins with a stale `previous_quantity` audit trail (lost update).
 * This does NOT change the stock-model contract (doc §6): checkout still
 * neither reserves nor decrements — stock keeps exactly one owner.
 */
export async function adjustStock(
  productId: number,
  adminId: number,
  input: StockAdjustmentInput
): Promise<{ product: PublicAdminProduct; adjustment: { id: number; delta: number; previousQuantity: number; newQuantity: number; reason: string; createdAt: string } }> {
  const result = await prisma.$transaction(async (tx) => {
    // Lock first, then read: the transaction survives until commit, so the
    // update below is the only writer between lock and commit.
    const locked = await tx.$queryRaw<Array<{ stock_quantity: number | bigint }>>(
      Prisma.sql`SELECT \`stock_quantity\` FROM \`products\` WHERE \`id\` = ${productId} FOR UPDATE`
    );
    if (locked.length === 0) throw new ApiError(404, "Product not found.");

    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(404, "Product not found.");
    if (product.archivedAt) {
      throw new ApiError(409, "Restore this product before adjusting its stock.");
    }

    const previous = Number(locked[0].stock_quantity);
    const next = input.newQuantity ?? previous + (input.delta ?? 0);
    if (next < 0) {
      throw new ApiError(400, `That would make stock negative (current: ${previous}).`);
    }
    const delta = next - previous;

    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        stockQuantity: next,
        // Show a sold-out product as unavailable; never auto-enable.
        ...(next === 0 && product.available ? { available: false } : {}),
      },
    });

    const adjustment = await tx.stockAdjustment.create({
      data: { productId, adminId, delta, reason: input.reason, previousQuantity: previous, newQuantity: next },
    });

    return { updated, adjustment };
  });

  return {
    product: await getAdminProduct(result.updated.id),
    adjustment: {
      id: result.adjustment.id,
      delta: result.adjustment.delta,
      previousQuantity: result.adjustment.previousQuantity,
      newQuantity: result.adjustment.newQuantity,
      reason: result.adjustment.reason,
      createdAt: result.adjustment.createdAt.toISOString(),
    },
  };
}

export async function listStockAdjustments(
  productId: number,
  rawQuery: { page?: number; pageSize?: number }
) {
  const page = Math.max(1, Number(rawQuery.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(rawQuery.pageSize) || 20));
  const where = { productId };

  const [rows, total] = await Promise.all([
    prisma.stockAdjustment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { admin: { select: { id: true, fullName: true } } },
    }),
    prisma.stockAdjustment.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      delta: row.delta,
      reason: row.reason,
      previousQuantity: row.previousQuantity,
      newQuantity: row.newQuantity,
      createdAt: row.createdAt.toISOString(),
      admin: row.admin ? { id: row.admin.id, fullName: row.admin.fullName } : null,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
