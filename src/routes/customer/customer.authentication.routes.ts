import { Router } from "express";
import {
    register,
    verifyRegisterOtp,
    resendRegisterOtp,
    forgotPassword,
    verifyForgotPasswordOtp,
    resendForgotPasswordOtp,
    resetPassword,
    login,
    logout,
} from "../../controllers/customer/customer.authentication.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { validate } from "../../validators/validate";
import {
    customerRegisterSchema,
    customerVerifyRegisterOtpSchema,
    customerResendRegisterOtpSchema,
    customerForgotPasswordSchema,
    customerVerifyForgotPasswordOtpSchema,
    customerResendForgotPasswordOtpSchema,
    customerResetPasswordSchema,
    customerLoginSchema,
} from "../../validators/customer/auth.validator";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";

const router = Router();

router.post("/register", validate(customerRegisterSchema), asyncHandler(register));
router.post("/register/verify-otp", validate(customerVerifyRegisterOtpSchema), asyncHandler(verifyRegisterOtp));
router.post("/register/resend-otp", validate(customerResendRegisterOtpSchema), asyncHandler(resendRegisterOtp));

router.post("/forgot-password", validate(customerForgotPasswordSchema), asyncHandler(forgotPassword));
router.post("/forgot-password/verify-otp", validate(customerVerifyForgotPasswordOtpSchema), asyncHandler(verifyForgotPasswordOtp));
router.post("/forgot-password/resend-otp", validate(customerResendForgotPasswordOtpSchema), asyncHandler(resendForgotPasswordOtp));
router.post("/forgot-password/reset", validate(customerResetPasswordSchema), asyncHandler(resetPassword));

router.post("/login", validate(customerLoginSchema), asyncHandler(login));
router.post("/logout", authenticate, authorize(UserRole.CUSTOMER), asyncHandler(logout));

export default router;
