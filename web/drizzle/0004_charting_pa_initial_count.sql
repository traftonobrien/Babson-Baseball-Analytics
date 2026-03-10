ALTER TABLE "charting_plate_appearances"
ADD COLUMN IF NOT EXISTS "initial_count" text;

UPDATE "charting_plate_appearances" AS pa
SET "initial_count" = COALESCE(
  CASE
    WHEN pa."bunt_context" THEN 'Bunt'
    ELSE (
      SELECT CASE
        WHEN p."balls_before" = 2 AND p."strikes_before" = 1 THEN '2-1'
        ELSE '0-0'
      END
      FROM "charting_pitches" AS p
      WHERE p."pa_id" = pa."id"
      ORDER BY p."pitch_order" ASC
      LIMIT 1
    )
  END,
  '0-0'
)
WHERE pa."initial_count" IS NULL;

ALTER TABLE "charting_plate_appearances"
ALTER COLUMN "initial_count" SET DEFAULT '0-0';

ALTER TABLE "charting_plate_appearances"
ALTER COLUMN "initial_count" SET NOT NULL;
