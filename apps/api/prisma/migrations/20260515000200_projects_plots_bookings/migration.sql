ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'FOLLOW_UP';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'SITE_VISIT';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'BOOKED';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

UPDATE "Lead" SET "status" = 'FOLLOW_UP' WHERE "status" IN ('CONTACTED', 'NEGOTIATION');
UPDATE "Lead" SET "status" = 'SITE_VISIT' WHERE "status" = 'SITE_VISIT_SCHEDULED';
UPDATE "Lead" SET "status" = 'BOOKED' WHERE "status" = 'WON';
UPDATE "Lead" SET "status" = 'CANCELLED' WHERE "status" = 'LOST';

CREATE TYPE "PlotStatus" AS ENUM ('AVAILABLE', 'BLOCKED', 'BOOKED', 'CANCELLED');
CREATE TYPE "BookingType" AS ENUM ('BLOCKED', 'BOOKED');

ALTER TABLE "Lead"
  ADD COLUMN "interestedProjectIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "finalProjectId" TEXT,
  ADD COLUMN "finalPlotId" TEXT,
  ADD COLUMN "bookingAmount" DECIMAL(12, 2),
  ADD COLUMN "bookingDate" TIMESTAMP(3);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "projectName" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "description" TEXT,
  "totalPlots" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Plot" (
  "id" TEXT NOT NULL,
  "plotNumber" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "size" TEXT,
  "facing" TEXT,
  "price" DECIMAL(12, 2),
  "status" "PlotStatus" NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Plot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "type" "BookingType" NOT NULL,
  "amountPaid" DECIMAL(12, 2),
  "bookingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leadId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "plotId" TEXT NOT NULL,
  "salesExecutiveId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plot_projectId_plotNumber_key" ON "Plot"("projectId", "plotNumber");
CREATE INDEX "Plot_projectId_idx" ON "Plot"("projectId");
CREATE INDEX "Plot_status_idx" ON "Plot"("status");
CREATE INDEX "Booking_leadId_idx" ON "Booking"("leadId");
CREATE INDEX "Booking_projectId_idx" ON "Booking"("projectId");
CREATE INDEX "Booking_plotId_idx" ON "Booking"("plotId");
CREATE INDEX "Booking_salesExecutiveId_idx" ON "Booking"("salesExecutiveId");
CREATE INDEX "Lead_finalProjectId_idx" ON "Lead"("finalProjectId");
CREATE INDEX "Lead_finalPlotId_idx" ON "Lead"("finalPlotId");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_finalProjectId_fkey"
  FOREIGN KEY ("finalProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_finalPlotId_fkey"
  FOREIGN KEY ("finalPlotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Plot" ADD CONSTRAINT "Plot_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_plotId_fkey"
  FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_salesExecutiveId_fkey"
  FOREIGN KEY ("salesExecutiveId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
