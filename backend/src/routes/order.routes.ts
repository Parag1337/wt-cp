import { Router } from "express";
import * as orderController from "../controllers/order.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", orderController.getOrders);
router.post("/", orderController.createOrder);
router.post("/:id/verify-payment", orderController.verifyPayment);
router.post("/:id/retry-payment", orderController.retryPayment);
router.get("/:id", orderController.getOrder);

export default router;
