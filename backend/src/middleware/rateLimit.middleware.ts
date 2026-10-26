import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError.js";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(max: number, windowMs: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = `${req.ip ?? "unknown"}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (bucket.count >= max) {
      throw new ApiError(429, "Too many requests. Please try again later.");
    }
    bucket.count += 1;
    next();
  };
}
