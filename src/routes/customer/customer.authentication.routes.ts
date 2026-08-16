import { Router } from "express";
import {
    register,
    verifyRegisterOtp,
    resendRegisterOtp,
    forgotPassword,
    verifyForgotPasswordOtp,
    resendForgotPasswordOtp,
    resetPassword,
    changePassword,
    deleteAccount,
    login,
    loginWithGoogle,
    loginWithTelegramWidget,
    initTelegramAuth,
    checkTelegramAuth,
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
    customerChangePasswordSchema,
    customerLoginSchema,
    customerGoogleAuthSchema,
    customerTelegramWidgetAuthSchema,
    customerTelegramAuthInitSchema,
    customerTelegramAuthCheckSchema,
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
router.post("/google", validate(customerGoogleAuthSchema), asyncHandler(loginWithGoogle));
router.post("/telegram/widget", validate(customerTelegramWidgetAuthSchema), asyncHandler(loginWithTelegramWidget));
router.post("/telegram/init", validate(customerTelegramAuthInitSchema), asyncHandler(initTelegramAuth));
router.get("/telegram/check", validate(customerTelegramAuthCheckSchema), asyncHandler(checkTelegramAuth));
router.post("/telegram/check", validate(customerTelegramAuthCheckSchema), asyncHandler(checkTelegramAuth));
router.post("/logout", authenticate, authorize(UserRole.CUSTOMER), asyncHandler(logout));
router.post(
    "/change-password",
    authenticate,
    authorize(UserRole.CUSTOMER),
    validate(customerChangePasswordSchema),
    asyncHandler(changePassword)
);
router.delete("/account", authenticate, authorize(UserRole.CUSTOMER), asyncHandler(deleteAccount));

export default router;
