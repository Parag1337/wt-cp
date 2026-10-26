import express from "express";
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  WEBHOOK_RAW_BODY_LIMIT,
  isWebhookVerificationEnabled,
  processRazorpayWebhook,
} from "../services/webhook.service.js";

const router = Router();

/**
 * Razorpay delivery endpoint. Unauthenticated by design — the HMAC over the
 * raw body is the authentication. This router mounts before the global
 * express.json parser in app.ts; its route-scoped express.raw captures the
 * exact bytes Razorpay signed. A body larger than 256kb is rejected by the
 * parser before any signature or database work happens.
 */
router.post(
  "/razorpay/webhook",
  express.raw({ type: "*/*", limit: WEBHOOK_RAW_BODY_LIMIT }),
  asyncHandler(async (req, res) => {
    // Fail-closed: without a configured webhook secret the endpoint accepts
    // nothing, even if a signature happened to be present.
    if (!isWebhookVerificationEnabled()) {
      res.status(503).json({
        success: false,
        message: "Webhook processing is not configured for this environment.",
      });
      return;
    }

    const rawBody = req.body instanceof Buffer ? req.body : Buffer.alloc(0);
    const result = await processRazorpayWebhook(
      rawBody,
      req.get("x-razorpay-signature"),
      req.get("x-razorpay-event-id")
    );
    res.status(200).json({ success: true, ...result });
  })
);

export default router;
