import { Router } from "express";
import customerAuthRoutes from "./customer/customer.authentication.routes";
import customerProfileRoutes from "./customer/customer.profile.routes";
import customerServiceCategoriesRoutes from "./customer/customer.service.categories.routes";
import customerServicesRoutes from "./customer/customer.services.routes";
import customerProvidersRoutes from "./customer/customer.providers.routes";
import customerAddressesRoutes from "./customer/customer.addresses.routes";
import customerBookingsRoutes from "./customer/customer.bookings.routes";
import customerNotificationsRoutes from "./customer/customer.notifications.routes";
import customerFaqsRoutes from "./customer/customer.faqs.routes";
import customerSupportRoutes from "./customer/customer.support.routes";

const router = Router();

router.use("/auth", customerAuthRoutes);
router.use("/profile", customerProfileRoutes);
router.use("/service-categories", customerServiceCategoriesRoutes);
router.use("/services", customerServicesRoutes);
router.use("/providers", customerProvidersRoutes);
router.use("/addresses", customerAddressesRoutes);
router.use("/bookings", customerBookingsRoutes);
router.use("/notifications", customerNotificationsRoutes);
router.use("/faqs", customerFaqsRoutes);
router.use("/support", customerSupportRoutes);

export default router;
