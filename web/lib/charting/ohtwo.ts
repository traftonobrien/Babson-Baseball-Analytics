import { desc, inArray } from "drizzle-orm";
import {
  chartingGames,
  chartingPitcherSegments,
  chartingPlateAppearances,
  chartingPitches,
} from "../../db/schema";
import {
  isMissingChartingGameMetadataColumnError,
  legacyChartingGames,
  mapLegacyGameRow,
} from "./gameStorage";
import {
  legacyChartingPlateAppearances,
  loadPlateAppearancesWithFallback,
} from "./plateAppearanceStorage";
import {
  isMissingVelocityColumnError,
  legacyChartingPitches,
  mapLegacyPitchRow,
} from "./pitchStorage";
import type {
  ChartingGame,
  ChartingPitch,
  PitchResult,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
} from "./types";

const HIT_RESULT_CODES = new Set(["1B", "2B", "3B", "HR"]);
const STRIKE_RESULTS = new Set<PitchResult>([
  "called_strike",
  "swinging_strike",
  "foul",
  "bunt_foul",
  "in_play",
]);

type BatterHand = "R" | "L" | "S" | null;
type OhTwoExecutionCategory =
  | "executedBall"
  | "executedStrike"
  | "inZoneMiss"
  | "otherMiss"
  | "untracked";

export interface OhTwoNextPitch {
  pitchType: ChartingPitch["pitchType"];
  pitchResult: ChartingPitch["pitchResult"];
  locationCell: number | null;
  countLabel: string;
  velocity: number | null;
  endedPlateAppearance: boolean;
  endedAtBat: boolean;
  recordedOut: boolean;
  wasHit: boolean;
  isStrike: boolean;
}

export interface OhTwoEvent {
  gameId: string;
  gameDate: string;
  opponent: string;
  inning: number;
  paId: string;
  paOrder: number;
  lineupSlot: number;
  pitcherId: string | null;
  pitcherName: string;
  hitterName: string;
  hitterHand: BatterHand;
  resultCode: string | null;
  pitchId: string;
  pitchOrder: number;
  locationCell: number | null;
  pitchResult: ChartingPitch["pitchResult"];
  velocity: number | null;
  executionCategory: OhTwoExecutionCategory;
  endedPlateAppearance: boolean;
  endedAtBat: boolean;
  endedHit: boolean;
  recordedOutOnPitch: boolean;
  nextPitch: OhTwoNextPitch | null;
}

export interface OhTwoExecutionSummary {
  locatedPitches: number;
  untrackedPitches: number;
  unknownHandPitches: number;
  executedBall: number;
  executedStrike: number;
  executedTotal: number;
  inZoneMisses: number;
  otherMisses: number;
  executionRate: number | null;
  executedBallRate: number | null;
  executedStrikeRate: number | null;
  inZoneMissRate: number | null;
  inZoneMissBattingAverageAgainst: number | null;
}

export interface OhTwoNextPitchTypeSummary {
  pitchType: ChartingPitch["pitchType"];
  count: number;
  share: number | null;
  strikeRate: number | null;
  outRate: number | null;
  battingAverageAgainst: number | null;
}

export interface OhTwoNextPitchSummary {
  total: number;
  fastballShare: number | null;
  breakingBallShare: number | null;
  strikeRate: number | null;
  outRate: number | null;
  battingAverageAgainst: number | null;
  twoPitchOutConversionRate: number | null;
  pitchTypeBreakdown: OhTwoNextPitchTypeSummary[];
}

export interface OhTwoReport {
  summary: {
    qualifyingPitches: number;
    locatedPitches: number;
    plateAppearancesEnded: number;
    continuedPlateAppearances: number;
    battingAverageAgainst: number | null;
  };
  locationCounts: Partial<Record<number, number>>;
  execution: OhTwoExecutionSummary;
  nextPitch: OhTwoNextPitchSummary;
  events: OhTwoEvent[];
}

async function getDb() {
  const { chartingDb } = await import("../../db");
  return chartingDb;
}

