-- New columns for game mode on charting_games
ALTER TABLE "charting_games"
  ADD COLUMN IF NOT EXISTS "session_type" text NOT NULL DEFAULT 'live_ab';

ALTER TABLE "charting_games"
  ADD COLUMN IF NOT EXISTS "babson_side" text NOT NULL DEFAULT 'home';

ALTER TABLE "charting_games"
  ADD COLUMN IF NOT EXISTS "babson_starting_pitcher" text;

ALTER TABLE "charting_games"
  ADD COLUMN IF NOT EXISTS "opponent_starting_pitcher" text;

ALTER TABLE "charting_games"
  ADD COLUMN IF NOT EXISTS "our_team_label" text;

ALTER TABLE "charting_games"
  ADD COLUMN IF NOT EXISTS "opponent_team_label" text;

-- team_side on pitcher segments (default 'our' for backward compat)
ALTER TABLE "charting_pitcher_segments"
  ADD COLUMN IF NOT EXISTS "team_side" text NOT NULL DEFAULT 'our';

-- player_id was NOT NULL before; make nullable for opponent pitchers
ALTER TABLE "charting_pitcher_segments"
  ALTER COLUMN "player_id" DROP NOT NULL;

-- team_side on lineup entries (default 'opponent' for backward compat)
ALTER TABLE "charting_lineup_entries"
  ADD COLUMN IF NOT EXISTS "team_side" text NOT NULL DEFAULT 'opponent';

-- team_side on plate appearances (default 'opponent' for backward compat)
ALTER TABLE "charting_plate_appearances"
  ADD COLUMN IF NOT EXISTS "team_side" text NOT NULL DEFAULT 'opponent';
