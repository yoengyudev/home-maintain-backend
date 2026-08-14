import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.middlerware";
import { authenticate } from "../../middlewares/auth.middlerware";
import { authorize } from "../../middlewares/role.middlerware";
import { UserRole } from "../../generated/prisma/enums";
import * as commissionController from "../../controllers/vendor/vendor.commission.controller";

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.PROVIDER));

router.get("/summary", asyncHandler(commissionController.getCommissionSummary));
router.get("/invoices", asyncHandler(commissionController.listInvoices));
router.get("/invoices/:id", asyncHandler(commissionController.getInvoiceById));
router.post("/invoices/:id/payment-proof", asyncHandler(commissionController.submitPaymentProof));

export default router;
