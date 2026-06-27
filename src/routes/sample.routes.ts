import { Router } from "express";
import {
    getSampleByIdPublicController,
    getSamplesPublicController,
} from "../controllers/sample/sample-public.controller";
import {
    createSampleController,
    deleteSampleController,
    getSampleByIdController,
    getSamplesController,
    updateSampleController,
} from "../controllers/sample/sample-private.controller";
import { authenticate } from "../middlewares/auth.middlerware";
import { authorize } from "../middlewares/role.middlerware";
import { uploadImage } from "../utils/upload-image.util";

const router = Router();

// Public routes (no token required)
router.get("/public", getSamplesPublicController);
router.get("/public/:id", getSampleByIdPublicController);

// Private routes (admin only)
// Use authenticate and authorize middleware to protect the routes and allow specifig role to access the routes
// Use uploadImage.single("image") for function that need to upload image only once per record
router.get("/", authenticate, authorize("ADMIN"), getSamplesController);
router.get("/:id", authenticate, authorize("ADMIN"), getSampleByIdController);
router.post("/", uploadImage.single("image"), authenticate, authorize("ADMIN"), createSampleController);
router.patch("/:id", uploadImage.single("image"), authenticate, authorize("ADMIN"), updateSampleController);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteSampleController);

export default router;
