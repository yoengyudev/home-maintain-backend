import { Router } from "express";
import { getHelp, submitSupportRequest } from "../../controllers/vendor/vendor.help.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { validate } from "../../validators/validate";
import { vendorSupportRequestSchema } from "../../validators/vendor/vendor.help.validator";
import { UserRole } from "../../generated/prisma/enums";

const router = Router();

router.use(authenticate, authorize(UserRole.PROVIDER));

router.get("/", asyncHandler(getHelp));
router.post("/tickets", validate(vendorSupportRequestSchema), asyncHandler(submitSupportRequest));

export default router;
