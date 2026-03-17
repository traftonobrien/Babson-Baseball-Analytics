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
  ChartingMatchupSide,
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
  ChartingVenueSide,
} from "./types";
import {
  isMissingVelocityColumnError,
  legacyChartingPitches,
  mapLegacyPitchRow,
} from "./pitchStorage";
import {
  isMissingPlateAppearanceContextColumnError,
  legacyChartingPlateAppearances,
  mapLegacyPlateAppearanceRow,
} from "./plateAppearanceStorage";
import { resolvePlateAppearanceInitialCount } from "./live";

function normalizeVenueSide(
  value: string | null | undefined,
): ChartingVenueSide {
  return value === "away" ? "away" : "home";
}

function normalizeMatchupSide(
  value: string | null | undefined,
): ChartingMatchupSide {
  return value === "our" ? "our" : "opponent";
}

function mapGameRow(row: typeof chartingGames.$inferSelect): ChartingGame {
  return {
    ...row,
    status: row.status as ChartingGame["status"],
    sessionType: row.sessionType as ChartingGame["sessionType"],
    babsonVenueSide: normalizeVenueSide(row.babsonVenueSide),
    babsonStartingPitcher: row.babsonStartingPitcher ?? null,
    opponentStartingPitcher: row.opponentStartingPitcher ?? null,
    ourTeamLabel: row.ourTeamLabel ?? null,
    opponentTeamLabel: row.opponentTeamLabel ?? null,
  };
}

function mapSegmentRow(
  row: typeof chartingPitcherSegments.$inferSelect,
): ChartingPitcherSegment {
  return {
    ...row,
    playerId: row.playerId ?? null,
    teamSide: normalizeMatchupSide(row.teamSide),
  };
}

function mapLineupRow(
  row: typeof chartingLineupEntries.$inferSelect,
): ChartingLineupEntry {
  return {
    ...row,
    teamSide: normalizeMatchupSide(row.teamSide),
  };
}

function mapPlateAppearanceRow(
  row: typeof chartingPlateAppearances.$inferSelect,
): ChartingPlateAppearance {
  return {
    ...row,
    isTopInning: row.isTopInning ?? true,
    teamSide: normalizeMatchupSide(row.teamSide),
    initialCount:
      (row.initialCount as ChartingPlateAppearance["initialCount"]) ?? "0-0",
    runnerOnFirst: row.runnerOnFirst ?? null,
    runnerOnSecond: row.runnerOnSecond ?? null,
    runnerOnThird: row.runnerOnThird ?? null,
  };
}

export async function loadChartingGameSnapshot(
  gameId: string,
): Promise<ChartingGameSnapshot | null> {
  const [gameRow] = await db
    .select()
    .from(chartingGames)
    .where(eq(chartingGames.id, gameId));

  if (!gameRow) {
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
      .orderBy(
        asc(chartingLineupEntries.teamSide),
        asc(chartingLineupEntries.lineupSlot),
      ),
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
    game: mapGameRow(gameRow),
    segments: segments.map(
      (segment) => mapSegmentRow(segment) satisfies ChartingPitcherSegment,
    ),
    lineup: lineup.map(
      (entry) => mapLineupRow(entry) satisfies ChartingLineupEntry,
    ),
    plateAppearances: plateAppearances.map(
      (pa) =>
        ({
          ...pa,
          initialCount: resolvePlateAppearanceInitialCount(
            pa,
            pitchesByPaId.get(pa.id) ?? [],
          ),
        }) satisfies ChartingPlateAppearance,
    ),
    pitches,
  };
}

async function loadChartingPlateAppearances(
  gameId: string,
): Promise<ChartingPlateAppearance[]> {
  try {
    const rows = await db
      .select()
      .from(chartingPlateAppearances)
      .where(eq(chartingPlateAppearances.gameId, gameId))
      .orderBy(asc(chartingPlateAppearances.paOrder));

    return rows.map(
      (plateAppearance) =>
        mapPlateAppearanceRow(
          plateAppearance,
        ) satisfies ChartingPlateAppearance,
    );
  } catch (error) {
    if (!isMissingPlateAppearanceContextColumnError(error)) {
      throw error;
    }

    const legacyRows = await db
      .select()
      .from(legacyChartingPlateAppearances)
      .where(eq(legacyChartingPlateAppearances.gameId, gameId))
      .orderBy(asc(legacyChartingPlateAppearances.paOrder));

    return legacyRows.map(mapLegacyPlateAppearanceRow);
  }
}

async function loadChartingPitches(gameId: string): Promise<ChartingPitch[]> {
  try {
    const rows = await db
      .select()
      .from(chartingPitches)
      .where(eq(chartingPitches.gameId, gameId))
      .orderBy(asc(chartingPitches.pitchOrder));

    return rows.map(
      (pitch) =>
        ({
          ...pitch,
          pitchType: pitch.pitchType as ChartingPitch["pitchType"],
          pitchResult: pitch.pitchResult as ChartingPitch["pitchResult"],
        }) satisfies ChartingPitch,
    );
  } catch (error) {
    if (!isMissingVelocityColumnError(error)) {
      throw error;
    }

    const legacyRows = await db
      .select()
      .from(legacyChartingPitches)
      .where(eq(legacyChartingPitches.gameId, gameId))
      .orderBy(asc(legacyChartingPitches.pitchOrder));

    return legacyRows.map(mapLegacyPitchRow);
  }
}
