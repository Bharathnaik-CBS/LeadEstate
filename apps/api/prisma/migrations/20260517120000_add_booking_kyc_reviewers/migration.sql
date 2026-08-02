ALTER TABLE "BookingKyc"
  ADD COLUMN "verifiedById" TEXT,
  ADD COLUMN "rejectedById" TEXT;

CREATE INDEX "BookingKyc_verifiedById_idx" ON "BookingKyc"("verifiedById");
CREATE INDEX "BookingKyc_rejectedById_idx" ON "BookingKyc"("rejectedById");

ALTER TABLE "BookingKyc" ADD CONSTRAINT "BookingKyc_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingKyc" ADD CONSTRAINT "BookingKyc_rejectedById_fkey"
  FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
