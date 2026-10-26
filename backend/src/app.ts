import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import {
  errorHandler,
  notFound,
} from "./middleware/error.middleware.js";
import authRouter from "./routes/auth.routes.js";
import productRouter from "./routes/product.routes.js";
import inquiryRouter from "./routes/inquiry.routes.js";
import cartRouter from "./routes/cart.routes.js";
import addressRouter from "./routes/address.routes.js";
import orderRouter from "./routes/order.routes.js";
import adminRouter from "./routes/admin.routes.js";
import paymentRouter from "./routes/payment.routes.js";

export const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true,
  })
);

// Webhook endpoint needs the raw body for HMAC verification; mount before JSON parser.
app.use("/api/payments", paymentRouter);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.use("/uploads", express.static(env.storage.staticRoot));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "OK" });
});

app.use("/api/auth", authRouter);
app.use("/api", productRouter);
app.use("/api", inquiryRouter);
app.use("/api/cart", cartRouter);
app.use("/api/addresses", addressRouter);
app.use("/api/orders", orderRouter);

app.use("/api/admin", adminRouter);

app.use(notFound);
app.use(errorHandler);
