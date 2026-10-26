import { Router } from "express";
import * as c from "../controllers/admin.order.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

const router = Router();
router.use(authenticate, requireAdmin);

router.get("/", c.listOrdersAdminHandler);
router.get("/:id", c.getOrderAdminHandler);
router.patch("/:id/status", c.updateOrderStatusHandler);

export default router;
