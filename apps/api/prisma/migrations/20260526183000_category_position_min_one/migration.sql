-- Ensure category exhibition index is 1-based.
UPDATE "categories"
SET "position" = 1
WHERE "position" < 1;

ALTER TABLE "categories"
ALTER COLUMN "position" SET DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'categories_position_min_1'
  ) THEN
    ALTER TABLE "categories"
    ADD CONSTRAINT "categories_position_min_1"
    CHECK ("position" >= 1);
  END IF;
END $$;
