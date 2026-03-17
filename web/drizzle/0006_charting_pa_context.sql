ALTER TABLE "charting_plate_appearances"
  ADD COLUMN IF NOT EXISTS "is_top_inning" boolean NOT NULL DEFAULT true;

ALTER TABLE "charting_plate_appearances"
  ADD COLUMN IF NOT EXISTS "runner_on_first" text;

ALTER TABLE "charting_plate_appearances"
  ADD COLUMN IF NOT EXISTS "runner_on_second" text;

ALTER TABLE "charting_plate_appearances"
  ADD COLUMN IF NOT EXISTS "runner_on_third" text;
