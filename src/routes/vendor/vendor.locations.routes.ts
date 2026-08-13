import { Router } from "express";
import { getLocations } from "../../controllers/vendor/vendor.locations.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";

const router = Router();

router.get("/", asyncHandler(getLocations));

export default router;
