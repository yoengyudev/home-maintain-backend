import { Router } from "express";
import {
    getProfile,
    getProfileStats,
    updateProfile,
    requestPhoneChangeOtp,
    resendPhoneChangeOtp,
    verifyPhoneChangeOtp,
} from "../../controllers/customer/customer.profile.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";
import { validate } from "../../validators/validate";
import {
    customerUpdateProfileSchema,
    customerRequestPhoneChangeOtpSchema,
    customerResendPhoneChangeOtpSchema,
    customerVerifyPhoneChangeOtpSchema,
} from "../../validators/customer/profile.validator";
import { uploadImage } from "../../utils/upload-image.util";

const router = Router();

router.get("/stats", authenticate, authorize(UserRole.CUSTOMER), asyncHandler(getProfileStats));
router.get("/", authenticate, authorize(UserRole.CUSTOMER), asyncHandler(getProfile));
router.patch(
    "/",
    authenticate,
    authorize(UserRole.CUSTOMER),
    uploadImage.fields([
        { name: "avatar", maxCount: 1 },
        { name: "avatarUrl", maxCount: 1 },
    ]),
    validate(customerUpdateProfileSchema),
    asyncHandler(updateProfile)
);

router.post(
    "/phone/request-otp",
    authenticate,
    authorize(UserRole.CUSTOMER),
    validate(customerRequestPhoneChangeOtpSchema),
    asyncHandler(requestPhoneChangeOtp)
);

router.post(
    "/phone/resend-otp",
    authenticate,
    authorize(UserRole.CUSTOMER),
    validate(customerResendPhoneChangeOtpSchema),
    asyncHandler(resendPhoneChangeOtp)
);

router.post(
    "/phone/verify-otp",
    authenticate,
    authorize(UserRole.CUSTOMER),
    validate(customerVerifyPhoneChangeOtpSchema),
    asyncHandler(verifyPhoneChangeOtp)
);

export default router;

