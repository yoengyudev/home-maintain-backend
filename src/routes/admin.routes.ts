import { Router } from "express";
import { asyncHandler } from "../middlewares/async-handler.middlerware";
import { authenticate } from "../middlewares/auth.middlerware";
import { authorize } from "../middlewares/role.middlerware";
import { UserRole } from "../generated/prisma/enums";

import * as authController from "../controllers/admin/admin.authentication.controller";
import * as providersController from "../controllers/admin/admin.providers.controller";
import * as customersController from "../controllers/admin/admin.customers.controller";
import * as bookingsController from "../controllers/admin/admin.bookings.controller";
import * as verificationsController from "../controllers/admin/admin.verifications.controller";
import * as servicesController from "../controllers/admin/admin.services.controller";
import * as categoriesController from "../controllers/admin/admin.categories.controller";
import * as serviceAreasController from "../controllers/admin/admin.service.areas.controller";
import * as notificationsController from "../controllers/admin/admin.notifications.controller";
import * as auditController from "../controllers/admin/admin.audit.controller";

const router = Router();

// ==========================================
// Authentication
// ==========================================
router.post("/auth/login", asyncHandler(authController.login));

// All routes below require ADMIN role
router.use(authenticate);
router.use(authorize(UserRole.ADMIN));

router.post("/auth/logout", asyncHandler(authController.logout));
router.get("/auth/me", asyncHandler(authController.me));

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

// ==========================================
// Categories
// ==========================================
router.get("/categories", asyncHandler(categoriesController.listCategories));
router.get("/categories/:id", asyncHandler(categoriesController.getCategoryById));
router.post("/categories", asyncHandler(categoriesController.createCategory));
router.patch("/categories/:id", asyncHandler(categoriesController.updateCategory));

// ==========================================
// Service Areas
// ==========================================
router.get("/service-areas", asyncHandler(serviceAreasController.listServiceAreas));
router.get("/service-areas/:id", asyncHandler(serviceAreasController.getServiceAreaById));
router.post("/service-areas", asyncHandler(serviceAreasController.createServiceArea));
router.patch("/service-areas/:id", asyncHandler(serviceAreasController.updateServiceArea));

// ==========================================
// Notifications
// ==========================================
router.get("/notifications", asyncHandler(notificationsController.listNotifications));
router.get("/notifications/unread-count", asyncHandler(notificationsController.getUnreadCount));
router.post("/notifications/read-all", asyncHandler(notificationsController.markAllRead));
router.post("/notifications/:id/read", asyncHandler(notificationsController.markRead));

// ==========================================
// Audit Log
// ==========================================
router.get("/audit-log", asyncHandler(auditController.listAuditLogs));

export default router;