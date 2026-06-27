import { Router } from "express";
import customerRoutes from "./customer.routes";
import adminRoutes from "./admin.routes";
import vendorRoutes from "./vendor.routes";

const route = Router();

route.use("/admin", adminRoutes);
route.use("/customer", customerRoutes);
route.use("/vendor", vendorRoutes);

export default route;