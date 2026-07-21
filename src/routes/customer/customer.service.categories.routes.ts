import { Router } from "express";
import {
    getCategories,
    getCategoryById,
} from "../../controllers/customer/customer.service.categories.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";

const router = Router();

router.get("/", asyncHandler(getCategories));
router.get("/:id", asyncHandler(getCategoryById));

export default router;
