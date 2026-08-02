ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'NEGOTIATION' AFTER 'SITE_VISIT';

UPDATE "Lead" SET "source" = 'PHONE_CALL' WHERE "source" = 'CALL';

BEGIN;
CREATE TYPE "LeadSource_new" AS ENUM (
  'SE_GENERATED',
  'ADMIN_GENERATED',
  'WEBSITE',
  'REFERRAL',
  'WALK_IN',
  'PHONE_CALL',
  'SOCIAL_MEDIA',
  'OTHER'
);
ALTER TABLE "Lead" ALTER COLUMN "source" TYPE "LeadSource_new" USING ("source"::text::"LeadSource_new");
ALTER TYPE "LeadSource" RENAME TO "LeadSource_old";
ALTER TYPE "LeadSource_new" RENAME TO "LeadSource";
DROP TYPE "LeadSource_old";
COMMIT;
