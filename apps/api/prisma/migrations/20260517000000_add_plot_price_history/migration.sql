CREATE TABLE "PlotPriceHistory" (
  "id" TEXT NOT NULL,
  "plotId" TEXT NOT NULL,
  "oldPrice" DECIMAL(12, 2),
  "newPrice" DECIMAL(12, 2) NOT NULL,
  "changedById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlotPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlotPriceHistory_plotId_createdAt_idx" ON "PlotPriceHistory"("plotId", "createdAt");

ALTER TABLE "PlotPriceHistory" ADD CONSTRAINT "PlotPriceHistory_plotId_fkey"
  FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
