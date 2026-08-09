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
} from "../../controllers/vendor/vendor.service.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";

const router = Router();

// All service routes require authentication and provider role
router.get("/", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getServices));
router.get("/categories", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getServiceCategories));
router.get("/areas", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getServiceAreas));
router.get("/:id", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getServiceById));
router.post("/", authenticate, authorize(UserRole.PROVIDER), asyncHandler(createService));
router.put("/:id", authenticate, authorize(UserRole.PROVIDER), asyncHandler(updateService));
router.delete("/:id", authenticate, authorize(UserRole.PROVIDER), asyncHandler(deleteService));
router.patch("/:id/toggle", authenticate, authorize(UserRole.PROVIDER), asyncHandler(toggleServiceStatus));

export default router;
