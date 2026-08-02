DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Booking"
    GROUP BY "plotId", "type"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add Booking(plotId, type) unique constraint: duplicate rows exist.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Booking" b
    INNER JOIN "Plot" p ON p."id" = b."plotId"
    WHERE b."projectId" <> p."projectId"
  ) THEN
    RAISE EXCEPTION 'Cannot add Booking(plotId, projectId) foreign key: booking projectId does not match plot projectId.';
  END IF;
END $$;

ALTER TABLE "Plot"
  ADD CONSTRAINT "Plot_id_projectId_key" UNIQUE ("id", "projectId");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_plotId_type_key" UNIQUE ("plotId", "type");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_plotId_projectId_fkey"
  FOREIGN KEY ("plotId", "projectId")
  REFERENCES "Plot"("id", "projectId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
