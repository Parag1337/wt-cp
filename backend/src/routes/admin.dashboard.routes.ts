import { Router } from "express";
import { dashboardSummaryHandler } from "../controllers/admin.dashboard.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

const router = Router();
router.use(authenticate, requireAdmin);
router.get("/summary", dashboardSummaryHandler);

export default router;
