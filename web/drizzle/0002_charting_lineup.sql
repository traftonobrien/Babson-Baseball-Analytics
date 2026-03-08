--> statement-breakpoint
CREATE TABLE "charting_lineup_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"lineup_slot" integer NOT NULL,
	"hitter_name" text NOT NULL
);
