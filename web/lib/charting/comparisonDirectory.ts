import { desc, inArray } from "drizzle-orm";
import { chartingGames, chartingPitcherSegments, chartingPitches } from "@/db/schema";
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
  mapLegacyPlateAppearanceRow,
} from "./plateAppearanceStorage";
import type { ChartingPitch } from "./types";

async function getDb() {
  const { db } = await import("@/db");
  return db;
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
    await loadChartingHitterInsightsDirectory(hitterSources)
  );
}

export async function loadChartingPitcherComparisonDirectory(): Promise<
  PitcherComparisonDirectoryEntry[]
> {
  const db = await getDb();
  const games = await db
    .select({
      id: chartingGames.id,
      gameDate: chartingGames.gameDate,
      opponent: chartingGames.opponent,
    })
    .from(chartingGames)
    .orderBy(desc(chartingGames.gameDate));

  const segments = await db
    .select()
    .from(chartingPitcherSegments)
    .orderBy(desc(chartingPitcherSegments.gameId), desc(chartingPitcherSegments.segmentOrder));

  if (segments.length === 0) {
    return [];
  }

  const plateAppearances = (
    await db
      .select()
      .from(legacyChartingPlateAppearances)
      .where(
        inArray(
          legacyChartingPlateAppearances.segmentId,
          segments.map((segment) => segment.id)
        )
      )
      .orderBy(
        desc(legacyChartingPlateAppearances.gameId),
        desc(legacyChartingPlateAppearances.paOrder)
      )
  ).map(mapLegacyPlateAppearanceRow);

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
    games,
    segments,
    plateAppearances,
    pitches,
  });
}
