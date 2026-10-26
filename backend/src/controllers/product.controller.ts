import type { Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/client/client.js";
import { searchParamsSchema } from "../schemas/product.schema.js";
import { listProducts, getProductById } from "../services/product.service.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const params = {
    q: typeof req.query.q === "string" ? req.query.q : undefined,
    category:
      typeof req.query.category === "string" ? req.query.category : undefined,
  };

  const parsed = searchParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new ZodError(parsed.error.issues);
  }

  const result = await listProducts(parsed.data);
  res.json({
    success: true,
    ...result,
  });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    throw new ApiError(400, "Invalid product ID.");
  }

  const product = await getProductById(id);
  if (!product) {
    throw new ApiError(404, "Product not found.");
  }

  res.json({ success: true, product });
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
