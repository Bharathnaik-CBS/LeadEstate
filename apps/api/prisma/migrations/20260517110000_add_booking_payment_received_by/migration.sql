ALTER TABLE "BookingPayment"
  ADD COLUMN "receivedById" TEXT;

CREATE INDEX "BookingPayment_receivedById_idx" ON "BookingPayment"("receivedById");

ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
