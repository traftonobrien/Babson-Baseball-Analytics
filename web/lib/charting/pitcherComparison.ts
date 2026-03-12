import { getCanonicalPlayerId } from "@/lib/canonicalPlayers";
import { comparePitchTypes } from "@/lib/pitchTypeOrder";
import { pitchColor } from "@/lib/pitchColors";
import { pitchDisplayName } from "@/lib/pitchNames";
import type { PitcherHand } from "./hitterInsights";
import {
  buildComparisonZoneBuckets,
  hiddenComparisonZonePitchCount,
  zoneBucketForLocationCell,
  type ComparisonZoneBucket,
  type ComparisonZoneBucketId,
} from "./comparisonZones";
import type {
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
  PitchResult,
} from "./types";

export type PitcherComparisonMetricId = "strikePct" | "whiffPct" | "chasePct" | "baa";
export type PitcherComparisonEventId =
  | "all"
  | "calledStrikes"
  | "balls"
  | "whiffs"
  | "fouls"
  | "chases"
  | "inPlay"
  | "hits"
  | "strikeouts"
  | "freePass";

export interface PitcherComparisonMetricOption {
  id: PitcherComparisonMetricId;
  label: string;
  description: string;
  lowerBetter: boolean;
}

export interface PitcherComparisonEventOption {
  id: PitcherComparisonEventId;
  label: string;
  description: string;
}

export interface PitcherComparisonPitchRecord {
  id: string;
  paId: string;
  gameId: string;
  gameDate: string;
  opponent: string | null;
  pitchOrder: number;
  pitchType: string;
  locationCell: number | null;
  countLabel: string;
  ballsBefore: number;
  strikesBefore: number;
  velocity: number | null;
  pitchResult: PitchResult;
  isStrike: boolean;
  isCalledStrike: boolean;
  isSwing: boolean;
  isWhiff: boolean;
  isFoul: boolean;
  isBall: boolean;
  isBallInPlay: boolean;
  isInZone: boolean | null;
  terminalPlateAppearance: boolean;
  terminalAtBat: boolean;
  terminalHit: boolean;
  terminalStrikeout: boolean;
  terminalWalk: boolean;
  terminalHitByPitch: boolean;
}

export interface PitcherComparisonSummary {
  totalPitches: number;
  plateAppearances: number;
  atBats: number;
  hits: number;
  strikeouts: number;
  walks: number;
  hitByPitch: number;
  strikePct: number | null;
  zonePct: number | null;
  whiffPct: number | null;
  chasePct: number | null;
  baa: number | null;
  kPct: number | null;
  bbPct: number | null;
}

export interface PitcherComparisonPitchMixItem {
  pitchType: string;
  label: string;
  count: number;
  share: number;
  color: string;
}

export interface PitcherComparisonVelocityRange {
  min: number;
  max: number;
}

export interface PitcherComparisonDirectoryEntry {
  playerSlug: string;
  playerId: string | null;
  displayName: string;
  throws: PitcherHand;
  sessionCount: number;
  totalPitches: number;
  seasons: string[];
  pitchTypes: string[];
  counts: string[];
  velocityRange: PitcherComparisonVelocityRange | null;
  pitches: PitcherComparisonPitchRecord[];
  summary: PitcherComparisonSummary;
}

export interface PitcherComparisonFilters {
  season: string | null;
  pitchType: string | null;
  count: string | null;
  event: PitcherComparisonEventId;
  veloMin: number | null;
  veloMax: number | null;
}

export interface PitcherComparisonDirectorySource {
  slug: string;
  name: string;
  throws?: PitcherHand;
}

interface PitcherComparisonGameContext {
  id: string;
  gameDate: string;
  opponent: string | null;
}

const STRIKE_RESULTS = new Set<PitchResult>([
  "called_strike",
  "swinging_strike",
  "foul",
  "bunt_foul",
  "in_play",
]);
const SWING_RESULTS = new Set<PitchResult>([
  "swinging_strike",
  "foul",
  "bunt_foul",
  "in_play",
]);
const FOUL_RESULTS = new Set<PitchResult>(["foul", "bunt_foul"]);
const HIT_RESULT_CODES = new Set(["1B", "2B", "3B", "HR"]);

export const PITCHER_COMPARISON_METRICS: PitcherComparisonMetricOption[] = [
  {
    id: "strikePct",
    label: "Strike%",
    description: "Strike results divided by total pitches in the selected bucket.",
    lowerBetter: false,
  },
  {
    id: "whiffPct",
    label: "Whiff%",
    description: "Swinging strikes divided by swings in the selected bucket.",
    lowerBetter: false,
  },
  {
    id: "chasePct",
    label: "Chase%",
    description: "Swings on pitches outside the zone divided by all located chase pitches.",
    lowerBetter: false,
  },
  {
    id: "baa",
    label: "BAA",
    description: "Batting average against on terminal at-bats in the selected bucket.",
    lowerBetter: true,
  },
];

