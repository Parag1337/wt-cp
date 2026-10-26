import { Router } from "express";
import * as addressController from "../controllers/address.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

router.get("/", addressController.listAddressesHandler);
router.post("/", addressController.createAddressHandler);
router.get("/:id", addressController.getAddressHandler);
router.put("/:id", addressController.updateAddressHandler);
router.delete("/:id", addressController.deleteAddressHandler);
router.post("/:id/default", addressController.setDefaultAddressHandler);

export default router;