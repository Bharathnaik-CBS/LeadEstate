-- AlterEnum
ALTER TYPE "PlotBlockStatus" ADD VALUE 'CONVERTED';

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BookingKycStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "plotBlockId" TEXT;

-- AlterTable
ALTER TABLE "PlotBlock"
  ADD COLUMN "convertedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BookingPayment" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "referenceNumber" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingKyc" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "status" "BookingKycStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "submittedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingKyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_plotBlockId_key" ON "Booking"("plotBlockId");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "BookingPayment_bookingId_idx" ON "BookingPayment"("bookingId");

-- CreateIndex
CREATE INDEX "BookingPayment_status_idx" ON "BookingPayment"("status");

-- CreateIndex
CREATE INDEX "BookingPayment_method_idx" ON "BookingPayment"("method");

-- CreateIndex
CREATE INDEX "BookingPayment_paidAt_idx" ON "BookingPayment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingKyc_bookingId_key" ON "BookingKyc"("bookingId");

-- CreateIndex
CREATE INDEX "BookingKyc_status_idx" ON "BookingKyc"("status");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_plotBlockId_fkey"
  FOREIGN KEY ("plotBlockId") REFERENCES "PlotBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingKyc" ADD CONSTRAINT "BookingKyc_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
