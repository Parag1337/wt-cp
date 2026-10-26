import type { Request, Response } from "express";
import { ZodError } from "zod";
import { inquirySchema } from "../schemas/product.schema.js";
import { createInquiry } from "../services/inquiry.service.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const submitInquiry = asyncHandler(
  async (req: Request, res: Response) => {
    const input = inquirySchema.parse(req.body);
    const result = await createInquiry(input);
    res.status(201).json(result);
  }
);

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
