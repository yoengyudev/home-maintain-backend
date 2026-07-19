import { Router } from "express";
import customerAuthRoutes from "./customer/customer.authentication.routes";
import customerProfileRoutes from "./customer/customer.profile.routes";

const router = Router();

router.use("/auth", customerAuthRoutes);
router.use("/profile", customerProfileRoutes);

export default router;