export const PITCHER_COMPARISON_EVENTS: PitcherComparisonEventOption[] = [
  {
    id: "all",
    label: "All Events",
    description: "Every charted pitch in scope.",
  },
  {
    id: "calledStrikes",
    label: "Called Strikes",
    description: "Only pitches charted as called strikes.",
  },
  {
    id: "balls",
    label: "Balls",
    description: "Only pitches charted as balls.",
  },
  {
    id: "whiffs",
    label: "Whiffs",
    description: "Swing-and-miss pitches only.",
  },
  {
    id: "fouls",
    label: "Fouls",
    description: "Foul-ball outcomes only.",
  },
  {
    id: "chases",
    label: "Chases",
    description: "Swings at pitches charted outside the strike zone.",
  },
  {
    id: "inPlay",
    label: "In Play",
    description: "Any pitch put in play.",
  },
  {
    id: "hits",
    label: "Hits",
    description: "Terminal pitches that ended as hits.",
  },
  {
    id: "strikeouts",
    label: "Strikeouts",
    description: "Terminal pitches that ended in a strikeout.",
  },
  {
    id: "freePass",
    label: "Walk / HBP",
    description: "Terminal walk and hit-by-pitch outcomes.",
  },
];

export const DEFAULT_PITCHER_COMPARISON_FILTERS: PitcherComparisonFilters = {
  season: null,
  pitchType: null,
  count: null,
  event: "all",
  veloMin: null,
  veloMax: null,
};

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

function seasonFromDate(gameDate: string): string | null {
  const season = gameDate.slice(0, 4);
  return /^\d{4}$/.test(season) ? season : null;
}

function compareCountLabels(left: string, right: string): number {
  const leftParts = left.split("-").map(Number);
  const rightParts = right.split("-").map(Number);

  if (leftParts.length !== 2 || rightParts.length !== 2) {
    return left.localeCompare(right);
  }

  const [leftBalls, leftStrikes] = leftParts;
  const [rightBalls, rightStrikes] = rightParts;

  if (leftBalls !== rightBalls) {
    return leftBalls - rightBalls;
  }

  return leftStrikes - rightStrikes;
}

function isStrikeout(resultCode: string | null): boolean {
  return resultCode === "K" || resultCode === "KL";
}

function isAtBat(resultCode: string | null): boolean {
  return Boolean(resultCode) && resultCode !== "BB" && resultCode !== "HBP";
}

function matchesEvent(
  pitch: PitcherComparisonPitchRecord,
  event: PitcherComparisonEventId
): boolean {
  switch (event) {
    case "calledStrikes":
      return pitch.isCalledStrike;
    case "balls":
      return pitch.isBall;
    case "whiffs":
      return pitch.isWhiff;
    case "fouls":
      return pitch.isFoul;
    case "chases":
      return pitch.isSwing && pitch.isInZone === false;
    case "inPlay":
      return pitch.isBallInPlay;
    case "hits":
      return pitch.terminalHit;
    case "strikeouts":
      return pitch.terminalStrikeout;
    case "freePass":
      return pitch.terminalWalk || pitch.terminalHitByPitch;
    case "all":
    default:
      return true;
  }
}

function metricValue(
  summary: PitcherComparisonSummary,
  metricId: PitcherComparisonMetricId
): number | null {
  switch (metricId) {
    case "strikePct":
      return summary.strikePct;
    case "whiffPct":
      return summary.whiffPct;
    case "chasePct":
      return summary.chasePct;
    case "baa":
      return summary.baa;
  }
}

