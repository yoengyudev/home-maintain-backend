-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS', 'WEB', 'UNKNOWN');

-- CreateTable
CREATE TABLE "fcm_tokens" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'UNKNOWN',
    "deviceName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fcm_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fcm_tokens_publicId_key" ON "fcm_tokens"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "fcm_tokens_token_key" ON "fcm_tokens"("token");

-- CreateIndex
CREATE INDEX "fcm_tokens_userId_idx" ON "fcm_tokens"("userId");

-- CreateIndex
CREATE INDEX "fcm_tokens_userId_isActive_idx" ON "fcm_tokens"("userId", "isActive");

-- AddForeignKey
ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
