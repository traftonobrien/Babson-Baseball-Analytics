import { desc, inArray } from "drizzle-orm";
import {
  chartingGames,
  chartingPitcherSegments,
  chartingPitches,
  chartingPlateAppearances,
} from "@/db/schema";
import { playerRegistry } from "@/lib/playerRegistry";
import {
  buildChartingPlayerComparisonDirectory,
  type ChartingPlayerComparisonDirectoryEntry,
} from "./playerComparison";
import { loadChartingHitterInsightsDirectory } from "./playerProfile";
import {
  buildPitcherComparisonDirectory,
  type PitcherComparisonDirectoryEntry,
  type PitcherComparisonDirectorySource,
} from "./pitcherComparison";
import type { BatterHand } from "./hitterInsights";
import {
  legacyChartingPlateAppearances,
  loadPlateAppearancesWithFallback,
  mapLegacyPlateAppearanceRow,
} from "./plateAppearanceStorage";
import {
  isMissingChartingGameMetadataColumnError,
  legacyChartingGames,
  mapLegacyGameRow,
} from "./gameStorage";
import type { ChartingMatchupSide, ChartingPitch, ChartingPitcherSegment } from "./types";

async function getDb() {
  const { db } = await import("@/db");
  return db;
}

function normalizeMatchupSide(value: string | null | undefined): ChartingMatchupSide {
  return value === "our" ? "our" : "opponent";
}

function mapSegmentRows(rows: typeof chartingPitcherSegments.$inferSelect[]): ChartingPitcherSegment[] {
  return rows.map((row) => ({
    ...row,
    playerId: row.playerId ?? null,
    teamSide: normalizeMatchupSide(row.teamSide),
  }));
}

function mapPitchRows(rows: typeof chartingPitches.$inferSelect[]): ChartingPitch[] {
  return rows.map(
    (pitch) =>
      ({
        ...pitch,
        pitchType: pitch.pitchType as ChartingPitch["pitchType"],
        pitchResult: pitch.pitchResult as ChartingPitch["pitchResult"],
      }) satisfies ChartingPitch
  );
}

export async function loadChartingHitterComparisonDirectory(): Promise<
  ChartingPlayerComparisonDirectoryEntry[]
> {
  const hitterSources = playerRegistry
    .filter((player) => player.isHitter)
    .map((player) => ({
      slug: player.slug,
      name: player.name,
      bats:
        player.bats === "R" || player.bats === "L" || player.bats === "S"
          ? (player.bats as BatterHand)
          : undefined,
    }));

  return buildChartingPlayerComparisonDirectory(
    await loadChartingHitterInsightsDirectory(hitterSources, {
      sessionType: "game",
    })
  );
}

export async function loadChartingPitcherComparisonDirectory(): Promise<
  PitcherComparisonDirectoryEntry[]
> {
  const db = await getDb();
  const games = await (async () => {
    try {
      return await db
        .select({
          id: chartingGames.id,
          gameDate: chartingGames.gameDate,
          opponent: chartingGames.opponent,
          sessionType: chartingGames.sessionType,
        })
        .from(chartingGames)
        .orderBy(desc(chartingGames.gameDate));
    } catch (error) {
      if (!isMissingChartingGameMetadataColumnError(error)) {
        throw error;
      }

      const legacyRows = await db
        .select()
        .from(legacyChartingGames)
        .orderBy(desc(legacyChartingGames.gameDate));

      return legacyRows.map((row) => mapLegacyGameRow(row));
    }
  })();
  const gameSessions = games
    .filter((game) => game.sessionType === "game")
    .map(({ sessionType: _sessionType, ...game }) => game);
  const allowedGameIds = new Set(gameSessions.map((game) => game.id));

  const segments = mapSegmentRows(
    await db
      .select()
      .from(chartingPitcherSegments)
      .orderBy(desc(chartingPitcherSegments.gameId), desc(chartingPitcherSegments.segmentOrder))
  ).filter((segment) => allowedGameIds.has(segment.gameId));

  if (segments.length === 0) {
    return [];
  }

  const plateAppearances = await loadPlateAppearancesWithFallback({
    loadCurrentRows: () =>
      db
        .select()
        .from(chartingPlateAppearances)
        .where(
          inArray(
            chartingPlateAppearances.segmentId,
            segments.map((segment) => segment.id),
          ),
        )
        .orderBy(
          desc(chartingPlateAppearances.gameId),
          desc(chartingPlateAppearances.paOrder),
        ),
    loadLegacyRows: () =>
      db
        .select()
        .from(legacyChartingPlateAppearances)
        .where(
          inArray(
            legacyChartingPlateAppearances.segmentId,
            segments.map((segment) => segment.id),
          ),
        )
        .orderBy(
          desc(legacyChartingPlateAppearances.gameId),
          desc(legacyChartingPlateAppearances.paOrder),
        ),
  });

  if (plateAppearances.length === 0) {
    return [];
  }

  const paIds = [...new Set(plateAppearances.map((plateAppearance) => plateAppearance.id))];
  const pitches =
    paIds.length > 0
      ? mapPitchRows(
          await db
            .select()
            .from(chartingPitches)
            .where(inArray(chartingPitches.paId, paIds))
            .orderBy(desc(chartingPitches.gameId), desc(chartingPitches.pitchOrder))
        )
      : [];

  const pitcherSources: PitcherComparisonDirectorySource[] = playerRegistry
    .filter((player) => player.isPitcher)
    .map((player) => ({
      slug: player.slug,
      name: player.name,
      throws: player.throws === "R" || player.throws === "L" ? player.throws : null,
    }));

  return buildPitcherComparisonDirectory({
    players: pitcherSources,
    games: gameSessions,
    segments,
    plateAppearances,
    pitches,
  });
}
