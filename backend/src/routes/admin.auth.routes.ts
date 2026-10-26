import { Router } from "express";
import * as adminAuthController from "../controllers/admin.auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";
import { env } from "../config/env.js";

const router = Router();

router.post(
  "/login",
  rateLimit(env.rateLimit.authMax, env.rateLimit.windowMs),
  adminAuthController.adminLogin
);
router.post("/logout", adminAuthController.adminLogout);
router.get("/me", authenticate, requireAdmin, adminAuthController.adminMe);

export default router;
