-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CUSTOMER', 'PROVIDER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ProviderVerificationStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'CHANGES_REQUIRED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ServiceModerationStatus" AS ENUM ('NORMAL', 'REQUIRES_REVIEW', 'CHANGES_REQUESTED', 'DISABLED_BY_ADMIN');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "BookingIssueStatus" AS ENUM ('NONE', 'NEEDS_REVIEW', 'DISPUTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('VERIFICATION', 'PROVIDER', 'CUSTOMER', 'BOOKING', 'SERVICE', 'CATEGORY', 'SERVICE_AREA', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'NOTICE', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('CREATED', 'UPDATED', 'APPROVED', 'REJECTED', 'REQUESTED_CHANGES', 'DISABLED', 'RESTORED', 'SUSPENDED', 'MARKED_READ', 'MARKED_UNREAD', 'SYSTEM_SYNC', 'SIGN_IN', 'SIGN_OUT');

-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('EN', 'KM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "lastSignedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_profiles" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "jobTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_profiles" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "avatarUrl" TEXT,
    "primaryCategoryId" TEXT,
    "primaryAreaId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "averageRating" DECIMAL(3,2),
    "completedJobs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_business_profiles" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "providerType" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "addressLine" TEXT,
    "district" TEXT,
    "cityProvince" TEXT,
    "coverageSummary" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "detectedAddress" TEXT,
    "workingDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workingHoursStart" TEXT,
    "workingHoursEnd" TEXT,
    "unavailableDates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "temporarilyPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL DEFAULT 'EN',
    "preferredContactMethod" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_sessions" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameKm" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionKm" TEXT,
    "iconName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_areas" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameKm" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "provinceOrCity" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_verifications" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "status" "ProviderVerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_verification_documents" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "providerVerificationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "documentNumber" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_verification_checklist_items" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "providerVerificationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_verification_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_verification_decisions" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "providerVerificationId" TEXT NOT NULL,
    "adminProfileId" TEXT,
    "status" "ProviderVerificationStatus" NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_verification_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_verification_timeline_items" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "providerVerificationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProviderVerificationStatus",
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_verification_timeline_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_listings" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "priceUnit" TEXT,
    "pricingType" TEXT,
    "duration" TEXT,
    "imageUrl" TEXT,
    "quantityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quantityUnit" TEXT,
    "minQuantity" INTEGER,
    "maxQuantity" INTEGER,
    "availabilitySummary" TEXT,
    "serviceStatus" "ServiceStatus" NOT NULL DEFAULT 'DISABLED',
    "moderationStatus" "ServiceModerationStatus" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_listing_areas" (
    "id" TEXT NOT NULL,
    "serviceListingId" TEXT NOT NULL,
    "serviceAreaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_listing_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_moderation_history" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "serviceListingId" TEXT NOT NULL,
    "adminProfileId" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "resultingServiceStatus" "ServiceStatus" NOT NULL,
    "resultingModerationStatus" "ServiceModerationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_moderation_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "notes" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "detectedLocation" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "serviceListingId" TEXT NOT NULL,
    "customerAddressId" TEXT,
    "serviceAreaId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "timeSlot" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "estimatedTotal" DECIMAL(10,2) NOT NULL,
    "serviceAddress" TEXT NOT NULL,
    "areaSummary" TEXT,
    "accessInstructions" TEXT,
    "customerNotes" TEXT,
    "rejectionReason" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_timeline_items" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "booking_timeline_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_issues" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "BookingIssueStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "summaryEn" TEXT NOT NULL,
    "summaryKm" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "serviceListingId" TEXT NOT NULL,
    "bookingId" TEXT,
    "rating" DECIMAL(2,1) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "titleEn" TEXT NOT NULL,
    "titleKm" TEXT,
    "messageEn" TEXT NOT NULL,
    "messageKm" TEXT,
    "priority" TEXT,
    "relatedModule" TEXT,
    "relatedRecordId" TEXT,
    "relatedRoute" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "adminProfileId" TEXT,
    "actorName" TEXT NOT NULL,
    "eventType" "AuditEventType" NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "actionEn" TEXT NOT NULL,
    "actionKm" TEXT,
    "reasonEn" TEXT,
    "reasonKm" TEXT,
    "relatedModule" TEXT NOT NULL,
    "relatedRecordId" TEXT,
    "relatedRoute" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_admin_notes" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "adminProfileId" TEXT,
    "body" TEXT NOT NULL,
    "relatedModule" TEXT NOT NULL,
    "relatedRecordId" TEXT,
    "relatedRoute" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_admin_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_publicId_key" ON "users"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_accountStatus_idx" ON "users"("accountStatus");

-- CreateIndex
CREATE UNIQUE INDEX "admin_profiles_publicId_key" ON "admin_profiles"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_profiles_userId_key" ON "admin_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_publicId_key" ON "customer_profiles"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_userId_key" ON "customer_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_profiles_publicId_key" ON "provider_profiles"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_profiles_userId_key" ON "provider_profiles"("userId");

-- CreateIndex
CREATE INDEX "provider_profiles_status_idx" ON "provider_profiles"("status");

-- CreateIndex
CREATE INDEX "provider_profiles_primaryCategoryId_idx" ON "provider_profiles"("primaryCategoryId");

-- CreateIndex
CREATE INDEX "provider_profiles_primaryAreaId_idx" ON "provider_profiles"("primaryAreaId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_business_profiles_providerProfileId_key" ON "provider_business_profiles"("providerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_sessions_publicId_key" ON "account_sessions"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "account_sessions_tokenHash_key" ON "account_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "account_sessions_userId_idx" ON "account_sessions"("userId");

-- CreateIndex
CREATE INDEX "account_sessions_expiresAt_idx" ON "account_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_publicId_key" ON "service_categories"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");

-- CreateIndex
CREATE INDEX "service_categories_isActive_idx" ON "service_categories"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "service_areas_publicId_key" ON "service_areas"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "service_areas_slug_key" ON "service_areas"("slug");

-- CreateIndex
CREATE INDEX "service_areas_isActive_idx" ON "service_areas"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "provider_verifications_publicId_key" ON "provider_verifications"("publicId");

-- CreateIndex
CREATE INDEX "provider_verifications_providerProfileId_idx" ON "provider_verifications"("providerProfileId");

-- CreateIndex
CREATE INDEX "provider_verifications_status_idx" ON "provider_verifications"("status");

-- CreateIndex
CREATE INDEX "provider_verifications_submittedAt_idx" ON "provider_verifications"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "provider_verification_documents_publicId_key" ON "provider_verification_documents"("publicId");

-- CreateIndex
CREATE INDEX "provider_verification_documents_providerVerificationId_idx" ON "provider_verification_documents"("providerVerificationId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_verification_checklist_items_publicId_key" ON "provider_verification_checklist_items"("publicId");

-- CreateIndex
CREATE INDEX "provider_verification_checklist_items_providerVerificationI_idx" ON "provider_verification_checklist_items"("providerVerificationId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_verification_decisions_publicId_key" ON "provider_verification_decisions"("publicId");

-- CreateIndex
CREATE INDEX "provider_verification_decisions_providerVerificationId_idx" ON "provider_verification_decisions"("providerVerificationId");

-- CreateIndex
CREATE INDEX "provider_verification_decisions_adminProfileId_idx" ON "provider_verification_decisions"("adminProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_verification_timeline_items_publicId_key" ON "provider_verification_timeline_items"("publicId");

-- CreateIndex
CREATE INDEX "provider_verification_timeline_items_providerVerificationId_idx" ON "provider_verification_timeline_items"("providerVerificationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_listings_publicId_key" ON "service_listings"("publicId");

-- CreateIndex
CREATE INDEX "service_listings_providerProfileId_idx" ON "service_listings"("providerProfileId");

-- CreateIndex
CREATE INDEX "service_listings_categoryId_idx" ON "service_listings"("categoryId");

-- CreateIndex
CREATE INDEX "service_listings_serviceStatus_idx" ON "service_listings"("serviceStatus");

-- CreateIndex
CREATE INDEX "service_listings_moderationStatus_idx" ON "service_listings"("moderationStatus");

-- CreateIndex
CREATE INDEX "service_listing_areas_serviceAreaId_idx" ON "service_listing_areas"("serviceAreaId");

-- CreateIndex
CREATE UNIQUE INDEX "service_listing_areas_serviceListingId_serviceAreaId_key" ON "service_listing_areas"("serviceListingId", "serviceAreaId");

-- CreateIndex
CREATE UNIQUE INDEX "service_moderation_history_publicId_key" ON "service_moderation_history"("publicId");

-- CreateIndex
CREATE INDEX "service_moderation_history_serviceListingId_createdAt_idx" ON "service_moderation_history"("serviceListingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_addresses_publicId_key" ON "customer_addresses"("publicId");

-- CreateIndex
CREATE INDEX "customer_addresses_customerProfileId_idx" ON "customer_addresses"("customerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_publicId_key" ON "bookings"("publicId");

-- CreateIndex
CREATE INDEX "bookings_customerProfileId_idx" ON "bookings"("customerProfileId");

-- CreateIndex
CREATE INDEX "bookings_providerProfileId_idx" ON "bookings"("providerProfileId");

-- CreateIndex
CREATE INDEX "bookings_serviceListingId_idx" ON "bookings"("serviceListingId");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_scheduledAt_idx" ON "bookings"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "booking_timeline_items_publicId_key" ON "booking_timeline_items"("publicId");

-- CreateIndex
CREATE INDEX "booking_timeline_items_bookingId_sortOrder_idx" ON "booking_timeline_items"("bookingId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "booking_issues_publicId_key" ON "booking_issues"("publicId");

-- CreateIndex
CREATE INDEX "booking_issues_bookingId_idx" ON "booking_issues"("bookingId");

-- CreateIndex
CREATE INDEX "booking_issues_status_idx" ON "booking_issues"("status");

-- CreateIndex
CREATE UNIQUE INDEX "booking_status_history_publicId_key" ON "booking_status_history"("publicId");

-- CreateIndex
CREATE INDEX "booking_status_history_bookingId_changedAt_idx" ON "booking_status_history"("bookingId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_publicId_key" ON "reviews"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_bookingId_key" ON "reviews"("bookingId");

-- CreateIndex
CREATE INDEX "reviews_customerProfileId_idx" ON "reviews"("customerProfileId");

-- CreateIndex
CREATE INDEX "reviews_providerProfileId_idx" ON "reviews"("providerProfileId");

-- CreateIndex
CREATE INDEX "reviews_serviceListingId_idx" ON "reviews"("serviceListingId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_publicId_key" ON "notifications"("publicId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_publicId_key" ON "audit_logs"("publicId");

-- CreateIndex
CREATE INDEX "audit_logs_adminProfileId_idx" ON "audit_logs"("adminProfileId");

-- CreateIndex
CREATE INDEX "audit_logs_relatedModule_idx" ON "audit_logs"("relatedModule");

-- CreateIndex
CREATE INDEX "audit_logs_eventType_idx" ON "audit_logs"("eventType");

-- CreateIndex
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "internal_admin_notes_publicId_key" ON "internal_admin_notes"("publicId");

-- CreateIndex
CREATE INDEX "internal_admin_notes_adminProfileId_idx" ON "internal_admin_notes"("adminProfileId");

-- CreateIndex
CREATE INDEX "internal_admin_notes_relatedModule_relatedRecordId_idx" ON "internal_admin_notes"("relatedModule", "relatedRecordId");

-- AddForeignKey
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_primaryCategoryId_fkey" FOREIGN KEY ("primaryCategoryId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_primaryAreaId_fkey" FOREIGN KEY ("primaryAreaId") REFERENCES "service_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_business_profiles" ADD CONSTRAINT "provider_business_profiles_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_sessions" ADD CONSTRAINT "account_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_verifications" ADD CONSTRAINT "provider_verifications_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_verification_documents" ADD CONSTRAINT "provider_verification_documents_providerVerificationId_fkey" FOREIGN KEY ("providerVerificationId") REFERENCES "provider_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_verification_checklist_items" ADD CONSTRAINT "provider_verification_checklist_items_providerVerification_fkey" FOREIGN KEY ("providerVerificationId") REFERENCES "provider_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_verification_decisions" ADD CONSTRAINT "provider_verification_decisions_providerVerificationId_fkey" FOREIGN KEY ("providerVerificationId") REFERENCES "provider_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_verification_decisions" ADD CONSTRAINT "provider_verification_decisions_adminProfileId_fkey" FOREIGN KEY ("adminProfileId") REFERENCES "admin_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_verification_timeline_items" ADD CONSTRAINT "provider_verification_timeline_items_providerVerificationI_fkey" FOREIGN KEY ("providerVerificationId") REFERENCES "provider_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_listings" ADD CONSTRAINT "service_listings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_listing_areas" ADD CONSTRAINT "service_listing_areas_serviceListingId_fkey" FOREIGN KEY ("serviceListingId") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_listing_areas" ADD CONSTRAINT "service_listing_areas_serviceAreaId_fkey" FOREIGN KEY ("serviceAreaId") REFERENCES "service_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_moderation_history" ADD CONSTRAINT "service_moderation_history_serviceListingId_fkey" FOREIGN KEY ("serviceListingId") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_moderation_history" ADD CONSTRAINT "service_moderation_history_adminProfileId_fkey" FOREIGN KEY ("adminProfileId") REFERENCES "admin_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceListingId_fkey" FOREIGN KEY ("serviceListingId") REFERENCES "service_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerAddressId_fkey" FOREIGN KEY ("customerAddressId") REFERENCES "customer_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceAreaId_fkey" FOREIGN KEY ("serviceAreaId") REFERENCES "service_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_timeline_items" ADD CONSTRAINT "booking_timeline_items_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_issues" ADD CONSTRAINT "booking_issues_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_serviceListingId_fkey" FOREIGN KEY ("serviceListingId") REFERENCES "service_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_adminProfileId_fkey" FOREIGN KEY ("adminProfileId") REFERENCES "admin_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_admin_notes" ADD CONSTRAINT "internal_admin_notes_adminProfileId_fkey" FOREIGN KEY ("adminProfileId") REFERENCES "admin_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
