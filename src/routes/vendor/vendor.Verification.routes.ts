import { Router } from "express";
import { getDraft, saveDraft, submit, getStatus, updateForChanges, deleteDraft } from "../../controllers/vendor/vendor.Verification.controller";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";

const router = Router();

// All verification routes require authentication and provider role
router.get("/draft", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getDraft));
router.post("/draft", authenticate, authorize(UserRole.PROVIDER), asyncHandler(saveDraft));
router.post("/submit", authenticate, authorize(UserRole.PROVIDER), asyncHandler(submit));
router.get("/status", authenticate, authorize(UserRole.PROVIDER), asyncHandler(getStatus));
router.put("/update", authenticate, authorize(UserRole.PROVIDER), asyncHandler(updateForChanges));
router.delete("/draft", authenticate, authorize(UserRole.PROVIDER), asyncHandler(deleteDraft));

export default router;