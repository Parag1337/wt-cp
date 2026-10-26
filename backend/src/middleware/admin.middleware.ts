import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { UnauthorizedError, ApiError } from "../utils/apiError.js";
import { authenticate } from "./auth.middleware.js";

export const requireAdmin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.customer) {
      throw new UnauthorizedError();
    }
    if (req.customer.role !== "ADMIN") {
      throw new ApiError(403, "Forbidden");
    }
    req.admin = req.customer;
    next();
  }
);

export const authenticateAdmin = [authenticate, requireAdmin];
