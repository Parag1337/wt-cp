import { Router } from "express";
import * as c from "../controllers/admin.product.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { uploadProductImage } from "../middleware/upload.middleware.js";

const router = Router();
router.use(authenticate, requireAdmin);

router.get("/", c.listProductsAdminHandler);
router.get("/:id", c.getProductAdminHandler);
router.post("/", c.createProductHandler);
router.patch("/:id", c.updateProductHandler);
router.patch("/:id/price", c.updatePriceHandler);
router.patch("/:id/availability", c.updateAvailabilityHandler);
router.post("/:id/archive", c.archiveProductHandler);
router.post("/:id/adjust-stock", c.adjustStockHandler);
router.post("/:id/image", uploadProductImage, c.uploadImageHandler);

export default router;
