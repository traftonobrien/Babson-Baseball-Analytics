import { pgTable, text, real, integer, primaryKey } from "drizzle-orm/pg-core";

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
