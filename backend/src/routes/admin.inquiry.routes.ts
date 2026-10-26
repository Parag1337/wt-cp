import { Router } from "express";
import * as c from "../controllers/admin.inquiry.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

const router = Router();
router.use(authenticate, requireAdmin);

router.get("/", c.listInquiriesAdminHandler);
router.get("/:id", c.getInquiryAdminHandler);
router.patch("/:id", c.updateInquiryAdminHandler);

export default router;
