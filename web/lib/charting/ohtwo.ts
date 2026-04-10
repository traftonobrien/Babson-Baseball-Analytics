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

// ---------------------------------------------------------------------------
// Core event types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Execution summary
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Next pitch summary
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// PA Outcomes — full plate-appearance result when we reach 0-2 on a fastball
// ---------------------------------------------------------------------------

export interface OhTwoPaOutcomes {
  /** Total qualifying PAs (= events.length) */
  total: number;
  /** PAs with a resolved resultCode */
  closedTotal: number;
  strikeouts: number;
  walks: number;
  hbp: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  /** In-play outs that are not strikeouts */
  contactOuts: number;
  /** PAs still open (no resultCode) */
  openPAs: number;
  /** K / closedTotal */
  strikeoutRate: number | null;
  /** BB / closedTotal */
  walkRate: number | null;
  /** hits / atBats */
  battingAverage: number | null;
  /** total bases / atBats */
  slugging: number | null;
  /** (hits + BB + HBP) / (atBats + BB + HBP) */
  obp: number | null;
  /** obp + slugging */
  ops: number | null;
  totalBases: number;
  /** K% − BB% in percentage points */
  kMinusBB: number | null;
}

// ---------------------------------------------------------------------------
// 0-2 Fastball pitch-result breakdown (what happened on the pitch itself)
// ---------------------------------------------------------------------------

export interface OhTwoPitchResultBreakdown {
  total: number;
  calledStrike: number;
  swingingStrike: number;
  foul: number;
  /** Ball — hitter took and lived on */
  ball: number;
  inPlay: number;
  hitByPitch: number;
  calledStrikeRate: number | null;
  /** Whiff rate */
  swingingStrikeRate: number | null;
  foulRate: number | null;
  /** "Escape rate" — pitcher threw ball, count goes to 1-2 */
  ballRate: number | null;
  inPlayRate: number | null;
  /** called + swinging + foul + in_play */
  strikeRate: number | null;
}

// ---------------------------------------------------------------------------
// Velocity analysis for the 0-2 fastball
// ---------------------------------------------------------------------------

export interface OhTwoVelocityStats {
  avg: number | null;
  max: number | null;
  min: number | null;
  /** Pitches with a gun reading */
  tracked: number;
  untracked: number;
}

// ---------------------------------------------------------------------------
// Per-pitcher breakdown
// ---------------------------------------------------------------------------

export interface OhTwoPitcherEntry {
  pitcherId: string | null;
  pitcherName: string;
  /** Total qualifying 0-2 fastballs thrown */
  count: number;
  executionRate: number | null;
  /** K / closed PAs */
  strikeoutRate: number | null;
  /** BB / closed PAs */
  walkRate: number | null;
  battingAverageAgainst: number | null;
  avgVelocity: number | null;
}

// ---------------------------------------------------------------------------
// Per-opponent breakdown
// ---------------------------------------------------------------------------

export interface OhTwoOpponentEntry {
  opponent: string;
  count: number;
  strikeoutRate: number | null;
  battingAverageAgainst: number | null;
}

// ---------------------------------------------------------------------------
// Inning distribution
// ---------------------------------------------------------------------------

export interface OhTwoInningEntry {
  inning: number;
  count: number;
  share: number | null;
}

// ---------------------------------------------------------------------------
// Full report shape
// ---------------------------------------------------------------------------

