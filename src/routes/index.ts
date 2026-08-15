import { Router } from "express";
import customerRoutes from "./customer.routes";
import adminRoutes from "./admin.routes";
import vendorRoutes from "./vendor.routes";
import telegramRoutes from "./telegram/telegram.routes";

const route = Router();

route.use("/admin", adminRoutes);
route.use("/customer", customerRoutes);
route.use("/vendor", vendorRoutes);
route.use("/telegram", telegramRoutes);
route.use("/me/telegram", telegramRoutes);

export default route;