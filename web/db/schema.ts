import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Sliding-window rate limit counters for password-gate login endpoints.
 * One row per (ip, gateId) pair; reset when the window expires.
 */
export const loginRateLimits = pgTable(
  "login_rate_limits",
  {
    ip: text("ip").notNull(),
    gateId: text("gate_id").notNull(),
    attempts: integer("attempts").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.ip, t.gateId] })],
);

// ---------------------------------------------------------------------------
// Account / personalization tables
// ---------------------------------------------------------------------------

/**
 * One row per Babson-authenticated site account.
 *
 * This table is for personalization and edit permissions, not broad site
 * visibility. Players can still browse the internal site after the normal gate;
 * playerId drives "My Portal" defaults and own-outing submissions.
 */
export const playerAccounts = pgTable(
  "player_accounts",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    playerId: text("player_id"),
    playerName: text("player_name"),
    /** player | coach | admin */
    role: text("role").notNull().default("player"),
    /** approved | pending | rejected */
    status: text("status").notNull().default("approved"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastLoginAt: text("last_login_at"),
  },
  (t) => [uniqueIndex("player_accounts_email_idx").on(t.email)],
);

/**
 * One-time email confirmation links for passwordless player accounts.
 *
 * Tokens are stored as hashes so a database read does not expose active login
 * links. Consuming a valid token creates the signed account-session cookie.
 */
export const accountEmailVerifications = pgTable(
  "account_email_verifications",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("account_email_verifications_token_hash_idx").on(t.tokenHash)],
);

// ---------------------------------------------------------------------------
// Fall intersquad tools
// ---------------------------------------------------------------------------

/**
 * Pitcher-submitted or coach-entered fall outing logs.
 *
 * The first version intentionally mirrors the fall pitching workbook: one
 * outing row with totals plus pitch/result/FPS sequences captured as text.
 * Later phases can derive workload/stress and split pitch-level detail if the
 * workflow needs more granularity.
 */
export const fallPitcherOutings = pgTable("fall_pitcher_outings", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().default("babson"),
  accountEmail: text("account_email").notNull(),
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  /** bullpen | live_ab | intersquad | scrimmage | game | other */
  outingType: text("outing_type").notNull(),
  /** ISO date yyyy-mm-dd */
  outingDate: text("outing_date").notNull(),
  innings: real("innings"),
  earnedRuns: integer("earned_runs").notNull().default(0),
  strikeouts: integer("strikeouts").notNull().default(0),
  walks: integer("walks").notNull().default(0),
  hits: integer("hits").notNull().default(0),
  pitchTokens: text("pitch_tokens").notNull().default(""),
  resultTokens: text("result_tokens").notNull().default(""),
  fpsTokens: text("fps_tokens").notNull().default(""),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Aggregated fall hitting stats per player, ingested from the fall workbook.
 * One row per (team_id, player_name). player_id may be null for walk-ons not
 * yet in the canonical player registry.
 */
export const fallHitterStats = pgTable(
  "fall_hitter_stats",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull().default("babson"),
    playerName: text("player_name").notNull(),
    playerId: text("player_id"),
    pa: integer("pa").notNull().default(0),
    ab: integer("ab").notNull().default(0),
    hits: integer("hits").notNull().default(0),
    singles: integer("singles").notNull().default(0),
    doubles: integer("doubles").notNull().default(0),
    triples: integer("triples").notNull().default(0),
    hr: integer("hr").notNull().default(0),
    bb: integer("bb").notNull().default(0),
    hbp: integer("hbp").notNull().default(0),
    k: integer("k").notNull().default(0),
    avg: real("avg"),
    obp: real("obp"),
    slg: real("slg"),
    ops: real("ops"),
    woba: real("woba"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("fall_hitter_stats_team_player_idx").on(t.teamId, t.playerName)],
);


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
  (t) => [primaryKey({ columns: [t.playerId, t.pitchType] })],
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
  (t) => [primaryKey({ columns: [t.sessionKey, t.pitchType] })],
);

// ---------------------------------------------------------------------------
// Charting domain tables
// ---------------------------------------------------------------------------

/**
 * One record per charted session/game.
 *
 * `sessionType`
 * - live_ab: internal live A/B workflow
 * - game: game workflow
 *
 * `babsonVenueSide`
 * - home | away
 */
export const chartingGames = pgTable("charting_games", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().default("babson"),
  sessionType: text("session_type").notNull().default("live_ab"),
  opponent: text("opponent").notNull(),
  /** ISO date yyyy-mm-dd */
  gameDate: text("game_date").notNull(),
  /** draft | active | final */
  status: text("status").notNull().default("draft"),
  babsonVenueSide: text("babson_side").notNull().default("home"),
  revision: integer("revision").notNull().default(1),

  /** Free-text starters for game-mode setup */
  babsonStartingPitcher: text("babson_starting_pitcher"),
  opponentStartingPitcher: text("opponent_starting_pitcher"),

  /** Optional labels for the two sides in game mode */
  ourTeamLabel: text("our_team_label"),
  opponentTeamLabel: text("opponent_team_label"),

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
 * One row per pitcher stint within a charted session.
 *
 * `teamSide`
 * - our | opponent
 */
export const chartingPitcherSegments = pgTable("charting_pitcher_segments", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().default("babson"),
  gameId: text("game_id").notNull(),
  teamSide: text("team_side").notNull().default("our"),
  /** Canonical player id when available; may be null for opponent pitchers */
  playerId: text("player_id"),
  displayName: text("display_name").notNull(),
  /** 0-indexed order of appearance within the game */
  segmentOrder: integer("segment_order").notNull(),
  enteredInning: integer("entered_inning"),
  exitedInning: integer("exited_inning"),
  /** L | R */
  pitcherHand: text("pitcher_hand"),
  /** Manual R/ER overrides applied before export */
  runsOverride: integer("runs_override"),
  earnedRunsOverride: integer("earned_runs_override"),
});

/**
 * One row per plate appearance. Linked to the active pitcher segment at the
 * time the PA started. resultCode is null while the PA is in progress.
 *
 * `teamSide`
 * - our | opponent
 */
export const chartingPlateAppearances = pgTable("charting_plate_appearances", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().default("babson"),
  gameId: text("game_id").notNull(),
  segmentId: text("segment_id").notNull(),
  paOrder: integer("pa_order").notNull(),
  inning: integer("inning").notNull(),
  isTopInning: boolean("is_top_inning").notNull().default(true),
  teamSide: text("team_side").notNull().default("opponent"),
  hitterName: text("hitter_name").notNull(),
  /** L | R | S */
  hitterHand: text("hitter_hand"),
  /** 1-9 lineup slot */
  lineupSlot: integer("lineup_slot").notNull(),
  /** e.g. "K", "BB", "HBP", "1B", "F8", "6-3"; null while PA is open */
  resultCode: text("result_code"),
  /** "0-0" | "2-1" | "Bunt" */
  initialCount: text("initial_count").notNull().default("0-0"),
  buntContext: boolean("bunt_context").notNull().default(false),
  runnerOnFirst: text("runner_on_first"),
  runnerOnSecond: text("runner_on_second"),
  runnerOnThird: text("runner_on_third"),
});

/**
 * Pre-session lineup entries.
 *
 * `teamSide`
 * - our | opponent
 *
 * One row per slot (1-9) per side per game.
 */
export const chartingLineupEntries = pgTable("charting_lineup_entries", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().default("babson"),
  gameId: text("game_id").notNull(),
  teamSide: text("team_side").notNull().default("opponent"),
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
  teamId: text("team_id").notNull().default("babson"),
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
