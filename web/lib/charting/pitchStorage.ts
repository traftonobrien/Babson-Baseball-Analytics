import { integer, pgTable, text } from "drizzle-orm/pg-core";
import type { ChartingPitch } from "./types";

export const legacyChartingPitches = pgTable("charting_pitches", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  paId: text("pa_id").notNull(),
  pitchOrder: integer("pitch_order").notNull(),
  pitchType: text("pitch_type").notNull(),
  locationCell: integer("location_cell"),
  pitchResult: text("pitch_result").notNull(),
  ballsBefore: integer("balls_before").notNull(),
  strikesBefore: integer("strikes_before").notNull(),
});

type LegacyChartingPitchRow = typeof legacyChartingPitches.$inferSelect;

export function isMissingVelocityColumnError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("charting_pitches") &&
    error.message.includes("velocity")
  );
}

export function mapLegacyPitchRow(
  pitch: LegacyChartingPitchRow
): ChartingPitch {
  return {
    ...pitch,
    pitchType: pitch.pitchType as ChartingPitch["pitchType"],
    pitchResult: pitch.pitchResult as ChartingPitch["pitchResult"],
    velocity: null,
  };
}
