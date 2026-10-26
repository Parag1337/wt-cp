import { Router } from "express";
import * as cartController from "../controllers/cart.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", cartController.getCartHandler);
router.post("/items", cartController.addToCartHandler);
router.put("/items/:id", cartController.updateCartItemHandler);
router.delete("/items/:id", cartController.removeCartItemHandler);
router.delete("/", cartController.clearCartHandler);

export default router;
