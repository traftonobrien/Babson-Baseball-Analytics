import { pgTable, text, real, integer, boolean, primaryKey } from "drizzle-orm/pg-core";

/**
 * Aggregated season averages per pitch (from stuff_plus_pitcher_arsenal.csv)
 */
export const stuffPlusArsenal = pgTable(
  "stuff_plus_arsenal",
  {
    playerId: text("player_id").notNull(),
    pitchType: text("pitch_type").notNull(),
    playerName: text("player_name"),
    throws: text("throws"),
    meanStuffPlus: real("mean_stuff_plus"),
    sdStuffPlus: real("sd_stuff_plus"),
    avgVeloMph: real("avg_velo_mph"),
    maxFbVelo: real("max_fb_velo"),
    avgExtFt: real("avg_ext_ft"),
    nSessions: integer("n_sessions"),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.pitchType] })]
);

/**
 * Session-by-session Stuff+ tracking (from stuff_plus_pitchtype_outings.csv)
 */
export const stuffPlusOutings = pgTable(
  "stuff_plus_outings",
  {
    sessionKey: text("session_key").notNull(),
    playerId: text("player_id").notNull(),
    playerName: text("player_name"),
    date: text("date").notNull(),
    pitchType: text("pitch_type").notNull(),
    throws: text("throws"),
    stuffPlus: real("stuff_plus"),
    avgVeloMph: real("avg_velo_mph"),
    avgIvbIn: real("avg_ivb_in"),
    avgHbIn: real("avg_hb_in"),
    avgSpinRpm: real("avg_spin_rpm"),
    avgExtFt: real("avg_ext_ft"),
  },
  (t) => [primaryKey({ columns: [t.sessionKey, t.pitchType] })]
);

// ---------------------------------------------------------------------------
// Charting domain tables (Phase 1)
// ---------------------------------------------------------------------------

/**
 * One record per charted game. The `revision` column is used for optimistic
 * locking: PATCH requests must supply the current revision, which is
 * incremented on every successful update.
 */
export const chartingGames = pgTable("charting_games", {
  id: text("id").primaryKey(),
  opponent: text("opponent").notNull(),
  /** ISO date yyyy-mm-dd */
  gameDate: text("game_date").notNull(),
  /** draft | active | final */
  status: text("status").notNull().default("draft"),
  revision: integer("revision").notNull().default(1),
  charter: text("charter"),
  weather: text("weather"),
  homeCatcher: text("home_catcher"),
  awayCatcher: text("away_catcher"),
  babsonRecord: text("babson_record"),
  standing: text("standing"),
  tomorrowStarter: text("tomorrow_starter"),
  tomorrowOpponent: text("tomorrow_opponent"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * One row per Babson pitcher stint within a game. A game with two pitchers
 * has two rows with segmentOrder 0 and 1. Segments are the unit of per-pitcher
 * summary stats and export rows.
 */
export const chartingPitcherSegments = pgTable("charting_pitcher_segments", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  /** Canonical Babson player id, e.g. "DJames1" */
  playerId: text("player_id").notNull(),
  displayName: text("display_name").notNull(),
  /** 0-indexed order of appearance within the game */
  segmentOrder: integer("segment_order").notNull(),
  enteredInning: integer("entered_inning"),
  exitedInning: integer("exited_inning"),
  /** Manual R/ER overrides applied before export */
  runsOverride: integer("runs_override"),
  earnedRunsOverride: integer("earned_runs_override"),
});

/**
 * One row per plate appearance. Linked to the active pitcher segment at the
 * time the PA started. resultCode is null while the PA is in progress.
 */
export const chartingPlateAppearances = pgTable("charting_plate_appearances", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  segmentId: text("segment_id").notNull(),
  paOrder: integer("pa_order").notNull(),
  inning: integer("inning").notNull(),
  hitterName: text("hitter_name").notNull(),
  /** 1-9 lineup slot */
  lineupSlot: integer("lineup_slot").notNull(),
  /** e.g. "K", "BB", "HBP", "1B", "F8", "6-3"; null while PA is open */
  resultCode: text("result_code"),
  buntContext: boolean("bunt_context").notNull().default(false),
});

/**
 * Pre-game opponent batting lineup. One row per slot (1-9) per game.
 * The lineup is entered before first pitch and can be edited until charting starts.
 */
export const chartingLineupEntries = pgTable("charting_lineup_entries", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  /** 1-9 */
  lineupSlot: integer("lineup_slot").notNull(),
  hitterName: text("hitter_name").notNull(),
});

/**
 * One row per individual pitch. ballsBefore/strikesBefore capture the count
 * going into the pitch so the full pitch sequence can be reconstructed
 * in order from pitchOrder alone.
 */
export const chartingPitches = pgTable("charting_pitches", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  paId: text("pa_id").notNull(),
  pitchOrder: integer("pitch_order").notNull(),
  /** Fastball | Curveball | Slider | Changeup | Split/Cut | Other */
  pitchType: text("pitch_type").notNull(),
  /** 1-17 catcher-view zone cell; null if not recorded */
  locationCell: integer("location_cell"),
  /** ball | called_strike | swinging_strike | foul | bunt_foul | in_play | hit_by_pitch */
  pitchResult: text("pitch_result").notNull(),
  ballsBefore: integer("balls_before").notNull(),
  strikesBefore: integer("strikes_before").notNull(),
  /** Gun reading in mph; null if not recorded */
  velocity: integer("velocity"),
});
