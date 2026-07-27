import { Router } from "express";
import vendorAuthRoutes from "./vendor/vendor.authentication.routes";
import vendorVerificationRoutes from "./vendor/vendor.Verification.routes";
import vendorFileUploadRoutes from "./vendor/vendor.fileUpload.routes";

const router = Router();

router.use("/auth", vendorAuthRoutes);
router.use("/verification", vendorVerificationRoutes);
router.use("/upload", vendorFileUploadRoutes);

export default router;
