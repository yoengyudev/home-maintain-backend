import { Router } from "express";
import vendorAuthRoutes from "./vendor/vendor.authentication.routes";
import vendorVerificationRoutes from "./vendor/vendor.Verification.routes";
import vendorFileUploadRoutes from "./vendor/vendor.fileUpload.routes";
import vendorServiceRoutes from "./vendor/vendor.services.routes";
import vendorReviewsRoutes from "./vendor/vendor.reviews.routes";
import vendorAvailabilityRoutes from "./vendor/vendor.availability.routes";
import vendorBookingsRoutes from "./vendor/vendor.bookings.routes";
import vendorNotificationsRoutes from "./vendor/vendor.notifications.routes";
import vendorHelpRoutes from "./vendor/vendor.help.routes";
import vendorLocationsRoutes from "./vendor/vendor.locations.routes";
import vendorCommissionRoutes from "./vendor/vendor.commission.routes";
import {
    acceptBooking,
    completeBooking,
    rejectBooking,
    startBooking,
} from "../controllers/vendor/vendor.bookings.controller";
import { asyncHandler } from "../middlewares/async-handler.middlerware";
import { authenticate } from "../middlewares/auth.middlerware";
import { authorize } from "../middlewares/role.middlerware";
import { UserRole } from "../generated/prisma/enums";

const router = Router();

router.use("/auth", vendorAuthRoutes);
router.use("/verification", vendorVerificationRoutes);
router.use("/upload", vendorFileUploadRoutes);
router.use("/services", vendorServiceRoutes);
router.use("/reviews", vendorReviewsRoutes);
router.use("/availability", vendorAvailabilityRoutes);
router.post("/bookings/:id/accept", authenticate, authorize(UserRole.PROVIDER), asyncHandler(acceptBooking));
router.post("/bookings/:id/reject", authenticate, authorize(UserRole.PROVIDER), asyncHandler(rejectBooking));
router.post("/bookings/:id/start", authenticate, authorize(UserRole.PROVIDER), asyncHandler(startBooking));
router.post("/bookings/:id/complete", authenticate, authorize(UserRole.PROVIDER), asyncHandler(completeBooking));
router.use("/bookings", vendorBookingsRoutes);
router.use("/commission", vendorCommissionRoutes);
router.use("/notifications", vendorNotificationsRoutes);
router.use("/help", vendorHelpRoutes);
router.use("/locations", vendorLocationsRoutes);

export default router;
