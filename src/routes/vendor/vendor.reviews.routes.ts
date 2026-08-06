import { Router } from "express";
import { getReviews, getReviewStats, getReviewById } from "../../controllers/vendor/vendor.reviews.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";

const router = Router();

// All review routes require authentication and provider role
router.get("/", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getReviews));
router.get("/stats", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getReviewStats));
router.get("/:id", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getReviewById));

export default router;