export interface OhTwoReport {
  summary: {
    qualifyingPitches: number;
    locatedPitches: number;
    plateAppearancesEnded: number;
    continuedPlateAppearances: number;
    /** BAA only on 0-2 FBs that ended the at-bat */
    battingAverageAgainst: number | null;
  };
  locationCounts: Partial<Record<number, number>>;
  execution: OhTwoExecutionSummary;
  nextPitch: OhTwoNextPitchSummary;
  /** Full PA outcomes for every qualifying PA */
  paOutcomes: OhTwoPaOutcomes;
  /** Pitch-level result breakdown for the 0-2 fastball itself */
  pitchResults: OhTwoPitchResultBreakdown;
  /** Velocity stats for the qualifying 0-2 fastballs */
  velocity: OhTwoVelocityStats;
  /** Sorted descending by count */
  byPitcher: OhTwoPitcherEntry[];
  /** Sorted descending by count */
  byOpponent: OhTwoOpponentEntry[];
  /** Sorted ascending by inning */
  inningDistribution: OhTwoInningEntry[];
  events: OhTwoEvent[];
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

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

function isStrikeout(resultCode: string | null): boolean {
  if (!resultCode) return false;
  return resultCode.toUpperCase().startsWith("K");
}

function isWalk(resultCode: string | null): boolean {
  return resultCode === "BB";
}

function isHbp(resultCode: string | null): boolean {
  return resultCode === "HBP";
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

function avgFromNumbers(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

// ---------------------------------------------------------------------------
// Core builder — takes pre-fetched data, returns the full report
// ---------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Existing aggregates (execution + summary + next pitch)
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // PA Outcomes — full PA result for every qualifying PA
  // -------------------------------------------------------------------------

  const closedEvents = events.filter((e) => e.resultCode !== null);
  const paStrikeouts = closedEvents.filter((e) => isStrikeout(e.resultCode));
  const paWalks = closedEvents.filter((e) => isWalk(e.resultCode));
  const paHbp = closedEvents.filter((e) => isHbp(e.resultCode));
  const paSingles = closedEvents.filter((e) => e.resultCode === "1B");
  const paDoubles = closedEvents.filter((e) => e.resultCode === "2B");
  const paTriples = closedEvents.filter((e) => e.resultCode === "3B");
  const paHRs = closedEvents.filter((e) => e.resultCode === "HR");
  const paHits = closedEvents.filter((e) => HIT_RESULT_CODES.has(e.resultCode ?? ""));
  const paAtBats = closedEvents.filter((e) => isAtBatResult(e.resultCode));
  const paContactOuts = paAtBats.filter(
    (e) => !HIT_RESULT_CODES.has(e.resultCode ?? "") && !isStrikeout(e.resultCode),
  );
  const paTotalBases =
    paSingles.length +
    2 * paDoubles.length +
    3 * paTriples.length +
    4 * paHRs.length;

  const paBA = paAtBats.length > 0 ? paHits.length / paAtBats.length : null;
  const paSLG = paAtBats.length > 0 ? paTotalBases / paAtBats.length : null;
  const paOBPDenom = paAtBats.length + paWalks.length + paHbp.length;
  const paOBP =
    paOBPDenom > 0
      ? (paHits.length + paWalks.length + paHbp.length) / paOBPDenom
      : null;
  const paOPS = paOBP !== null && paSLG !== null ? paOBP + paSLG : null;
  const paKRate = pct(paStrikeouts.length, closedEvents.length);
  const paBBRate = pct(paWalks.length, closedEvents.length);

  // -------------------------------------------------------------------------
  // Pitch-level result breakdown (on the 0-2 fastball itself)
  // -------------------------------------------------------------------------

  const prCalledStrike = events.filter((e) => e.pitchResult === "called_strike").length;
  const prSwingingStrike = events.filter((e) => e.pitchResult === "swinging_strike").length;
  const prFoul = events.filter((e) => e.pitchResult === "foul" || e.pitchResult === "bunt_foul").length;
  const prBall = events.filter((e) => e.pitchResult === "ball").length;
  const prInPlay = events.filter((e) => e.pitchResult === "in_play").length;
  const prHbp = events.filter((e) => e.pitchResult === "hit_by_pitch").length;
  const prTotal = events.length;
  const prTotalStrikes = prCalledStrike + prSwingingStrike + prFoul + prInPlay;

  // -------------------------------------------------------------------------
  // Velocity
  // -------------------------------------------------------------------------

  const veloTracked = events.filter((e) => e.velocity !== null);
  const velocities = veloTracked.map((e) => e.velocity as number);

  // -------------------------------------------------------------------------
  // By Pitcher
  // -------------------------------------------------------------------------

  const pitcherMap = new Map<string, OhTwoEvent[]>();
  for (const event of events) {
    const key = `${event.pitcherId ?? ""}__${event.pitcherName}`;
    const existing = pitcherMap.get(key) ?? [];
    existing.push(event);
    pitcherMap.set(key, existing);
  }

  const byPitcher: OhTwoPitcherEntry[] = [...pitcherMap.values()]
    .map((pitcherEvents) => {
      const locatedPitcherEvents = pitcherEvents.filter((e) => e.locationCell !== null);
      const executedPitcherEvents = locatedPitcherEvents.filter(
        (e) => e.executionCategory === "executedBall" || e.executionCategory === "executedStrike",
      );
      const closedPitcherEvents = pitcherEvents.filter((e) => e.resultCode !== null);
      const atBatPitcherEvents = closedPitcherEvents.filter((e) => isAtBatResult(e.resultCode));
      const hitPitcherEvents = atBatPitcherEvents.filter((e) =>
        HIT_RESULT_CODES.has(e.resultCode ?? ""),
      );
      const pitcherVelos = pitcherEvents
        .filter((e) => e.velocity !== null)
        .map((e) => e.velocity as number);
      const first = pitcherEvents[0]!;

      return {
        pitcherId: first.pitcherId,
        pitcherName: first.pitcherName,
        count: pitcherEvents.length,
        executionRate:
          locatedPitcherEvents.length > 0
            ? pct(executedPitcherEvents.length, locatedPitcherEvents.length)
            : null,
        strikeoutRate:
          closedPitcherEvents.length > 0
            ? pct(
                closedPitcherEvents.filter((e) => isStrikeout(e.resultCode)).length,
                closedPitcherEvents.length,
              )
            : null,
        walkRate:
          closedPitcherEvents.length > 0
            ? pct(
                closedPitcherEvents.filter((e) => isWalk(e.resultCode)).length,
                closedPitcherEvents.length,
              )
            : null,
        battingAverageAgainst:
          atBatPitcherEvents.length > 0
            ? hitPitcherEvents.length / atBatPitcherEvents.length
            : null,
        avgVelocity: avgFromNumbers(pitcherVelos),
      };
    })
    .sort((a, b) => b.count - a.count);

  // -------------------------------------------------------------------------
  // By Opponent
  // -------------------------------------------------------------------------

  const opponentMap = new Map<string, OhTwoEvent[]>();
  for (const event of events) {
    const existing = opponentMap.get(event.opponent) ?? [];
    existing.push(event);
    opponentMap.set(event.opponent, existing);
  }

  const byOpponent: OhTwoOpponentEntry[] = [...opponentMap.values()]
    .map((oppEvents) => {
      const closedOppEvents = oppEvents.filter((e) => e.resultCode !== null);
      const atBatOppEvents = closedOppEvents.filter((e) => isAtBatResult(e.resultCode));
      const hitOppEvents = atBatOppEvents.filter((e) =>
        HIT_RESULT_CODES.has(e.resultCode ?? ""),
      );
      const first = oppEvents[0]!;

      return {
        opponent: first.opponent,
        count: oppEvents.length,
        strikeoutRate:
          closedOppEvents.length > 0
            ? pct(
                closedOppEvents.filter((e) => isStrikeout(e.resultCode)).length,
                closedOppEvents.length,
              )
            : null,
        battingAverageAgainst:
          atBatOppEvents.length > 0 ? hitOppEvents.length / atBatOppEvents.length : null,
      };
    })
    .sort((a, b) => b.count - a.count);

  // -------------------------------------------------------------------------
  // Inning Distribution
  // -------------------------------------------------------------------------

  const inningMap = new Map<number, number>();
  for (const event of events) {
    inningMap.set(event.inning, (inningMap.get(event.inning) ?? 0) + 1);
  }

  const inningDistribution: OhTwoInningEntry[] = [...inningMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([inning, count]) => ({
      inning,
      count,
      share: pct(count, events.length),
    }));

  // -------------------------------------------------------------------------
  // Assemble report
  // -------------------------------------------------------------------------

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
    paOutcomes: {
      total: events.length,
      closedTotal: closedEvents.length,
      strikeouts: paStrikeouts.length,
      walks: paWalks.length,
      hbp: paHbp.length,
      singles: paSingles.length,
      doubles: paDoubles.length,
      triples: paTriples.length,
      homeRuns: paHRs.length,
      contactOuts: paContactOuts.length,
      openPAs: events.length - closedEvents.length,
      strikeoutRate: paKRate,
      walkRate: paBBRate,
      battingAverage: paBA,
      slugging: paSLG,
      obp: paOBP,
      ops: paOPS,
      totalBases: paTotalBases,
      kMinusBB:
        paKRate !== null && paBBRate !== null ? paKRate - paBBRate : null,
    },
    pitchResults: {
      total: prTotal,
      calledStrike: prCalledStrike,
      swingingStrike: prSwingingStrike,
      foul: prFoul,
      ball: prBall,
      inPlay: prInPlay,
      hitByPitch: prHbp,
      calledStrikeRate: pct(prCalledStrike, prTotal),
      swingingStrikeRate: pct(prSwingingStrike, prTotal),
      foulRate: pct(prFoul, prTotal),
      ballRate: pct(prBall, prTotal),
      inPlayRate: pct(prInPlay, prTotal),
      strikeRate: pct(prTotalStrikes, prTotal),
    },
    velocity: {
      avg: avgFromNumbers(velocities),
      max: velocities.length > 0 ? Math.max(...velocities) : null,
      min: velocities.length > 0 ? Math.min(...velocities) : null,
      tracked: veloTracked.length,
      untracked: events.length - veloTracked.length,
    },
    byPitcher,
    byOpponent,
    inningDistribution,
    events,
  };
}

// ---------------------------------------------------------------------------
// Data loader — fetches everything from Supabase and calls buildOhTwoReport
// ---------------------------------------------------------------------------

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
