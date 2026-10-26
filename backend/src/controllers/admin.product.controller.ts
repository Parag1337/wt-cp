import type { Request, Response } from "express";
import {
  adminProductListSchema,
  adminProductCreateSchema,
  adminProductUpdateSchema,
  priceUpdateSchema,
  availabilityUpdateSchema,
  inventoryAdjustSchema,
} from "../schemas/product.schema.js";
import {
  listProductsAdmin,
  getProductByIdAdmin,
  createProductAdmin,
  updateProductAdmin,
  archiveProductAdmin,
  adjustStockAdmin,
  replaceProductImageAdmin,
} from "../services/product.service.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listProductsAdminHandler = asyncHandler(async (req: Request, res: Response) => {
  const parsed = adminProductListSchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid query.");
  const result = await listProductsAdmin(parsed.data);
  res.json({ success: true, ...result });
});

export const getProductAdminHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid product ID.");
  const product = await getProductByIdAdmin(id);
  if (!product) throw new ApiError(404, "Product not found.");
  res.json({ success: true, product });
});

export const createProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = adminProductCreateSchema.parse(req.body);
  const product = await createProductAdmin(input);
  res.status(201).json({ success: true, product });
});

export const updateProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid product ID.");
  const input = adminProductUpdateSchema.parse(req.body);
  const product = await updateProductAdmin(id, input);
  res.json({ success: true, product });
});

export const updatePriceHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid product ID.");
  const input = priceUpdateSchema.parse(req.body);
  const product = await updateProductAdmin(id, { price: input.price, available: input.available });
  res.json({ success: true, product });
});

export const updateAvailabilityHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid product ID.");
  const input = availabilityUpdateSchema.parse(req.body);
  const product = await updateProductAdmin(id, { available: input.available });
  res.json({ success: true, product });
});

export const archiveProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid product ID.");
  const product = await archiveProductAdmin(id);
  res.json({ success: true, product });
});

export const adjustStockHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid product ID.");
  const admin = req.admin;
  if (!admin) throw new ApiError(401, "Unauthorized");
  const input = inventoryAdjustSchema.parse(req.body);
  const result = await adjustStockAdmin(id, admin.id, input.delta, input.reason);
  res.json({ success: true, ...result });
});

export const uploadImageHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid product ID.");
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new ApiError(400, "No image file provided.");
  const url = `/uploads/${file.filename}`;
  const product = await replaceProductImageAdmin(id, url);
  res.json({ success: true, product, imageUrl: url });
});
