import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import * as admin from "../controllers/admin.controller.js";
import { env } from "../config/env.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";
import { setAdminProductImage, getAdminProductImageValue } from "../services/admin-product.service.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

/** Uploads live on disk, never in MySQL. Path is overridable for deployment (UPLOAD_DIR). */
export const UPLOAD_DIR = env.storage.uploadDir;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXTENSIONS[file.mimetype] ?? ".bin"}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (EXTENSIONS[file.mimetype]) {
      cb(null, true);
      return;
    }
    cb(new ApiError(415, "Choose a JPG, PNG or WebP image."));
  },
});

/** Every admin endpoint requires a logged-in admin, verified against the database. */
router.use(authenticate, requireAdmin);

router.get("/dashboard", admin.dashboard);

router.get("/orders", admin.orders);
router.get("/orders/:id", admin.order);
router.post("/orders/:id/status", admin.updateOrderStatus);

router.get("/products", admin.products);
router.post("/products", admin.createProduct);
router.get("/products/:id", admin.product);
router.patch("/products/:id", admin.updateProduct);
router.post("/products/:id/archive", admin.archiveProduct);
router.post("/products/:id/restore", admin.restoreProduct);
router.post("/products/:id/stock", admin.adjustProductStock);
router.get("/products/:id/stock-adjustments", admin.stockAdjustments);

router.delete("/products/:id/image", admin.removeProductImage);
router.post(
  "/products/:id/image",
  (req, res, next) => {
    upload.single("image")(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(
          new ApiError(
            error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
            error.code === "LIMIT_FILE_SIZE"
              ? "Images must be 5 MB or smaller."
              : "That upload couldn't be read."
          )
        );
        return;
      }
      next(error);
    });
  },
  asyncHandler(async (req, res) => {
    const id = admin.parseId(req.params.id);
    const file = req.file;
    if (!file) throw new ApiError(400, "Choose an image to upload.");

    const previous = await getAdminProductImageValue(id);
    let product;
    try {
      product = await setAdminProductImage(id, `/uploads/products/${file.filename}`);
    } catch (error) {
      // Keep storage and the database in sync: drop the file if the row isn't saved.
      fs.rm(file.path, { force: true }, () => undefined);
      throw error;
    }

    // Best-effort cleanup of the previous local upload once the new one is saved.
    if (previous?.startsWith("/uploads/products/")) {
      const name = path.basename(previous);
      if (name && name !== file.filename) {
        fs.rm(path.join(UPLOAD_DIR, name), { force: true }, () => undefined);
      }
    }

    res.status(201).json({ success: true, product });
  })
);

router.get("/inventory", admin.inventory);

router.get("/inquiries", admin.inquiries);
router.patch("/inquiries/:id", admin.updateInquiry);

export default router;
