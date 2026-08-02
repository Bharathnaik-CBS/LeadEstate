DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PlotBlock_customerId_fkey'
      AND conrelid = '"PlotBlock"'::regclass
  ) THEN
    ALTER TABLE "PlotBlock"
      ADD CONSTRAINT "PlotBlock_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;
