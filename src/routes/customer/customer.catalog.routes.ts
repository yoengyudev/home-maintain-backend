import { Router } from "express";
import {
    getProviderById,
    getServiceById,
    getServiceCategoryById,
    listProviders,
    listRecommendedProviders,
    listRecommendedServices,
    listServiceCategories,
    listServices,
} from "../../controllers/customer/customer.catalog.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";

const router = Router();

router.get("/service-categories", asyncHandler(listServiceCategories));
router.get("/service-categories/:id", asyncHandler(getServiceCategoryById));
router.get("/services", asyncHandler(listServices));
router.get("/services/:id", asyncHandler(getServiceById));
router.get("/services/recommended", asyncHandler(listRecommendedServices));
router.get("/providers", asyncHandler(listProviders));
router.get("/providers/:id", asyncHandler(getProviderById));
router.get("/providers/recommended", asyncHandler(listRecommendedProviders));

export default router;
