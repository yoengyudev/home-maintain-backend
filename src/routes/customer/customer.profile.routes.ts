import { Router } from "express";
import { getProfile, getProfileStats, updateProfile } from "../../controllers/customer/customer.profile.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";
import { validate } from "../../validators/validate";
import { customerUpdateProfileSchema } from "../../validators/customer/profile.validator";
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

export default router;
