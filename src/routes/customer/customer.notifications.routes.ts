import { Router } from "express";
import {
    getUnreadNotificationCount,
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from "../../controllers/customer/customer.notifications.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";

const router = Router();

router.use(authenticate, authorize(UserRole.CUSTOMER));

router.get("/", asyncHandler(listNotifications));
router.get("/unread-count", asyncHandler(getUnreadNotificationCount));
router.post("/read-all", asyncHandler(markAllNotificationsRead));
router.post("/:publicId/read", asyncHandler(markNotificationRead));

export default router;
