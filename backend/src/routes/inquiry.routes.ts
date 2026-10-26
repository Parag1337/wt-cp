import { Router } from "express";
import * as inquiryController from "../controllers/inquiry.controller.js";

const router = Router();

router.post("/inquiries", inquiryController.submitInquiry);

export default router;
