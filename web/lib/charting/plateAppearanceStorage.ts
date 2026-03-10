import { boolean, integer, pgTable, text } from "drizzle-orm/pg-core";
import type { ChartingPlateAppearance } from "./types";

export const legacyChartingPlateAppearances = pgTable("charting_plate_appearances", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  segmentId: text("segment_id").notNull(),
  paOrder: integer("pa_order").notNull(),
  inning: integer("inning").notNull(),
  hitterName: text("hitter_name").notNull(),
  lineupSlot: integer("lineup_slot").notNull(),
  resultCode: text("result_code"),
  buntContext: boolean("bunt_context").notNull(),
});

type LegacyChartingPlateAppearanceRow = typeof legacyChartingPlateAppearances.$inferSelect;

export function isMissingInitialCountColumnError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("charting_plate_appearances") &&
    error.message.includes("initial_count")
  );
}

export function mapLegacyPlateAppearanceRow(
  plateAppearance: LegacyChartingPlateAppearanceRow
): ChartingPlateAppearance {
  return {
    ...plateAppearance,
    initialCount: null,
  };
}
