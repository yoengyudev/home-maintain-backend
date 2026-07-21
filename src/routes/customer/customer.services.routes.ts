import { Router } from "express";
import {
    getServices,
    getRecommendedServices,
    getServiceByPublicId,
} from "../../controllers/customer/customer.services.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";

const router = Router();

router.get("/", asyncHandler(getServices));
router.get("/recommended", asyncHandler(getRecommendedServices));
router.get("/:publicId", asyncHandler(getServiceByPublicId));

export default router;
