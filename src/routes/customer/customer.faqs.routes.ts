import { Router } from "express";
import { listFaqs } from "../../controllers/customer/customer.faqs.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";

const router = Router();

router.get("/", asyncHandler(listFaqs));

export default router;
