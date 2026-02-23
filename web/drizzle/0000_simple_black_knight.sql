CREATE TABLE "stuff_plus_arsenal" (
	"player_id" text NOT NULL,
	"pitch_type" text NOT NULL,
	"player_name" text,
	"throws" text,
	"mean_stuff_plus" real,
	"sd_stuff_plus" real,
	"avg_velo_mph" real,
	"max_fb_velo" real,
	"avg_ext_ft" real,
	"n_sessions" integer,
	CONSTRAINT "stuff_plus_arsenal_player_id_pitch_type_pk" PRIMARY KEY("player_id","pitch_type")
);
--> statement-breakpoint
CREATE TABLE "stuff_plus_outings" (
	"session_key" text NOT NULL,
	"player_id" text NOT NULL,
	"player_name" text,
	"date" text NOT NULL,
	"pitch_type" text NOT NULL,
	"throws" text,
	"stuff_plus" real,
	"avg_velo_mph" real,
	"avg_ivb_in" real,
	"avg_hb_in" real,
	"avg_spin_rpm" real,
	"avg_ext_ft" real,
	CONSTRAINT "stuff_plus_outings_session_key_pitch_type_pk" PRIMARY KEY("session_key","pitch_type")
);
