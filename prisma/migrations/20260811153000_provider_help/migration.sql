-- CreateEnum
CREATE TYPE "FaqAudience" AS ENUM ('CUSTOMER', 'PROVIDER');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- AlterEnum
ALTER TYPE "SupportPageKey" ADD VALUE 'PROVIDER_CONTACT';

-- AlterTable
ALTER TABLE "faqs"
ADD COLUMN "audience" "FaqAudience" NOT NULL DEFAULT 'CUSTOMER',
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "relatedRoute" TEXT,
ADD COLUMN "relatedRouteLabelEn" TEXT,
ADD COLUMN "relatedRouteLabelKm" TEXT;

-- CreateIndex
CREATE INDEX "faqs_audience_isActive_category_idx" ON "faqs"("audience", "isActive", "category");

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audience" "FaqAudience" NOT NULL DEFAULT 'PROVIDER',
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "relatedBookingId" TEXT,
    "relatedServiceId" TEXT,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_requests_publicId_key" ON "support_requests"("publicId");

-- CreateIndex
CREATE INDEX "support_requests_userId_idx" ON "support_requests"("userId");

-- CreateIndex
CREATE INDEX "support_requests_status_idx" ON "support_requests"("status");

-- CreateIndex
CREATE INDEX "support_requests_createdAt_idx" ON "support_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
