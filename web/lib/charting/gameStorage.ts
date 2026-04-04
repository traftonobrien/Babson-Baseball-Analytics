import { integer, pgTable, text } from "drizzle-orm/pg-core";
import type { ChartingGame } from "./types";

/**
 * Legacy fallback for environments that have not yet applied the newer
 * charting_games metadata columns. Keep this intentionally minimal and fill
 * missing values with safe defaults on read.
 */
export const legacyChartingGames = pgTable("charting_games", {
  id: text("id").primaryKey(),
  opponent: text("opponent").notNull(),
  gameDate: text("game_date").notNull(),
  status: text("status"),
  revision: integer("revision"),
  babsonStartingPitcher: text("babson_starting_pitcher"),
  opponentStartingPitcher: text("opponent_starting_pitcher"),
  notes: text("notes"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

type LegacyChartingGameRow = typeof legacyChartingGames.$inferSelect;

function isMissingColumnError(error: unknown, columnName: string): error is Error {
  return (
    error instanceof Error &&
    error.message.includes("charting_games") &&
    error.message.includes(columnName)
  );
}

export function isMissingChartingGameMetadataColumnError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.includes("charting_games") &&
    error.message.includes("Failed query")
  ) {
    return true;
  }

  return [
    "session_type",
    "babson_side",
    "charter",
    "weather",
    "home_catcher",
    "away_catcher",
    "babson_record",
    "standing",
    "tomorrow_starter",
    "tomorrow_opponent",
    "our_team_label",
    "opponent_team_label",
  ].some((columnName) => isMissingColumnError(error, columnName));
}

export function mapLegacyGameRow(row: LegacyChartingGameRow): ChartingGame {
  return {
    id: row.id,
    opponent: row.opponent,
    gameDate: row.gameDate,
    status:
      row.status === "active" || row.status === "final" || row.status === "draft"
        ? row.status
        : "draft",
    sessionType: "game",
    babsonVenueSide: "home",
    revision: row.revision ?? 1,
    charter: null,
    weather: null,
    homeCatcher: null,
    awayCatcher: null,
    babsonRecord: null,
    standing: null,
    tomorrowStarter: null,
    tomorrowOpponent: null,
    notes: row.notes ?? null,
    babsonStartingPitcher: row.babsonStartingPitcher ?? null,
    opponentStartingPitcher: row.opponentStartingPitcher ?? null,
    ourTeamLabel: null,
    opponentTeamLabel: null,
    createdAt: row.createdAt ?? new Date(0).toISOString(),
    updatedAt: row.updatedAt ?? row.createdAt ?? new Date(0).toISOString(),
  };
}
