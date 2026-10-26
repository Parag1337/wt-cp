import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";
import { env } from "../config/env.js";

const router = Router();

// Customer credential endpoints are abusive-drinker magnets (credential
// stuffing, bulk account creation). Same knobs as the admin console:
// AUTH_RATE_LIMIT_MAX attempts per RATE_LIMIT_WINDOW_MS (15 min) per IP per
// path. Logout/GET/PATCH endpoints stay unlimited (they're post-auth).
router.post("/register", rateLimit(env.rateLimit.authMax, env.rateLimit.windowMs), authController.register);
router.post("/login", rateLimit(env.rateLimit.authMax, env.rateLimit.windowMs), authController.login);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);
router.patch("/password", authenticate, authController.changePassword);

export default router;