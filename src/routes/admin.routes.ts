import { Router } from "express";
import { asyncHandler } from "../middlewares/async-handler.middlerware";
import { authenticate } from "../middlewares/auth.middlerware";
import { authorize } from "../middlewares/role.middlerware";
import { UserRole } from "../generated/prisma/enums";
import { validate } from "../validators/validate";
import {
    adminLoginSchema,
    adminForgotPasswordSchema,
    adminVerifyOtpSchema,
    adminResetPasswordSchema,
} from "../validators/admin/admin.auth.validator";
import { createAdminNoteSchema } from "../validators/admin/admin.notes.validator";
import * as notesController from "../controllers/admin/admin.notes.controller";
import { uploadImage } from "../utils/upload-image.util";

import * as authController from "../controllers/admin/admin.authentication.controller";
import * as profileController from "../controllers/admin/admin.profile.controller";
import * as providersController from "../controllers/admin/admin.providers.controller";
import * as customersController from "../controllers/admin/admin.customers.controller";
import * as bookingsController from "../controllers/admin/admin.bookings.controller";
import * as verificationsController from "../controllers/admin/admin.verifications.controller";
import * as servicesController from "../controllers/admin/admin.services.controller";
import * as categoriesController from "../controllers/admin/admin.categories.controller";
import * as serviceAreasController from "../controllers/admin/admin.service.areas.controller";
import * as notificationsController from "../controllers/admin/admin.notifications.controller";
import * as auditController from "../controllers/admin/admin.audit.controller";
import * as helpController from "../controllers/admin/admin.help.controller";
import {
    createFaqSchema,
    updateFaqSchema,
    updateSupportPageSchema,
    updateSupportRequestSchema,
} from "../validators/admin/admin.help.validator";

const router = Router();

const categoryImageUpload = uploadImage.fields([
    { name: "image", maxCount: 1 },
    { name: "icon", maxCount: 1 },
]);

// ==========================================
// Authentication
// ==========================================
router.post("/auth/login", validate(adminLoginSchema), asyncHandler(authController.login));
router.post("/auth/forgot-password", validate(adminForgotPasswordSchema), asyncHandler(authController.forgotPassword));
router.post("/auth/verify-otp", validate(adminVerifyOtpSchema), asyncHandler(authController.verifyResetOtp));
router.post("/auth/reset-password", validate(adminResetPasswordSchema), asyncHandler(authController.resetPassword));

// All routes below require ADMIN role
router.use(authenticate);
router.use(authorize(UserRole.ADMIN));

router.post("/auth/logout", asyncHandler(authController.logout));
router.get("/auth/me", asyncHandler(authController.me));

// ==========================================
// Profile
// ==========================================
router.get("/auth/profile", asyncHandler(profileController.getProfile));
router.patch("/auth/profile", asyncHandler(profileController.updateProfile));
router.post("/auth/change-password", asyncHandler(profileController.changePassword));

// ==========================================
// Providers
// ==========================================
router.get("/providers", asyncHandler(providersController.listProviders));
router.get("/providers/:id", asyncHandler(providersController.getProviderById));
router.post("/providers/:id/suspend", asyncHandler(providersController.suspendProvider));
router.post("/providers/:id/restore", asyncHandler(providersController.restoreProvider));

// ==========================================
// Customers
// ==========================================
router.get("/customers", asyncHandler(customersController.listCustomers));
router.get("/customers/:id", asyncHandler(customersController.getCustomerById));
router.post("/customers/:id/suspend", asyncHandler(customersController.suspendCustomer));
router.post("/customers/:id/restore", asyncHandler(customersController.restoreCustomer));

// ==========================================
// Bookings
// ==========================================
router.get("/bookings", asyncHandler(bookingsController.listBookings));
router.get("/bookings/:id", asyncHandler(bookingsController.getBookingById));

// ==========================================
// Verifications
// ==========================================
router.get("/verifications", asyncHandler(verificationsController.listVerifications));
router.get("/verifications/:id", asyncHandler(verificationsController.getVerificationById));
router.post("/verifications/:id/approve", asyncHandler(verificationsController.approveVerification));
router.post("/verifications/:id/request-changes", asyncHandler(verificationsController.requestChanges));
router.post("/verifications/:id/reject", asyncHandler(verificationsController.rejectVerification));

