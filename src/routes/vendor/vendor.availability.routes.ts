import { Router } from "express";
import {
    getAvailability,
    updateAvailability
} from "../../controllers/vendor/vendor.availability.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";

const router = Router();

// All availability routes require authentication and provider role
router.get("/", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getAvailability));
router.put("/", authenticate, authorize(UserRole.PROVIDER), asyncHandler(updateAvailability));

export default router;
