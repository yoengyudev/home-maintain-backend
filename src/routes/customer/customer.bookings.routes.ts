import { Router } from "express";
import {
    cancelBooking,
    createBooking,
    getBookingByPublicId,
    listBookings,
    rescheduleBooking,
} from "../../controllers/customer/customer.bookings.controller";
import {
    createBookingReview,
    getBookingReview,
} from "../../controllers/customer/customer.reviews.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";
import { validate } from "../../validators/validate";
import {
    customerCancelBookingSchema,
    customerCreateBookingSchema,
    customerRescheduleBookingSchema,
} from "../../validators/customer/booking.validator";
import { customerCreateReviewSchema } from "../../validators/customer/review.validator";

const router = Router();

router.use(authenticate, authorize(UserRole.CUSTOMER));

router.get("/", asyncHandler(listBookings));
router.post("/", validate(customerCreateBookingSchema), asyncHandler(createBooking));
router.get("/:publicId", asyncHandler(getBookingByPublicId));
router.post(
    "/:publicId/cancel",
    validate(customerCancelBookingSchema),
    asyncHandler(cancelBooking)
);
router.post(
    "/:publicId/reschedule",
    validate(customerRescheduleBookingSchema),
    asyncHandler(rescheduleBooking)
);
router.get("/:publicId/review", asyncHandler(getBookingReview));
router.post(
    "/:publicId/reviews",
    validate(customerCreateReviewSchema),
    asyncHandler(createBookingReview)
);

export default router;
