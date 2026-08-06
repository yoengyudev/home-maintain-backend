import { Router } from "express";
import vendorAuthRoutes from "./vendor/vendor.authentication.routes";
import vendorVerificationRoutes from "./vendor/vendor.Verification.routes";
import vendorFileUploadRoutes from "./vendor/vendor.fileUpload.routes";
import vendorServiceRoutes from "./vendor/vendor.services.routes";
import vendorReviewsRoutes from "./vendor/vendor.reviews.routes";

const router = Router();

router.use("/auth", vendorAuthRoutes);
router.use("/verification", vendorVerificationRoutes);
router.use("/upload", vendorFileUploadRoutes);
router.use("/services", vendorServiceRoutes);
router.use("/reviews", vendorReviewsRoutes);

export default router;
