import { Router } from "express";
import { listNotifications } from "../../controllers/vendor/vendor.notifications.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";

const router = Router();

router.use(authenticate, authorize(UserRole.PROVIDER));

router.get("/", asyncHandler(listNotifications));

export default router;
