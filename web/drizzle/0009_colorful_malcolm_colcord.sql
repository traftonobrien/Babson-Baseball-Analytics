CREATE TABLE "player_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"player_id" text,
	"player_name" text,
	"role" text DEFAULT 'player' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"last_login_at" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "player_accounts_email_idx" ON "player_accounts" USING btree ("email");