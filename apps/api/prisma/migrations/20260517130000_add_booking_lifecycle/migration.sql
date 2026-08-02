-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'CLOSED');

-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "status" "BookingStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "closedById" TEXT,
  ADD COLUMN "closureNotes" TEXT;

-- Existing deployments have one booking per plot/type. Drop that broad
-- constraint so cancelled/closed bookings can remain as history.
ALTER TABLE "Booking"
  DROP CONSTRAINT IF EXISTS "Booking_plotId_type_key";

-- Keep the live workflow exclusive while allowing historical rows.
CREATE UNIQUE INDEX "Booking_active_plotId_type_key"
  ON "Booking"("plotId", "type")
  WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_cancelledById_idx" ON "Booking"("cancelledById");

-- CreateIndex
CREATE INDEX "Booking_closedById_idx" ON "Booking"("closedById");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
