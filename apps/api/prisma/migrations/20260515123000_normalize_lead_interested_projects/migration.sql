CREATE TABLE "LeadInterestedProject" (
  "leadId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadInterestedProject_pkey" PRIMARY KEY ("leadId", "projectId")
);

CREATE INDEX "LeadInterestedProject_projectId_idx" ON "LeadInterestedProject"("projectId");

ALTER TABLE "LeadInterestedProject" ADD CONSTRAINT "LeadInterestedProject_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeadInterestedProject" ADD CONSTRAINT "LeadInterestedProject_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "LeadInterestedProject" ("leadId", "projectId")
SELECT DISTINCT lead_id, project_id
FROM (
  SELECT
    "Lead"."id" AS lead_id,
    btrim(interest.project_id) AS project_id
  FROM "Lead"
  CROSS JOIN LATERAL unnest("Lead"."interestedProjectIds") AS interest(project_id)
) AS normalized_interests
INNER JOIN "Project" ON "Project"."id" = normalized_interests.project_id
WHERE normalized_interests.project_id <> ''
ON CONFLICT DO NOTHING;
