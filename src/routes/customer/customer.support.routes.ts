import { Router } from "express";
import {
    getAboutPage,
    getMissionPage,
    getContactPage,
} from "../../controllers/customer/customer.support.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";

const router = Router();

router.get("/about", asyncHandler(getAboutPage));
router.get("/mission", asyncHandler(getMissionPage));
router.get("/contact", asyncHandler(getContactPage));

export default router;