function buildPitcherComparisonPitchRecord({
  pitch,
  plateAppearance,
  game,
  lastPitchId,
}: {
  pitch: ChartingPitch;
  plateAppearance: ChartingPlateAppearance;
  game: PitcherComparisonGameContext | undefined;
  lastPitchId: string | null;
}): PitcherComparisonPitchRecord {
  const resultCode = plateAppearance.resultCode;
  const isTerminalPitch = lastPitchId === pitch.id;
  const isLocated = pitch.locationCell !== null;
  const isInZone = isLocated ? pitch.locationCell! >= 1 && pitch.locationCell! <= 9 : null;

  return {
    id: pitch.id,
    paId: pitch.paId,
    gameId: pitch.gameId,
    gameDate: game?.gameDate ?? "",
    opponent: game?.opponent ?? null,
    pitchOrder: pitch.pitchOrder,
    pitchType: pitch.pitchType,
    locationCell: pitch.locationCell,
    countLabel: `${pitch.ballsBefore}-${pitch.strikesBefore}`,
    ballsBefore: pitch.ballsBefore,
    strikesBefore: pitch.strikesBefore,
    velocity: pitch.velocity,
    pitchResult: pitch.pitchResult,
    isStrike: STRIKE_RESULTS.has(pitch.pitchResult),
    isCalledStrike: pitch.pitchResult === "called_strike",
    isSwing: SWING_RESULTS.has(pitch.pitchResult),
    isWhiff: pitch.pitchResult === "swinging_strike",
    isFoul: FOUL_RESULTS.has(pitch.pitchResult),
    isBall: pitch.pitchResult === "ball",
    isBallInPlay: pitch.pitchResult === "in_play",
    isInZone,
    terminalPlateAppearance: isTerminalPitch && resultCode !== null,
    terminalAtBat: isTerminalPitch && isAtBat(resultCode),
    terminalHit: isTerminalPitch && HIT_RESULT_CODES.has(resultCode ?? ""),
    terminalStrikeout: isTerminalPitch && isStrikeout(resultCode),
    terminalWalk: isTerminalPitch && resultCode === "BB",
    terminalHitByPitch: isTerminalPitch && resultCode === "HBP",
  };
}

export function summarizePitcherComparisonPitches(
  pitches: PitcherComparisonPitchRecord[]
): PitcherComparisonSummary {
  const terminalPitches = pitches.filter((pitch) => pitch.terminalPlateAppearance);
  const atBats = terminalPitches.filter((pitch) => pitch.terminalAtBat);
  const hits = terminalPitches.filter((pitch) => pitch.terminalHit);
  const strikeouts = terminalPitches.filter((pitch) => pitch.terminalStrikeout);
  const walks = terminalPitches.filter((pitch) => pitch.terminalWalk);
  const hitByPitch = terminalPitches.filter((pitch) => pitch.terminalHitByPitch);
  const swings = pitches.filter((pitch) => pitch.isSwing);
  const whiffs = pitches.filter((pitch) => pitch.isWhiff);
  const locatedPitches = pitches.filter((pitch) => pitch.locationCell !== null);
  const chasePitches = locatedPitches.filter((pitch) => pitch.isInZone === false);
  const chaseSwings = chasePitches.filter((pitch) => pitch.isSwing);
  const strikes = pitches.filter((pitch) => pitch.isStrike);

  return {
    totalPitches: pitches.length,
    plateAppearances: terminalPitches.length,
    atBats: atBats.length,
    hits: hits.length,
    strikeouts: strikeouts.length,
    walks: walks.length,
    hitByPitch: hitByPitch.length,
    strikePct: pct(strikes.length, pitches.length),
    zonePct: pct(
      locatedPitches.filter((pitch) => pitch.isInZone === true).length,
      locatedPitches.length
    ),
    whiffPct: pct(whiffs.length, swings.length),
    chasePct: pct(chaseSwings.length, chasePitches.length),
    baa: atBats.length > 0 ? hits.length / atBats.length : null,
    kPct: pct(strikeouts.length, terminalPitches.length),
    bbPct: pct(walks.length, terminalPitches.length),
  };
}

