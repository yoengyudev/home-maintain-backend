import { Router } from "express";
import {
    getServices,
    getRecommendedServices,
    getServiceById,
    getServiceAvailability,
} from "../../controllers/customer/customer.services.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";

const router = Router();

router.get("/", asyncHandler(getServices));
router.get("/recommended", asyncHandler(getRecommendedServices));
router.get("/:id/availability", asyncHandler(getServiceAvailability));
router.get("/:id", asyncHandler(getServiceById));

export default router;
