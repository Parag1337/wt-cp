import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/client/client.js";
import { ApiError } from "../utils/apiError.js";

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: error.issues[0]?.message ?? "Invalid input.",
    });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  // body-parser entity-size rejections (e.g. webhook body above the raw-body
  // limit): a concrete, safe 413 instead of a generic 500.
  if (
    error &&
    typeof error === "object" &&
    "type" in error &&
    (error as { type?: unknown }).type === "entity.too.large"
  ) {
    res.status(413).json({
      success: false,
      message: "Request body is too large.",
    });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = error.meta?.target as string[] | undefined;
    const field = target?.[0];
    res.status(409).json({
      success: false,
      message:
        field === "email"
          ? "An account with this email already exists."
          : "An account with this phone number already exists.",
    });
    return;
  }

  console.error("[unhandled-error]", error);
  res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again.",
  });
}