export function buildPitcherComparisonPitchMix(
  pitches: PitcherComparisonPitchRecord[]
): PitcherComparisonPitchMixItem[] {
  const total = pitches.length;
  const counts = new Map<string, number>();

  for (const pitch of pitches) {
    counts.set(pitch.pitchType, (counts.get(pitch.pitchType) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([pitchType, count]) => ({
      pitchType,
      label: pitchDisplayName(pitchType),
      count,
      share: total > 0 ? (count / total) * 100 : 0,
      color: pitchColor(pitchType),
    }))
    .sort((left, right) => {
      const typeDiff = comparePitchTypes(left.pitchType, right.pitchType);
      if (typeDiff !== 0) {
        return typeDiff;
      }

      return right.count - left.count;
    });
}

export function buildPitcherComparisonZoneBuckets(
  pitches: PitcherComparisonPitchRecord[]
): ComparisonZoneBucket<PitcherComparisonPitchRecord, PitcherComparisonSummary>[] {
  return buildComparisonZoneBuckets(pitches, {
    getLocationCell: (pitch) => pitch.locationCell,
    summarize: summarizePitcherComparisonPitches,
  });
}

export function hiddenPitcherComparisonZonePitchCount(
  pitches: PitcherComparisonPitchRecord[]
): number {
  return hiddenComparisonZonePitchCount(pitches, (pitch) => pitch.locationCell);
}

export function filterPitcherComparisonPitches(
  pitches: PitcherComparisonPitchRecord[],
  filters: PitcherComparisonFilters
): PitcherComparisonPitchRecord[] {
  return pitches.filter((pitch) => {
    if (filters.season && seasonFromDate(pitch.gameDate) !== filters.season) {
      return false;
    }
    if (filters.pitchType && pitch.pitchType !== filters.pitchType) {
      return false;
    }
    if (filters.count && pitch.countLabel !== filters.count) {
      return false;
    }
    if (!matchesEvent(pitch, filters.event)) {
      return false;
    }
    if (filters.veloMin !== null || filters.veloMax !== null) {
      if (pitch.velocity === null) {
        return false;
      }
      if (filters.veloMin !== null && pitch.velocity < filters.veloMin) {
        return false;
      }
      if (filters.veloMax !== null && pitch.velocity > filters.veloMax) {
        return false;
      }
    }

    return true;
  });
}

export function buildPitcherComparisonDirectory({
  players,
  games,
  segments,
  plateAppearances,
  pitches,
}: {
  players: PitcherComparisonDirectorySource[];
  games: PitcherComparisonGameContext[];
  segments: ChartingPitcherSegment[];
  plateAppearances: ChartingPlateAppearance[];
  pitches: ChartingPitch[];
}): PitcherComparisonDirectoryEntry[] {
  const gameById = new Map(games.map((game) => [game.id, game]));
  const pitchesByPaId = new Map<string, ChartingPitch[]>();

  for (const pitch of pitches) {
    const group = pitchesByPaId.get(pitch.paId) ?? [];
    group.push(pitch);
    pitchesByPaId.set(pitch.paId, group);
  }

  for (const [paId, group] of pitchesByPaId.entries()) {
    pitchesByPaId.set(
      paId,
      [...group].sort((left, right) => left.pitchOrder - right.pitchOrder)
    );
  }

  return players
    .map<PitcherComparisonDirectoryEntry | null>((player) => {
      const playerId = getCanonicalPlayerId(player.slug);
      if (playerId === null) {
        return null;
      }

      const playerSegments = segments.filter((segment) => segment.playerId === playerId);
      if (playerSegments.length === 0) {
        return null;
      }

      const playerSegmentIds = new Set(playerSegments.map((segment) => segment.id));
      const playerPlateAppearances = plateAppearances
        .filter((plateAppearance) => playerSegmentIds.has(plateAppearance.segmentId))
        .sort((left, right) => left.paOrder - right.paOrder);
      if (playerPlateAppearances.length === 0) {
        return null;
      }

      const playerPitches = playerPlateAppearances.flatMap((plateAppearance) => {
        const paPitches = pitchesByPaId.get(plateAppearance.id) ?? [];
        const lastPitchId = paPitches[paPitches.length - 1]?.id ?? null;

        return paPitches.map((pitch) =>
          buildPitcherComparisonPitchRecord({
            pitch,
            plateAppearance,
            game: gameById.get(plateAppearance.gameId),
            lastPitchId,
          })
        );
      });

      if (playerPitches.length === 0) {
        return null;
      }

      const seasons = [...new Set(playerPitches.map((pitch) => seasonFromDate(pitch.gameDate)))]
        .filter((season): season is string => season !== null)
        .sort((left, right) => right.localeCompare(left));
      const pitchTypes = [...new Set(playerPitches.map((pitch) => pitch.pitchType))].sort(
        comparePitchTypes
      );
      const counts = [...new Set(playerPitches.map((pitch) => pitch.countLabel))].sort(
        compareCountLabels
      );
      const velocities = playerPitches
        .map((pitch) => pitch.velocity)
        .filter((velocity): velocity is number => velocity !== null);

      return {
        playerSlug: player.slug,
        playerId,
        displayName: player.name,
        throws: player.throws ?? null,
        sessionCount: new Set(playerSegments.map((segment) => segment.gameId)).size,
        totalPitches: playerPitches.length,
        seasons,
        pitchTypes,
        counts,
        velocityRange:
          velocities.length > 0
            ? {
                min: Math.floor(Math.min(...velocities)),
                max: Math.ceil(Math.max(...velocities)),
              }
            : null,
        pitches: playerPitches,
        summary: summarizePitcherComparisonPitches(playerPitches),
      };
    })
    .filter((entry): entry is PitcherComparisonDirectoryEntry => entry !== null)
    .sort((left, right) => {
      const sessionDiff = right.sessionCount - left.sessionCount;
      if (sessionDiff !== 0) {
        return sessionDiff;
      }

      const pitchDiff = right.totalPitches - left.totalPitches;
      if (pitchDiff !== 0) {
        return pitchDiff;
      }

      return left.displayName.localeCompare(right.displayName);
    });
}

export function metricValueForPitcherComparisonSummary(
  summary: PitcherComparisonSummary,
  metricId: PitcherComparisonMetricId
): number | null {
  return metricValue(summary, metricId);
}

export { zoneBucketForLocationCell };
export type PitcherComparisonZoneBucketId = ComparisonZoneBucketId;
