import { Router } from "express";
import { register, login, forgotPassword, resetPassword, logout, me, getProfile, updateProfile, updateAvailability } from "../../controllers/vendor/vendor.authentication.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { validate } from "../../validators/validate";
import { vendorRegisterSchema, vendorLoginSchema, forgotPasswordSchema, resetPasswordSchema } from "../../validators/vendor/vendor.auth.validator";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";

const router = Router();

router.post("/register", validate(vendorRegisterSchema), asyncHandler(register));
router.post("/login", validate(vendorLoginSchema), asyncHandler(login));
router.post("/forgot-password", validate(forgotPasswordSchema), asyncHandler(forgotPassword));
router.post("/reset-password", validate(resetPasswordSchema), asyncHandler(resetPassword));
router.post("/logout", authenticate, authorize(UserRole.PROVIDER), asyncHandler(logout));
router.get("/me", authenticate, authorize(UserRole.PROVIDER), asyncHandler(me));
router.get("/profile", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getProfile));
router.put("/profile", authenticate, authorize(UserRole.PROVIDER), asyncHandler(updateProfile));
router.put("/availability", authenticate, authorize(UserRole.PROVIDER), asyncHandler(updateAvailability));

export default router;
