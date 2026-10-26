import { Router } from "express";
import * as inquiryController from "../controllers/inquiry.controller.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";
import { env } from "../config/env.js";

const router = Router();

// Public, unauthenticated write surface: 5 submissions per IP within the rate
// limit window (INQUIRY_RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS, default 15
// minutes) blocks bulk spam while a farmer retrying a failed form gets several
// honest attempts.
router.post(
  "/inquiries",
  rateLimit(env.rateLimit.inquiryMax, env.rateLimit.windowMs),
  inquiryController.submitInquiry
);

export default router;
