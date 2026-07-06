import { Router } from "express";
import { register, login, logout, me, forgotPassword, resetPassword } from "../controllers/vendor/vendor.authentication.controller";
import { asyncHandler } from "../middlewares/async-handler.middlerware";
import { validate } from "../validators/validate";
import { vendorRegisterSchema, vendorLoginSchema, forgotPasswordSchema, resetPasswordSchema } from "../validators/vendor/vendor.auth.validator";
import { authenticate } from "../middlewares/auth.middlerware";
import { authorize } from "../middlewares/role.middlerware";
import { UserRole } from "../generated/prisma/enums";

const router = Router();

const authRouter = Router();

authRouter.post("/register", validate(vendorRegisterSchema), asyncHandler(register));
authRouter.post("/login", validate(vendorLoginSchema), asyncHandler(login));
authRouter.post("/forgot-password", validate(forgotPasswordSchema), asyncHandler(forgotPassword));
authRouter.post("/reset-password", validate(resetPasswordSchema), asyncHandler(resetPassword));
authRouter.post("/logout", authenticate, authorize(UserRole.PROVIDER), asyncHandler(logout));
authRouter.get("/me", authenticate, authorize(UserRole.PROVIDER), asyncHandler(me));

router.use("/auth", authRouter);

export default router;