import { Router } from "express";
import {
    getAboutPage,
    getMissionPage,
} from "../../controllers/customer/customer.support.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";

const router = Router();

router.get("/about", asyncHandler(getAboutPage));
router.get("/mission", asyncHandler(getMissionPage));

export default router;
