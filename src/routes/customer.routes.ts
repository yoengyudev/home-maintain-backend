import { Router } from "express";
import customerAuthRoutes from "./customer/customer.authentication.routes";
import customerCatalogRoutes from "./customer/customer.catalog.routes";
import customerProfileRoutes from "./customer/customer.profile.routes";

const router = Router();

router.use("/auth", customerAuthRoutes);
router.use("/profile", customerProfileRoutes);
router.use("", customerCatalogRoutes);

export default router;