function normalizeGameSession(
  game: {
    id: string;
    gameDate: string;
    opponent: string;
    sessionType: string | null | undefined;
  },
): Pick<ChartingGame, "id" | "gameDate" | "opponent" | "sessionType"> {
  return {
    ...game,
    sessionType: game.sessionType === "live_ab" ? "live_ab" : "game",
  };
}

function normalizeSegment(
  row: typeof chartingPitcherSegments.$inferSelect,
): ChartingPitcherSegment {
  return {
    ...row,
    playerId: row.playerId ?? null,
    teamSide: row.teamSide === "our" ? "our" : "opponent",
  };
}

function normalizeBatterHand(value: string | null | undefined): BatterHand {
  return value === "R" || value === "L" || value === "S" ? value : null;
}

function normalizePitch(
  row: typeof chartingPitches.$inferSelect,
): ChartingPitch {
  return {
    ...row,
    pitchType: row.pitchType as ChartingPitch["pitchType"],
    pitchResult: row.pitchResult as ChartingPitch["pitchResult"],
  };
}

function isAtBatResult(resultCode: string | null): boolean {
  return resultCode !== null && resultCode !== "BB" && resultCode !== "HBP";
}

function countLabel(pitch: ChartingPitch): string {
  return `${pitch.ballsBefore}-${pitch.strikesBefore}`;
}

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

function isStrikeResult(result: PitchResult): boolean {
  return STRIKE_RESULTS.has(result);
}

function awayExecutionCellsForHand(hand: BatterHand): number[] {
  if (hand === "R") return [12, 14, 17];
  if (hand === "L") return [11, 13, 16];
  return [];
}

function fallbackExecutionCellsForUnknownHand(): number[] {
  return [11, 12, 13, 14, 16, 17];
}

function classifyExecution(
  locationCell: number | null,
  hitterHand: BatterHand,
  pitchResult: PitchResult,
): OhTwoExecutionCategory {
  if (locationCell === null) {
    return "untracked";
  }

  if (locationCell >= 1 && locationCell <= 9) {
    return "inZoneMiss";
  }

  const awayCells =
    hitterHand === null || hitterHand === "S"
      ? fallbackExecutionCellsForUnknownHand()
      : awayExecutionCellsForHand(hitterHand);
  if (awayCells.includes(locationCell)) {
    return isStrikeResult(pitchResult) ? "executedStrike" : "executedBall";
  }

  return "otherMiss";
}

function isFastballFamily(pitchType: ChartingPitch["pitchType"]): boolean {
  return pitchType === "Fastball";
}

