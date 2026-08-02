-- CreateEnum
CREATE TYPE "PlotBlockStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "PlotStatus" ADD VALUE 'SOLD';

-- CreateTable
CREATE TABLE "PlotBlock" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "blockedById" TEXT NOT NULL,
    "status" "PlotBlockStatus" NOT NULL DEFAULT 'ACTIVE',
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlotBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlotBlock_projectId_idx" ON "PlotBlock"("projectId");

-- CreateIndex
CREATE INDEX "PlotBlock_plotId_idx" ON "PlotBlock"("plotId");

-- CreateIndex
CREATE INDEX "PlotBlock_customerId_idx" ON "PlotBlock"("customerId");

-- CreateIndex
CREATE INDEX "PlotBlock_blockedById_idx" ON "PlotBlock"("blockedById");

-- CreateIndex
CREATE INDEX "PlotBlock_status_idx" ON "PlotBlock"("status");

-- CreateIndex
CREATE INDEX "PlotBlock_plotId_status_idx" ON "PlotBlock"("plotId", "status");

-- AddForeignKey
ALTER TABLE "PlotBlock" ADD CONSTRAINT "PlotBlock_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotBlock" ADD CONSTRAINT "PlotBlock_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotBlock" ADD CONSTRAINT "PlotBlock_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotBlock" ADD CONSTRAINT "PlotBlock_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
