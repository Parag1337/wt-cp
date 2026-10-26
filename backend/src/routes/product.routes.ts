import { Router } from "express";
import * as productController from "../controllers/product.controller.js";

const router = Router();

router.get("/products", productController.getProducts);
router.get("/products/:id", productController.getProduct);

export default router;
