import type { Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/client/client.js";
import { loginSchema, registerSchema, changePasswordSchema } from "../schemas/auth.schema.js";
import {
  loginCustomer,
  registerCustomer,
  changePassword as changeCustomerPassword,
} from "../services/auth.service.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clearAuthCookie, setAuthCookie } from "../utils/cookies.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const { customer, token } = await registerCustomer(input);
  setAuthCookie(res, token);

  res.status(201).json({
    success: true,
    message: "Account created successfully",
    customer,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const { customer, token } = await loginCustomer(input);
  setAuthCookie(res, token);

  res.json({
    success: true,
    message: "Login successful",
    customer,
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    customer: req.customer,
  });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");

  const input = changePasswordSchema.parse(req.body);
  await changeCustomerPassword(customer.id, input.currentPassword, input.newPassword);

  res.json({
    success: true,
    message: "Password updated successfully",
  });
});

export function isPrismaKnownRequestError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return first?.message ?? "Please check your input and try again.";
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
};