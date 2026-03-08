--> statement-breakpoint
CREATE TABLE "charting_games" (
	"id" text PRIMARY KEY NOT NULL,
	"opponent" text NOT NULL,
	"game_date" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"charter" text,
	"weather" text,
	"home_catcher" text,
	"away_catcher" text,
	"babson_record" text,
	"standing" text,
	"tomorrow_starter" text,
	"tomorrow_opponent" text,
	"notes" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charting_pitcher_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"player_id" text NOT NULL,
	"display_name" text NOT NULL,
	"segment_order" integer NOT NULL,
	"entered_inning" integer,
	"exited_inning" integer,
	"runs_override" integer,
	"earned_runs_override" integer
);
--> statement-breakpoint
CREATE TABLE "charting_plate_appearances" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"segment_id" text NOT NULL,
	"pa_order" integer NOT NULL,
	"inning" integer NOT NULL,
	"hitter_name" text NOT NULL,
	"lineup_slot" integer NOT NULL,
	"result_code" text,
	"bunt_context" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charting_pitches" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"pa_id" text NOT NULL,
	"pitch_order" integer NOT NULL,
	"pitch_type" text NOT NULL,
	"location_cell" integer,
	"pitch_result" text NOT NULL,
	"balls_before" integer NOT NULL,
	"strikes_before" integer NOT NULL
);
