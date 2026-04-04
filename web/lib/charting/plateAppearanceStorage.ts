import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import type { ChartingPlateAppearance } from "./types";

/**
 * Legacy table shape fallback for deployments that have not yet applied newer
 * charting columns. Keep this definition intentionally minimal so reads/writes
 * can fall back safely when optional columns are missing.
 */
export const legacyChartingPlateAppearances = pgTable(
  "charting_plate_appearances",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id").notNull(),
    segmentId: text("segment_id").notNull(),
    paOrder: integer("pa_order").notNull(),
    inning: integer("inning").notNull(),
    hitterName: text("hitter_name").notNull(),
  },
);

type LegacyChartingPlateAppearanceRow =
  typeof legacyChartingPlateAppearances.$inferSelect;

function isMissingColumnError(
  error: unknown,
  columnName: string,
): error is Error {
  return (
    error instanceof Error &&
    error.message.includes("charting_plate_appearances") &&
    error.message.includes(columnName)
  );
}

export function isLegacyPlateAppearanceReadError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("charting_plate_appearances") &&
    error.message.includes("Failed query")
  );
}

export function isMissingInitialCountColumnError(error: unknown) {
  return isMissingColumnError(error, "initial_count");
}

export function isMissingPlateAppearanceContextColumnError(error: unknown) {
  return [
    "initial_count",
    "is_top_inning",
    "runner_on_first",
    "runner_on_second",
    "runner_on_third",
  ].some((columnName) => isMissingColumnError(error, columnName));
}

/**
 * Some environments may still be on an older schema that does not include
 * newer optional matchup-side fields. Treat those rows as valid legacy rows
 * and hydrate the missing field as null so downstream code can continue to
 * operate safely.
 */
export function isMissingBattingSideColumnError(error: unknown) {
  return isMissingColumnError(error, "team_side");
}

export function mapLegacyPlateAppearanceRow(
  plateAppearance: LegacyChartingPlateAppearanceRow,
): ChartingPlateAppearance {
  return {
    ...plateAppearance,
    lineupSlot: 1,
    resultCode: null,
    buntContext: false,
    isTopInning: true,
    teamSide: "opponent",
    initialCount: null,
    runnerOnFirst: null,
    runnerOnSecond: null,
    runnerOnThird: null,
  };
}
