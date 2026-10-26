import type { Request, Response } from "express";
import { listOrdersAdmin, updateOrderStatusAdmin } from "../services/order.service.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listOrdersAdminHandler = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const result = await listOrdersAdmin({
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    paymentStatus: typeof req.query.paymentStatus === "string" ? req.query.paymentStatus : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
  });
  res.json({ success: true, ...result });
});

export const getOrderAdminHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid order ID.");
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!order) throw new ApiError(404, "Order not found.");
  res.json({ success: true, order });
});

export const updateOrderStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid order ID.");
  const admin = req.admin;
  if (!admin) throw new ApiError(401, "Unauthorized");
  const { status, note } = req.body ?? {};
  if (typeof status !== "string") throw new ApiError(400, "status required.");
  const order = await updateOrderStatusAdmin(id, admin.id, status, typeof note === "string" ? note : undefined);
  res.json({ success: true, order });
});
