CREATE TABLE "ProjectLayout" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "layoutJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectLayout_projectId_key" ON "ProjectLayout"("projectId");

ALTER TABLE "ProjectLayout" ADD CONSTRAINT "ProjectLayout_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
