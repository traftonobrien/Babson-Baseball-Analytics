ALTER TABLE "charting_games" ADD COLUMN "team_id" text DEFAULT 'babson' NOT NULL;--> statement-breakpoint
ALTER TABLE "charting_lineup_entries" ADD COLUMN "team_id" text DEFAULT 'babson' NOT NULL;--> statement-breakpoint
ALTER TABLE "charting_pitcher_segments" ADD COLUMN "team_id" text DEFAULT 'babson' NOT NULL;--> statement-breakpoint
ALTER TABLE "charting_pitcher_segments" ADD COLUMN "pitcher_hand" text;--> statement-breakpoint
ALTER TABLE "charting_pitches" ADD COLUMN "team_id" text DEFAULT 'babson' NOT NULL;--> statement-breakpoint
ALTER TABLE "charting_plate_appearances" ADD COLUMN "team_id" text DEFAULT 'babson' NOT NULL;--> statement-breakpoint
ALTER TABLE "charting_plate_appearances" ADD COLUMN "hitter_hand" text;