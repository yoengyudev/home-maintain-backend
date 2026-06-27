import { authenticate } from "../middlewares/auth.middlerware";
import { authorize } from "../middlewares/role.middlerware";

export const isAdmin = [authenticate, authorize("ADMIN")];

export const isVendor = [authenticate, authorize("VENDOR")];

export const isUser = [authenticate, authorize("USER")];