// ==========================================
// Services
// ==========================================
router.get("/services", asyncHandler(servicesController.listServices));
router.get("/services/:id", asyncHandler(servicesController.getServiceById));
router.post("/services/:id/disable", asyncHandler(servicesController.disableService));
router.post("/services/:id/restore", asyncHandler(servicesController.restoreService));
router.post("/services/:id/approve", asyncHandler(servicesController.approveService));
router.post("/services/:id/request-changes", asyncHandler(servicesController.requestServiceChanges));

// ==========================================
// Categories
// ==========================================
router.get("/categories", asyncHandler(categoriesController.listCategories));
router.get("/categories/:id", asyncHandler(categoriesController.getCategoryById));
router.post(
    "/categories",
    categoryImageUpload,
    asyncHandler(categoriesController.createCategory)
);
router.patch(
    "/categories/:id",
    categoryImageUpload,
    asyncHandler(categoriesController.updateCategory)
);
router.patch("/categories/:id/disable", asyncHandler(categoriesController.disableCategory));
router.patch("/categories/:id/restore", asyncHandler(categoriesController.restoreCategory));
router.delete("/categories/:id", asyncHandler(categoriesController.deleteCategory));

// ==========================================
// Service Areas
// ==========================================
router.get("/service-areas", asyncHandler(serviceAreasController.listServiceAreas));
router.get("/service-areas/:id", asyncHandler(serviceAreasController.getServiceAreaById));
router.post("/service-areas", asyncHandler(serviceAreasController.createServiceArea));
router.patch("/service-areas/:id", asyncHandler(serviceAreasController.updateServiceArea));
router.patch("/service-areas/:id/disable", asyncHandler(serviceAreasController.disableServiceArea));
router.patch("/service-areas/:id/restore", asyncHandler(serviceAreasController.restoreServiceArea));
router.delete("/service-areas/:id", asyncHandler(serviceAreasController.deleteServiceArea));

// ==========================================
// Help Center — FAQs, support pages, tickets
// ==========================================
router.get("/faqs", asyncHandler(helpController.listFaqs));
router.get("/faqs/:id", asyncHandler(helpController.getFaqById));
router.post("/faqs", validate(createFaqSchema), asyncHandler(helpController.createFaq));
router.patch("/faqs/:id", validate(updateFaqSchema), asyncHandler(helpController.updateFaq));
router.patch("/faqs/:id/disable", asyncHandler(helpController.disableFaq));
router.patch("/faqs/:id/restore", asyncHandler(helpController.restoreFaq));
router.delete("/faqs/:id", asyncHandler(helpController.deleteFaq));

router.get("/support-pages", asyncHandler(helpController.listSupportPages));
router.get("/support-pages/:pageKey", asyncHandler(helpController.getSupportPage));
router.patch(
    "/support-pages/:pageKey",
    validate(updateSupportPageSchema),
    asyncHandler(helpController.updateSupportPage)
);

router.get("/support-requests", asyncHandler(helpController.listSupportRequests));
router.patch(
    "/support-requests/:id",
    validate(updateSupportRequestSchema),
    asyncHandler(helpController.updateSupportRequest)
);

// ==========================================
// Notifications
// ==========================================
router.get("/notifications", asyncHandler(notificationsController.listNotifications));
router.get("/notifications/unread-count", asyncHandler(notificationsController.getUnreadCount));
router.post("/notifications/read-all", asyncHandler(notificationsController.markAllRead));
router.post("/notifications/:id/read", asyncHandler(notificationsController.markRead));
router.post("/notifications/:id/unread", asyncHandler(notificationsController.markUnread));

router.get("/notes", asyncHandler(notesController.listNotes));
router.post("/notes", validate(createAdminNoteSchema), asyncHandler(notesController.createNote));

// ==========================================
// Audit Log
// ==========================================
router.get("/audit-log", asyncHandler(auditController.listAuditLogs));

export default router;