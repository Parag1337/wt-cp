import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { env } from "../config/env.js";
import { getAdminProductImageValue } from "../services/admin-product.service.js";
import { getAdminDashboard } from "../services/admin-dashboard.service.js";
import {
  listAdminOrders,
  getAdminOrder,
  updateAdminOrderStatus,
  orderStatusInputSchema,
} from "../services/admin-order.service.js";
import {
  listAdminProducts,
  getAdminProduct,
  createAdminProduct,
  updateAdminProduct,
  setAdminProductArchived,
  setAdminProductImage,
  adminProductInputSchema,
  adminProductPatchSchema,
} from "../services/admin-product.service.js";
import {
  listInventory,
  adjustStock,
  listStockAdjustments,
  stockAdjustmentSchema,
} from "../services/admin-inventory.service.js";
import {
  listAdminInquiries,
  updateAdminInquiry,
  inquiryUpdateSchema,
} from "../services/admin-inquiry.service.js";

export function parseId(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Invalid id.");
  }
  return id;
}

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await getAdminDashboard() });
});

// ── Orders ────────────────────────────────────────────────────────────────

export const orders = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, ...(await listAdminOrders(req.query)) });
});

export const order = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, order: await getAdminOrder(parseId(req.params.id)) });
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const admin = req.customer;
  if (!admin) throw new ApiError(401, "Unauthorized");
  const input = orderStatusInputSchema.parse(req.body);
  await updateAdminOrderStatus(parseId(req.params.id), admin.id, input);
  res.json({ success: true, order: await getAdminOrder(parseId(req.params.id)) });
});

// ── Products ──────────────────────────────────────────────────────────────

export const products = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, ...(await listAdminProducts(req.query)) });
});

export const product = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, product: await getAdminProduct(parseId(req.params.id)) });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const input = adminProductInputSchema.parse(req.body);
  res.status(201).json({ success: true, product: await createAdminProduct(input) });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const input = adminProductPatchSchema.parse(req.body);
  res.json({ success: true, product: await updateAdminProduct(parseId(req.params.id), input) });
});

export const archiveProduct = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, product: await setAdminProductArchived(parseId(req.params.id), true) });
});

export const restoreProduct = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, product: await setAdminProductArchived(parseId(req.params.id), false) });
});

export const removeProductImage = asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const previous = await getAdminProductImageValue(id);
  const product = await setAdminProductImage(id, null);
  // Best-effort cleanup of the removed local upload — only when the stored
  // value actually pointed at our managed /uploads/products files.
  if (previous?.startsWith("/uploads/products/")) {
    fs.rm(path.join(env.storage.uploadDir, path.basename(previous)), { force: true }, () => undefined);
  }
  res.json({ success: true, product });
});

// ── Inventory ─────────────────────────────────────────────────────────────

export const inventory = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, ...(await listInventory(req.query)) });
});

export const adjustProductStock = asyncHandler(async (req: Request, res: Response) => {
  const admin = req.customer;
  if (!admin) throw new ApiError(401, "Unauthorized");
  const input = stockAdjustmentSchema.parse(req.body);
  const result = await adjustStock(parseId(req.params.id), admin.id, input);
  res.json({ success: true, ...result });
});

export const stockAdjustments = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || undefined;
  const pageSize = Number(req.query.pageSize) || undefined;
  res.json({
    success: true,
    ...(await listStockAdjustments(parseId(req.params.id), { page, pageSize })),
  });
});

// ── Inquiries ─────────────────────────────────────────────────────────────

export const inquiries = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, ...(await listAdminInquiries(req.query)) });
});

export const updateInquiry = asyncHandler(async (req: Request, res: Response) => {
  const input = inquiryUpdateSchema.parse(req.body);
  res.json({ success: true, inquiry: await updateAdminInquiry(parseId(req.params.id), input) });
});
