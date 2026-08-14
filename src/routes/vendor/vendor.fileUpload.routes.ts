import { Router } from 'express';
import { VendorFileUploadController } from '../../controllers/vendor/vendor.fileUpload.controller';
import { authenticate } from '../../middlewares/auth.middlerware';
import { authorize } from '../../middlewares/role.middlerware';
import { asyncHandler } from '../../middlewares/async-handler.middlerware';
import { UserRole } from '../../generated/prisma/enums';

const router = Router();

// Upload single image
router.post(
  '/upload',
  authenticate,
  authorize(UserRole.PROVIDER),
  VendorFileUploadController.uploadSingle,
  asyncHandler(VendorFileUploadController.uploadImage)
);

// Delete image
router.delete(
  '/delete',
  authenticate,
  authorize(UserRole.PROVIDER),
  asyncHandler(VendorFileUploadController.deleteImage)
);

export default router;
