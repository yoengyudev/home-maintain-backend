import { authenticate } from "../middlewares/auth.middlerware";
import { authorize } from "../middlewares/role.middlerware";
import { UserRole } from "../generated/prisma/enums";

export const isAdmin = [authenticate, authorize(UserRole.ADMIN)];

export const isVendor = [authenticate, authorize(UserRole.PROVIDER)];

export const isUser = [authenticate, authorize(UserRole.CUSTOMER)];