export function buildOhTwoReport(params: {
  games: Pick<ChartingGame, "id" | "gameDate" | "opponent" | "sessionType">[];
  segments: Pick<ChartingPitcherSegment, "id" | "gameId" | "teamSide" | "playerId" | "displayName">[];
  plateAppearances: Pick<
    ChartingPlateAppearance,
    | "id"
    | "gameId"
    | "segmentId"
    | "paOrder"
    | "inning"
    | "teamSide"
    | "hitterName"
    | "hitterHand"
    | "lineupSlot"
    | "resultCode"
  >[];
  pitches: ChartingPitch[];
}): OhTwoReport {
  const gameById = new Map(params.games.map((game) => [game.id, game]));
  const segmentById = new Map(
    params.segments
      .filter((segment) => segment.teamSide === "our")
      .map((segment) => [segment.id, segment]),
  );

  const pitchesByPaId = new Map<string, ChartingPitch[]>();
  for (const pitch of params.pitches) {
    const existing = pitchesByPaId.get(pitch.paId) ?? [];
    existing.push(pitch);
    pitchesByPaId.set(pitch.paId, existing);
  }

  for (const pitches of pitchesByPaId.values()) {
    pitches.sort((left, right) => left.pitchOrder - right.pitchOrder);
  }

  const locationCounts: Partial<Record<number, number>> = {};
  const events: OhTwoEvent[] = [];

  for (const plateAppearance of params.plateAppearances) {
    if (plateAppearance.teamSide !== "opponent") {
      continue;
    }

    const segment = segmentById.get(plateAppearance.segmentId);
    const game = gameById.get(plateAppearance.gameId);
    if (!segment || !game || game.sessionType !== "game") {
      continue;
    }

    const paPitches = pitchesByPaId.get(plateAppearance.id) ?? [];
    const firstOhTwoIndex = paPitches.findIndex(
      (pitch) => pitch.ballsBefore === 0 && pitch.strikesBefore === 2,
    );

    if (firstOhTwoIndex < 0) {
      continue;
    }

    const firstOhTwoPitch = paPitches[firstOhTwoIndex];
    if (!firstOhTwoPitch || firstOhTwoPitch.pitchType !== "Fastball") {
      continue;
    }

    const isTerminalPitch =
      plateAppearance.resultCode !== null && firstOhTwoIndex === paPitches.length - 1;
    const isAtBat = isTerminalPitch && isAtBatResult(plateAppearance.resultCode);
    const isHit = isTerminalPitch && HIT_RESULT_CODES.has(plateAppearance.resultCode ?? "");
    const recordedOutOnPitch = isTerminalPitch && isAtBat && !isHit;
    const nextPitch = paPitches[firstOhTwoIndex + 1] ?? null;
    const hitterHand = normalizeBatterHand(plateAppearance.hitterHand);
    const executionCategory = classifyExecution(
      firstOhTwoPitch.locationCell,
      hitterHand,
      firstOhTwoPitch.pitchResult,
    );

    if (firstOhTwoPitch.locationCell !== null) {
      locationCounts[firstOhTwoPitch.locationCell] =
        (locationCounts[firstOhTwoPitch.locationCell] ?? 0) + 1;
    }

    events.push({
      gameId: game.id,
      gameDate: game.gameDate,
      opponent: game.opponent,
      inning: plateAppearance.inning,
      paId: plateAppearance.id,
      paOrder: plateAppearance.paOrder,
      lineupSlot: plateAppearance.lineupSlot,
      pitcherId: segment.playerId,
      pitcherName: segment.displayName,
      hitterName: plateAppearance.hitterName,
      hitterHand,
      resultCode: plateAppearance.resultCode,
      pitchId: firstOhTwoPitch.id,
      pitchOrder: firstOhTwoPitch.pitchOrder,
      locationCell: firstOhTwoPitch.locationCell,
      pitchResult: firstOhTwoPitch.pitchResult,
      velocity: firstOhTwoPitch.velocity,
      executionCategory,
      endedPlateAppearance: isTerminalPitch,
      endedAtBat: isAtBat,
      endedHit: isHit,
      recordedOutOnPitch,
      nextPitch: nextPitch
        ? {
            pitchType: nextPitch.pitchType,
            pitchResult: nextPitch.pitchResult,
            locationCell: nextPitch.locationCell,
            countLabel: countLabel(nextPitch),
            velocity: nextPitch.velocity,
            endedPlateAppearance:
              plateAppearance.resultCode !== null && firstOhTwoIndex + 1 === paPitches.length - 1,
            endedAtBat:
              plateAppearance.resultCode !== null &&
              firstOhTwoIndex + 1 === paPitches.length - 1 &&
              isAtBatResult(plateAppearance.resultCode),
            recordedOut:
              plateAppearance.resultCode !== null &&
              firstOhTwoIndex + 1 === paPitches.length - 1 &&
              isAtBatResult(plateAppearance.resultCode) &&
              !HIT_RESULT_CODES.has(plateAppearance.resultCode ?? ""),
            wasHit:
              plateAppearance.resultCode !== null &&
              firstOhTwoIndex + 1 === paPitches.length - 1 &&
              HIT_RESULT_CODES.has(plateAppearance.resultCode ?? ""),
            isStrike: isStrikeResult(nextPitch.pitchResult),
          }
        : null,
    });
  }

  events.sort((left, right) => {
    if (left.gameDate !== right.gameDate) {
      return right.gameDate.localeCompare(left.gameDate);
    }
    if (left.gameId !== right.gameId) {
      return right.gameId.localeCompare(left.gameId);
    }
    if (left.paOrder !== right.paOrder) {
      return right.paOrder - left.paOrder;
    }
    return right.pitchOrder - left.pitchOrder;
  });

  const endedAtBats = events.filter((event) => event.endedAtBat);
  const hitsOnEndingPitch = endedAtBats.filter((event) => event.endedHit).length;
  const locatedEvents = events.filter((event) => event.locationCell !== null);
  const executedBall = locatedEvents.filter((event) => event.executionCategory === "executedBall").length;
  const executedStrike = locatedEvents.filter((event) => event.executionCategory === "executedStrike").length;
  const executedTotal = executedBall + executedStrike;
  const inZoneMissEvents = events.filter((event) => event.executionCategory === "inZoneMiss");
  const inZoneMissEndingAtBats = inZoneMissEvents.filter((event) => event.endedAtBat);
  const inZoneMissHits = inZoneMissEndingAtBats.filter((event) => event.endedHit).length;
  const unknownHandPitches = events.filter((event) => event.hitterHand === null).length;
  const nextPitchEvents = events.filter((event) => event.nextPitch !== null);
  const nextPitchRecords = nextPitchEvents.map((event) => event.nextPitch!).filter(Boolean);
  const nextPitchTypeBreakdown = [...new Set(nextPitchRecords.map((pitch) => pitch.pitchType))]
    .sort()
    .map((pitchType) => {
      const sample = nextPitchRecords.filter((pitch) => pitch.pitchType === pitchType);
      const endedAtBatsForType = sample.filter((pitch) => pitch.endedAtBat);
      const hitsForType = endedAtBatsForType.filter((pitch) => pitch.wasHit).length;

      return {
        pitchType,
        count: sample.length,
        share: pct(sample.length, nextPitchRecords.length),
        strikeRate: pct(sample.filter((pitch) => pitch.isStrike).length, sample.length),
        outRate: pct(sample.filter((pitch) => pitch.recordedOut).length, sample.length),
        battingAverageAgainst:
          endedAtBatsForType.length > 0 ? hitsForType / endedAtBatsForType.length : null,
      } satisfies OhTwoNextPitchTypeSummary;
    })
    .sort((left, right) => right.count - left.count || left.pitchType.localeCompare(right.pitchType));
  const outsWithinTwoPitches =
    events.filter((event) => event.recordedOutOnPitch).length +
    nextPitchRecords.filter((pitch) => pitch.recordedOut).length;

  return {
    summary: {
      qualifyingPitches: events.length,
      locatedPitches: locatedEvents.length,
      plateAppearancesEnded: events.filter((event) => event.endedPlateAppearance).length,
      continuedPlateAppearances: events.filter((event) => !event.endedPlateAppearance).length,
      battingAverageAgainst:
        endedAtBats.length > 0 ? hitsOnEndingPitch / endedAtBats.length : null,
    },
    locationCounts,
    execution: {
      locatedPitches: locatedEvents.length,
      untrackedPitches: events.length - locatedEvents.length,
      unknownHandPitches,
      executedBall,
      executedStrike,
      executedTotal,
      inZoneMisses: inZoneMissEvents.length,
      otherMisses: events.filter((event) => event.executionCategory === "otherMiss").length,
      executionRate: pct(executedTotal, locatedEvents.length),
      executedBallRate: pct(executedBall, locatedEvents.length),
      executedStrikeRate: pct(executedStrike, locatedEvents.length),
      inZoneMissRate: pct(inZoneMissEvents.length, locatedEvents.length),
      inZoneMissBattingAverageAgainst:
        inZoneMissEndingAtBats.length > 0
          ? inZoneMissHits / inZoneMissEndingAtBats.length
          : null,
    },
    nextPitch: {
      total: nextPitchRecords.length,
      fastballShare: pct(
        nextPitchRecords.filter((pitch) => isFastballFamily(pitch.pitchType)).length,
        nextPitchRecords.length,
      ),
      breakingBallShare: pct(
        nextPitchRecords.filter((pitch) => !isFastballFamily(pitch.pitchType)).length,
        nextPitchRecords.length,
      ),
      strikeRate: pct(
        nextPitchRecords.filter((pitch) => pitch.isStrike).length,
        nextPitchRecords.length,
      ),
      outRate: pct(
        nextPitchRecords.filter((pitch) => pitch.recordedOut).length,
        nextPitchRecords.length,
      ),
      battingAverageAgainst: (() => {
        const endedAtBatsOnNextPitch = nextPitchRecords.filter((pitch) => pitch.endedAtBat);
        const hitsOnNextPitch = endedAtBatsOnNextPitch.filter((pitch) => pitch.wasHit).length;
        return endedAtBatsOnNextPitch.length > 0
          ? hitsOnNextPitch / endedAtBatsOnNextPitch.length
          : null;
      })(),
      twoPitchOutConversionRate: pct(outsWithinTwoPitches, events.length),
      pitchTypeBreakdown: nextPitchTypeBreakdown,
    },
    events,
  };
}

