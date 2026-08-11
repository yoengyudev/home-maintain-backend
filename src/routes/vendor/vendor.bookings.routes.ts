import { Router } from "express";
import {
    acceptBooking,
    completeBooking,
    getBookingById,
    listBookings,
    rejectBooking,
    startBooking,
} from "../../controllers/vendor/vendor.bookings.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";

const router = Router();

router.use(authenticate, authorize(UserRole.PROVIDER));

router.get("/", asyncHandler(listBookings));
router.post("/:id/accept", asyncHandler(acceptBooking));
router.post("/:id/reject", asyncHandler(rejectBooking));
router.post("/:id/start", asyncHandler(startBooking));
router.post("/:id/complete", asyncHandler(completeBooking));
router.get("/:id", asyncHandler(getBookingById));

export default router;
