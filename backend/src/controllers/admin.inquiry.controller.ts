import type { Request, Response } from "express";
import { listInquiriesAdmin, getInquiryAdmin, updateInquiryAdmin } from "../services/inquiry.service.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listInquiriesAdminHandler = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const result = await listInquiriesAdmin({
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
  });
  res.json({ success: true, ...result });
});

export const getInquiryAdminHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid inquiry ID.");
  const inquiry = await getInquiryAdmin(id);
  if (!inquiry) throw new ApiError(404, "Inquiry not found.");
  res.json({ success: true, inquiry });
});

export const updateInquiryAdminHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid inquiry ID.");
  const { status, internalNotes } = req.body ?? {};
  const inquiry = await updateInquiryAdmin(id, {
    status: typeof status === "string" ? status : undefined,
    internalNotes: typeof internalNotes === "string" ? internalNotes : undefined,
  });
  res.json({ success: true, inquiry });
});
