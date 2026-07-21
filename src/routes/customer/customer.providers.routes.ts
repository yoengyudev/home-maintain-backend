import { Router } from "express";
import {
    getProviders,
    getRecommendedProviders,
    getProviderById,
} from "../../controllers/customer/customer.providers.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";

const router = Router();

router.get("/", asyncHandler(getProviders));
router.get("/recommended", asyncHandler(getRecommendedProviders));
router.get("/:id", asyncHandler(getProviderById));

export default router;
