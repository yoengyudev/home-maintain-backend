import { Router } from "express";
import {
    createAddress,
    deleteAddress,
    listAddresses,
    updateAddress,
} from "../../controllers/customer/customer.addresses.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";
import { validate } from "../../validators/validate";
import {
    customerCreateAddressSchema,
    customerUpdateAddressSchema,
} from "../../validators/customer/address.validator";

const router = Router();

router.use(authenticate, authorize(UserRole.CUSTOMER));

router.get("/", asyncHandler(listAddresses));
router.post("/", validate(customerCreateAddressSchema), asyncHandler(createAddress));
router.patch("/:publicId", validate(customerUpdateAddressSchema), asyncHandler(updateAddress));
router.delete("/:publicId", asyncHandler(deleteAddress));

export default router;
