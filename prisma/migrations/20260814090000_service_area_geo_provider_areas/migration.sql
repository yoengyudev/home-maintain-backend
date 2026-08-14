-- AlterTable: add geo fields to service_areas
ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7);
ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7);
ALTER TABLE "service_areas" ADD COLUMN IF NOT EXISTS "radiusKm" DECIMAL(6,2) NOT NULL DEFAULT 15;

-- CreateTable: provider multi service areas
CREATE TABLE IF NOT EXISTS "provider_service_areas" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "serviceAreaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_service_areas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "provider_service_areas_providerProfileId_serviceAreaId_key"
  ON "provider_service_areas"("providerProfileId", "serviceAreaId");

CREATE INDEX IF NOT EXISTS "provider_service_areas_serviceAreaId_idx"
  ON "provider_service_areas"("serviceAreaId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_service_areas_providerProfileId_fkey'
  ) THEN
    ALTER TABLE "provider_service_areas"
      ADD CONSTRAINT "provider_service_areas_providerProfileId_fkey"
      FOREIGN KEY ("providerProfileId") REFERENCES "provider_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_service_areas_serviceAreaId_fkey'
  ) THEN
    ALTER TABLE "provider_service_areas"
      ADD CONSTRAINT "provider_service_areas_serviceAreaId_fkey"
      FOREIGN KEY ("serviceAreaId") REFERENCES "service_areas"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill junction from existing primaryAreaId
INSERT INTO "provider_service_areas" ("id", "providerProfileId", "serviceAreaId", "createdAt")
SELECT
  'psa_' || md5(random()::text || clock_timestamp()::text),
  p."id",
  p."primaryAreaId",
  CURRENT_TIMESTAMP
FROM "provider_profiles" p
WHERE p."primaryAreaId" IS NOT NULL
ON CONFLICT ("providerProfileId", "serviceAreaId") DO NOTHING;
