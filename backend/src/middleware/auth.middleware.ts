import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { getCustomerById } from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError, UnauthorizedError } from "../utils/apiError.js";

export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[env.authCookieName] as string | undefined;

    if (!token) {
      throw new UnauthorizedError();
    }

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.jwt.secret) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedError();
    }

    if (!payload.sub || typeof payload.sub !== "string") {
      throw new UnauthorizedError();
    }

    req.customer = await getCustomerById(Number(payload.sub));
    next();
  }
);

/**
 * Requires an authenticated admin. The role is read from the database on every
 * request (never from the JWT) so demoting an owner takes effect immediately.
 */
export const requireAdmin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const customer = req.customer;
    if (!customer) throw new UnauthorizedError();

    const record = await prisma.customer.findUnique({
      where: { id: customer.id },
      select: { role: true },
    });

    if (record?.role !== "ADMIN") {
      throw new ApiError(403, "This account doesn't have access to the owner dashboard.");
    }

    next();
  }
);
