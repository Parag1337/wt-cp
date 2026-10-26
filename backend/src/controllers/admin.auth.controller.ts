import type { Request, Response } from "express";
import { loginSchema } from "../schemas/auth.schema.js";
import { loginAdmin } from "../services/auth.service.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clearAuthCookie, setAuthCookie } from "../utils/cookies.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const { customer, token } = await loginAdmin(input);
  setAuthCookie(res, token);
  res.json({ success: true, message: "Admin login successful", admin: customer });
});

export const adminMe = asyncHandler(async (req: Request, res: Response) => {
  const admin = req.admin ?? req.customer;
  if (!admin || admin.role !== "ADMIN") throw new ApiError(401, "Unauthorized");
  res.json({ success: true, admin });
});

export const adminLogout = asyncHandler(async (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ success: true, message: "Logged out successfully" });
});
