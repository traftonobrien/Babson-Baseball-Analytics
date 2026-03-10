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
import {
  isMissingVelocityColumnError,
  legacyChartingPitches,
  mapLegacyPitchRow,
} from "./pitchStorage";
import {
  isMissingInitialCountColumnError,
  legacyChartingPlateAppearances,
  mapLegacyPlateAppearanceRow,
} from "./plateAppearanceStorage";
import { resolvePlateAppearanceInitialCount } from "./live";

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
    loadChartingPlateAppearances(gameId),
    loadChartingPitches(gameId),
  ]);

  const pitchesByPaId = new Map<string, ChartingPitch[]>();
  for (const pitch of pitches) {
    const existing = pitchesByPaId.get(pitch.paId) ?? [];
    existing.push(pitch);
    pitchesByPaId.set(pitch.paId, existing);
  }

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
          initialCount: resolvePlateAppearanceInitialCount(
            pa,
            pitchesByPaId.get(pa.id) ?? []
          ),
        }) satisfies ChartingPlateAppearance
    ),
    pitches,
  };
}

async function loadChartingPlateAppearances(
  gameId: string
): Promise<ChartingPlateAppearance[]> {
  try {
    const plateAppearances = await db
      .select()
      .from(chartingPlateAppearances)
      .where(eq(chartingPlateAppearances.gameId, gameId))
      .orderBy(asc(chartingPlateAppearances.paOrder));

    return plateAppearances.map(
      (plateAppearance) =>
        ({
          ...plateAppearance,
          initialCount:
            (plateAppearance.initialCount as ChartingPlateAppearance["initialCount"]) ??
            "0-0",
        }) satisfies ChartingPlateAppearance
    );
  } catch (error) {
    if (!isMissingInitialCountColumnError(error)) {
      throw error;
    }

    const legacyPlateAppearances = await db
      .select()
      .from(legacyChartingPlateAppearances)
      .where(eq(legacyChartingPlateAppearances.gameId, gameId))
      .orderBy(asc(legacyChartingPlateAppearances.paOrder));

    return legacyPlateAppearances.map(mapLegacyPlateAppearanceRow);
  }
}

async function loadChartingPitches(gameId: string): Promise<ChartingPitch[]> {
  try {
    const pitches = await db
      .select()
      .from(chartingPitches)
      .where(eq(chartingPitches.gameId, gameId))
      .orderBy(asc(chartingPitches.pitchOrder));

    return pitches.map(
      (pitch) =>
        ({
          ...pitch,
          pitchType: pitch.pitchType as ChartingPitch["pitchType"],
          pitchResult: pitch.pitchResult as ChartingPitch["pitchResult"],
        }) satisfies ChartingPitch
    );
  } catch (error) {
    if (!isMissingVelocityColumnError(error)) {
      throw error;
    }

    const legacyPitches = await db
      .select()
      .from(legacyChartingPitches)
      .where(eq(legacyChartingPitches.gameId, gameId))
      .orderBy(asc(legacyChartingPitches.pitchOrder));

    return legacyPitches.map(mapLegacyPitchRow);
  }
}
