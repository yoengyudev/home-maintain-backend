import { Router } from "express";
import {
    getServices,
    getServiceById,
    createService,
    updateService,
    deleteService,
    toggleServiceStatus,
    getServiceCategories,
    getServiceAreas
} from "../../controllers/vendor/vendor.services.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";

const router = Router();

// Public endpoints for reference data
router.get("/categories", asyncHandler(getServiceCategories));
router.get("/areas", asyncHandler(getServiceAreas));

// Service management routes require authentication and provider role
router.get("/", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getServices));
router.get("/:id", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getServiceById));
router.post("/", authenticate, authorize(UserRole.PROVIDER), asyncHandler(createService));
router.put("/:id", authenticate, authorize(UserRole.PROVIDER), asyncHandler(updateService));
router.delete("/:id", authenticate, authorize(UserRole.PROVIDER), asyncHandler(deleteService));
router.patch("/:id/toggle", authenticate, authorize(UserRole.PROVIDER), asyncHandler(toggleServiceStatus));

export default router;