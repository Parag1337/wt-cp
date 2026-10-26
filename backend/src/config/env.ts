import "dotenv/config";
import path from "node:path";

function required(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  database: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: required("DB_USER"),
    password: process.env.DB_PASSWORD ?? "",
    name: process.env.DB_NAME ?? "jay_hari_krushi",
  },
  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  },
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  authCookieName: "jh_auth",
  adminCookieName: "jh_admin",
  bcryptRounds: 12,
  adminBootstrap: {
    email: process.env.ADMIN_EMAIL?.trim() ?? "",
    password: process.env.ADMIN_PASSWORD ?? "",
    fullName: process.env.ADMIN_FULL_NAME?.trim() ?? "Administrator",
    phone: process.env.ADMIN_PHONE?.trim() ?? "",
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER ?? "local",
    // Canonical layout: UPLOAD_DIR is the static root served at `/uploads`;
    // product image files always live in its `products/` subfolder so the
    // public URL is `/uploads/products/<file>` for any deployment override.
    // (UPLOAD_DIR unset → <cwd>/uploads; persistent volumes set UPLOAD_DIR.)
    uploadDir: path.join(
      process.env.UPLOAD_DIR?.trim() ? path.resolve(process.env.UPLOAD_DIR.trim()) : path.join(process.cwd(), "uploads"),
      "products"
    ),
    staticRoot: process.env.UPLOAD_DIR?.trim()
      ? path.resolve(process.env.UPLOAD_DIR.trim())
      : path.join(process.cwd(), "uploads"),
    maxFileSizeBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024),
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
    authMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
    inquiryMax: Number(process.env.INQUIRY_RATE_LIMIT_MAX ?? 5),
  },
};

export const databaseUrl = `mysql://${encodeURIComponent(
  env.database.user
)}:${encodeURIComponent(env.database.password)}@${env.database.host}:${env.database.port}/${env.database.name}?connection_limit=5`;