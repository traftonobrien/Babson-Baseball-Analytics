-- Migration: 0008_add_team_id
-- Adds team_id scoping column to all charting domain tables.
-- Back-fills existing rows to 'babson' before adding NOT NULL constraint.

-- charting_games
ALTER TABLE "charting_games" ADD COLUMN IF NOT EXISTS "team_id" text;
UPDATE "charting_games" SET "team_id" = 'babson' WHERE "team_id" IS NULL;
ALTER TABLE "charting_games" ALTER COLUMN "team_id" SET NOT NULL;
ALTER TABLE "charting_games" ALTER COLUMN "team_id" SET DEFAULT 'babson';

-- charting_pitcher_segments
ALTER TABLE "charting_pitcher_segments" ADD COLUMN IF NOT EXISTS "team_id" text;
UPDATE "charting_pitcher_segments" SET "team_id" = 'babson' WHERE "team_id" IS NULL;
ALTER TABLE "charting_pitcher_segments" ALTER COLUMN "team_id" SET NOT NULL;
ALTER TABLE "charting_pitcher_segments" ALTER COLUMN "team_id" SET DEFAULT 'babson';

-- charting_plate_appearances
ALTER TABLE "charting_plate_appearances" ADD COLUMN IF NOT EXISTS "team_id" text;
UPDATE "charting_plate_appearances" SET "team_id" = 'babson' WHERE "team_id" IS NULL;
ALTER TABLE "charting_plate_appearances" ALTER COLUMN "team_id" SET NOT NULL;
ALTER TABLE "charting_plate_appearances" ALTER COLUMN "team_id" SET DEFAULT 'babson';

-- charting_lineup_entries
ALTER TABLE "charting_lineup_entries" ADD COLUMN IF NOT EXISTS "team_id" text;
UPDATE "charting_lineup_entries" SET "team_id" = 'babson' WHERE "team_id" IS NULL;
ALTER TABLE "charting_lineup_entries" ALTER COLUMN "team_id" SET NOT NULL;
ALTER TABLE "charting_lineup_entries" ALTER COLUMN "team_id" SET DEFAULT 'babson';

-- charting_pitches
ALTER TABLE "charting_pitches" ADD COLUMN IF NOT EXISTS "team_id" text;
UPDATE "charting_pitches" SET "team_id" = 'babson' WHERE "team_id" IS NULL;
ALTER TABLE "charting_pitches" ALTER COLUMN "team_id" SET NOT NULL;
ALTER TABLE "charting_pitches" ALTER COLUMN "team_id" SET DEFAULT 'babson';
