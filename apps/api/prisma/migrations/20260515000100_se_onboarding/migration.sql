-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('CREATED', 'PENDING_ADMIN_APPROVAL', 'PROFILE_INCOMPLETE', 'PASSWORD_CHANGE_REQUIRED', 'ACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "seId" TEXT,
ADD COLUMN "username" TEXT,
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "phoneNumber" TEXT,
ADD COLUMN "dob" TIMESTAMP(3),
ADD COLUMN "gender" "Gender",
ADD COLUMN "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "passwordResetOtp" TEXT,
ADD COLUMN "passwordResetOtpExp" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_seId_key" ON "User"("seId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