export async function loadChartingOhTwoReport(): Promise<OhTwoReport> {
  const db = await getDb();
  const games = await (async () => {
    try {
      const rows = await db
        .select({
          id: chartingGames.id,
          gameDate: chartingGames.gameDate,
          opponent: chartingGames.opponent,
          sessionType: chartingGames.sessionType,
        })
        .from(chartingGames)
        .orderBy(desc(chartingGames.gameDate));

      return rows.map(normalizeGameSession);
    } catch (error) {
      if (!isMissingChartingGameMetadataColumnError(error)) {
        throw error;
      }

      const legacyRows = await db
        .select()
        .from(legacyChartingGames)
        .orderBy(desc(legacyChartingGames.gameDate));

      return legacyRows.map((row) => normalizeGameSession(mapLegacyGameRow(row)));
    }
  })();

  const gameSessions = games.filter((game) => game.sessionType === "game");
  if (gameSessions.length === 0) {
    return buildOhTwoReport({
      games: [],
      segments: [],
      plateAppearances: [],
      pitches: [],
    });
  }

  const gameIds = gameSessions.map((game) => game.id);
  const segments = (await db
    .select()
    .from(chartingPitcherSegments)
    .where(inArray(chartingPitcherSegments.gameId, gameIds))
    .orderBy(desc(chartingPitcherSegments.gameId), desc(chartingPitcherSegments.segmentOrder)))
    .map(normalizeSegment)
    .filter((segment) => segment.teamSide === "our");

  if (segments.length === 0) {
    return buildOhTwoReport({
      games: gameSessions,
      segments: [],
      plateAppearances: [],
      pitches: [],
    });
  }

  const segmentIds = segments.map((segment) => segment.id);
  const plateAppearances = await loadPlateAppearancesWithFallback({
    loadCurrentRows: () =>
      db
        .select()
        .from(chartingPlateAppearances)
        .where(inArray(chartingPlateAppearances.segmentId, segmentIds))
        .orderBy(
          desc(chartingPlateAppearances.gameId),
          desc(chartingPlateAppearances.paOrder),
        ),
    loadLegacyRows: () =>
      db
        .select()
        .from(legacyChartingPlateAppearances)
        .where(inArray(legacyChartingPlateAppearances.segmentId, segmentIds))
        .orderBy(
          desc(legacyChartingPlateAppearances.gameId),
          desc(legacyChartingPlateAppearances.paOrder),
        ),
  });

  const paIds = [...new Set(plateAppearances.map((plateAppearance) => plateAppearance.id))];
  const pitches =
    paIds.length === 0
      ? []
      : await (async () => {
          try {
            const rows = await db
              .select()
              .from(chartingPitches)
              .where(inArray(chartingPitches.paId, paIds))
              .orderBy(desc(chartingPitches.gameId), desc(chartingPitches.pitchOrder));

            return rows.map(normalizePitch);
          } catch (error) {
            if (!isMissingVelocityColumnError(error)) {
              throw error;
            }

            const legacyRows = await db
              .select()
              .from(legacyChartingPitches)
              .where(inArray(legacyChartingPitches.paId, paIds))
              .orderBy(desc(legacyChartingPitches.gameId), desc(legacyChartingPitches.pitchOrder));

            return legacyRows.map(mapLegacyPitchRow);
          }
        })();

  return buildOhTwoReport({
    games: gameSessions,
    segments,
    plateAppearances,
    pitches,
  });
}
