import { Router } from "express";
import {
    getProviders,
    getRecommendedProviders,
    getProviderByPublicId,
} from "../../controllers/customer/customer.providers.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";

const router = Router();

router.get("/", asyncHandler(getProviders));
router.get("/recommended", asyncHandler(getRecommendedProviders));
router.get("/:publicId", asyncHandler(getProviderByPublicId));

export default router;
