import type { Request, Response } from "express";
import { getDashboardSummary } from "../services/dashboard.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const dashboardSummaryHandler = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await getDashboardSummary();
  res.json({ success: true, summary });
});
