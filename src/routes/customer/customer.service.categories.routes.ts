import { Router } from "express";
import {
    getCategories,
    getCategoryBySlug,
} from "../../controllers/customer/customer.service.categories.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";

const router = Router();

router.get("/", asyncHandler(getCategories));
router.get("/:slug", asyncHandler(getCategoryBySlug));

export default router;
