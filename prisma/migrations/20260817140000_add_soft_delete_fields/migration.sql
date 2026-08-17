-- AlterTable: add deletedAt to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "users_deletedAt_idx" ON "users"("deletedAt");

-- AlterTable: add deletedAt to customer_addresses
ALTER TABLE "customer_addresses" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "customer_addresses_deletedAt_idx" ON "customer_addresses"("deletedAt");

-- AlterTable: add deletedAt to service_listings
ALTER TABLE "service_listings" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "service_listings_deletedAt_idx" ON "service_listings"("deletedAt");

-- AlterTable: add deletedAt to service_categories
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "service_categories_deletedAt_idx" ON "service_categories"("deletedAt");

-- AlterTable: add deletedAt to service_areas
ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "service_areas_deletedAt_idx" ON "service_areas"("deletedAt");

-- AlterTable: add deletedAt to faqs
ALTER TABLE "faqs" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "faqs_deletedAt_idx" ON "faqs"("deletedAt");

-- AlterTable: add deletedAt to reviews
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "reviews_deletedAt_idx" ON "reviews"("deletedAt");

-- AlterTable: add deletedAt to provider_verifications
ALTER TABLE "provider_verifications" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "provider_verifications_deletedAt_idx" ON "provider_verifications"("deletedAt");
