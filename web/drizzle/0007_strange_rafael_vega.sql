CREATE TABLE "charting_games" (
	"id" text PRIMARY KEY NOT NULL,
	"session_type" text DEFAULT 'live_ab' NOT NULL,
	"opponent" text NOT NULL,
	"game_date" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"babson_side" text DEFAULT 'home' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"babson_starting_pitcher" text,
	"opponent_starting_pitcher" text,
	"our_team_label" text,
	"opponent_team_label" text,
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
CREATE TABLE "charting_lineup_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"team_side" text DEFAULT 'opponent' NOT NULL,
	"lineup_slot" integer NOT NULL,
	"hitter_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charting_pitcher_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"team_side" text DEFAULT 'our' NOT NULL,
	"player_id" text,
	"display_name" text NOT NULL,
	"segment_order" integer NOT NULL,
	"entered_inning" integer,
	"exited_inning" integer,
	"runs_override" integer,
	"earned_runs_override" integer
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
	"strikes_before" integer NOT NULL,
	"velocity" integer
);
--> statement-breakpoint
CREATE TABLE "charting_plate_appearances" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"segment_id" text NOT NULL,
	"pa_order" integer NOT NULL,
	"inning" integer NOT NULL,
	"is_top_inning" boolean DEFAULT true NOT NULL,
	"team_side" text DEFAULT 'opponent' NOT NULL,
	"hitter_name" text NOT NULL,
	"lineup_slot" integer NOT NULL,
	"result_code" text,
	"initial_count" text DEFAULT '0-0' NOT NULL,
	"bunt_context" boolean DEFAULT false NOT NULL,
	"runner_on_first" text,
	"runner_on_second" text,
	"runner_on_third" text
);
--> statement-breakpoint
CREATE TABLE "login_rate_limits" (
	"ip" text NOT NULL,
	"gate_id" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	CONSTRAINT "login_rate_limits_ip_gate_id_pk" PRIMARY KEY("ip","gate_id")
);
