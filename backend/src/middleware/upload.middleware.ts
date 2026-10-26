import fs from "node:fs";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../config/env.js";

fs.mkdirSync(env.storage.uploadDir, { recursive: true });
import { ApiError } from "../utils/apiError.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.storage.uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (!env.storage.allowedMimeTypes.includes(file.mimetype)) {
    cb(new ApiError(400, "Unsupported file type."));
    return;
  }
  cb(null, true);
}

export const uploadProductImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.storage.maxFileSizeBytes },
}).single("image");
