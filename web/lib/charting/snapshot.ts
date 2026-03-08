import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  chartingGames,
  chartingLineupEntries,
  chartingPitcherSegments,
  chartingPlateAppearances,
  chartingPitches,
} from "@/db/schema";
import type {
  ChartingGame,
  ChartingGameSnapshot,
  ChartingLineupEntry,
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
} from "./types";

export async function loadChartingGameSnapshot(
  gameId: string
): Promise<ChartingGameSnapshot | null> {
  const [game] = await db
    .select()
    .from(chartingGames)
    .where(eq(chartingGames.id, gameId));

  if (!game) {
    return null;
  }

  const [segments, lineup, plateAppearances, pitches] = await Promise.all([
    db
      .select()
      .from(chartingPitcherSegments)
      .where(eq(chartingPitcherSegments.gameId, gameId))
      .orderBy(asc(chartingPitcherSegments.segmentOrder)),
    db
      .select()
      .from(chartingLineupEntries)
      .where(eq(chartingLineupEntries.gameId, gameId))
      .orderBy(asc(chartingLineupEntries.lineupSlot)),
    db
      .select()
      .from(chartingPlateAppearances)
      .where(eq(chartingPlateAppearances.gameId, gameId))
      .orderBy(asc(chartingPlateAppearances.paOrder)),
    db
      .select()
      .from(chartingPitches)
      .where(eq(chartingPitches.gameId, gameId))
      .orderBy(asc(chartingPitches.pitchOrder)),
  ]);

  return {
    game: {
      ...game,
      status: game.status as ChartingGame["status"],
    },
    segments: segments.map(
      (segment) =>
        ({
          ...segment,
        }) satisfies ChartingPitcherSegment
    ),
    lineup: lineup.map(
      (entry) =>
        ({
          ...entry,
        }) satisfies ChartingLineupEntry
    ),
    plateAppearances: plateAppearances.map(
      (pa) =>
        ({
          ...pa,
        }) satisfies ChartingPlateAppearance
    ),
    pitches: pitches.map(
      (pitch) =>
        ({
          ...pitch,
          pitchType: pitch.pitchType as ChartingPitch["pitchType"],
          pitchResult: pitch.pitchResult as ChartingPitch["pitchResult"],
        }) satisfies ChartingPitch
    ),
  };
}
