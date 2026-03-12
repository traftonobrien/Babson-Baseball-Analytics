import { comparePitchTypes } from "@/lib/pitchTypeOrder";
import { pitchColor } from "@/lib/pitchColors";
import { pitchDisplayName } from "@/lib/pitchNames";
import type {
  BatterHand,
  HitterInsightPitchRecord,
  PitcherHand,
} from "./hitterInsights";
import {
  buildComparisonZoneBuckets,
  hiddenComparisonZonePitchCount,
  zoneBucketForLocationCell,
  type ComparisonZoneBucket,
  type ComparisonZoneBucketId,
} from "./comparisonZones";
import type { ChartingHitterInsightsDirectoryEntry } from "./playerProfile";

export type ChartingPlayerComparisonMetricId =
  | "avg"
  | "woba"
  | "swingPct"
  | "whiffPct";
export type ChartingPlayerComparisonEventId =
  | "all"
  | "hits"
  | "inPlay"
  | "strikeouts"
  | "freePass"
  | "whiffs"
  | "fouls"
  | "chases";
export type ChartingPlayerComparisonZoneBucketId = ComparisonZoneBucketId;

export interface ChartingPlayerComparisonMetricOption {
  id: ChartingPlayerComparisonMetricId;
  label: string;
  description: string;
  lowerBetter: boolean;
}

export interface ChartingPlayerComparisonEventOption {
  id: ChartingPlayerComparisonEventId;
  label: string;
  description: string;
}

export type ChartingPlayerComparisonPitcherHandFilter = "all" | "R" | "L";

export interface ChartingPlayerComparisonPitcherHandOption {
  id: ChartingPlayerComparisonPitcherHandFilter;
  label: string;
}

export interface ChartingPlayerComparisonPitchRecord {
  id: string;
  paId: string;
  gameId: string;
  gameDate: string;
  opponent: string | null;
  pitcherHand: PitcherHand;
  pitchOrder: number;
  pitchType: string;
  locationCell: number | null;
  countLabel: string;
  ballsBefore: number;
  strikesBefore: number;
  velocity: number | null;
  isSwing: boolean;
  isWhiff: boolean;
  isTake: boolean;
  isFoul: boolean;
  isBallInPlay: boolean;
  isInZone: boolean | null;
  outcomeCategory: HitterInsightPitchRecord["outcomeCategory"];
  outcomeLabel: string;
  terminalPlateAppearance: boolean;
  terminalAtBat: boolean;
  terminalHit: boolean;
  terminalExtraBaseHit: boolean;
  terminalOnBase: boolean;
  terminalBases: number;
  wobaWeight: number;
}

export interface ChartingPlayerComparisonSummary {
  totalPitches: number;
  plateAppearances: number;
  atBats: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  strikeouts: number;
  walks: number;
  hitByPitch: number;
  battingAverage: number | null;
  strikeoutRate: number | null;
  woba: number | null;
  swings: number;
  whiffs: number;
  swingPct: number | null;
  whiffPct: number | null;
}

export interface ChartingPlayerComparisonPitchMixItem {
  pitchType: string;
  label: string;
  count: number;
  share: number;
  color: string;
}

export type ChartingPlayerComparisonZoneBucket = ComparisonZoneBucket<
  ChartingPlayerComparisonPitchRecord,
  ChartingPlayerComparisonSummary
>;

export interface ChartingPlayerComparisonVelocityRange {
  min: number;
  max: number;
}

export interface ChartingPlayerComparisonDirectoryEntry {
  playerSlug: string;
  playerId: string | null;
  displayName: string;
  batterHand: BatterHand;
  matchedHitterNames: string[];
  sessionCount: number;
  totalPitches: number;
  seasons: string[];
  pitchTypes: string[];
  counts: string[];
  velocityRange: ChartingPlayerComparisonVelocityRange | null;
  pitches: ChartingPlayerComparisonPitchRecord[];
  summary: ChartingPlayerComparisonSummary;
}

export interface ChartingPlayerComparisonFilters {
  season: string | null;
  pitcherHand: ChartingPlayerComparisonPitcherHandFilter;
  pitchType: string | null;
  count: string | null;
  event: ChartingPlayerComparisonEventId;
  veloMin: number | null;
  veloMax: number | null;
}

export const DEFAULT_CHARTING_PLAYER_COMPARISON_FILTERS: ChartingPlayerComparisonFilters = {
  season: null,
  pitcherHand: "all",
  pitchType: null,
  count: null,
  event: "all",
  veloMin: null,
  veloMax: null,
};

export const CHARTING_PLAYER_COMPARISON_METRICS: ChartingPlayerComparisonMetricOption[] = [
  {
    id: "woba",
    label: "wOBA",
    description: "Weighted on-base value for the selected bucket.",
    lowerBetter: false,
  },
  {
    id: "avg",
    label: "AVG",
    description: "Batting average on terminal at-bats inside the selected bucket.",
    lowerBetter: false,
  },
  {
    id: "swingPct",
    label: "Swing%",
    description: "Swings divided by total pitches in the selected bucket.",
    lowerBetter: false,
  },
  {
    id: "whiffPct",
    label: "Whiff%",
    description: "Swing-and-miss rate on swings inside the selected bucket.",
    lowerBetter: true,
  },
];

export const CHARTING_PLAYER_COMPARISON_EVENTS: ChartingPlayerComparisonEventOption[] = [
  {
    id: "all",
    label: "All Events",
    description: "Every charted pitch in scope.",
  },
  {
    id: "hits",
    label: "Hits",
    description: "Pitches that finished singles, doubles, triples, or homers.",
  },
  {
    id: "inPlay",
    label: "In Play",
    description: "Any charted pitch put in play.",
  },
  {
    id: "strikeouts",
    label: "Strikeouts",
    description: "Terminal pitches that ended the plate appearance in a strikeout.",
  },
  {
    id: "freePass",
    label: "Walk / HBP",
    description: "Terminal free-pass outcomes.",
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
];

export const CHARTING_PLAYER_COMPARISON_PITCHER_HAND_OPTIONS: ChartingPlayerComparisonPitcherHandOption[] = [
  { id: "all", label: "All pitchers" },
  { id: "R", label: "vs RHP" },
  { id: "L", label: "vs LHP" },
];

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

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

function metricValue(
  summary: ChartingPlayerComparisonSummary,
  metricId: ChartingPlayerComparisonMetricId
): number | null {
  switch (metricId) {
    case "avg":
      return summary.battingAverage;
    case "woba":
      return summary.woba;
    case "swingPct":
      return summary.swingPct;
    case "whiffPct":
      return summary.whiffPct;
  }
}

function matchesEvent(
  pitch: ChartingPlayerComparisonPitchRecord,
  event: ChartingPlayerComparisonEventId
): boolean {
  switch (event) {
    case "hits":
      return pitch.terminalHit;
    case "inPlay":
      return pitch.isBallInPlay;
    case "strikeouts":
      return pitch.outcomeCategory === "strikeout";
    case "freePass":
      return pitch.outcomeCategory === "walk" || pitch.outcomeCategory === "hitByPitch";
    case "whiffs":
      return pitch.isWhiff;
    case "fouls":
      return pitch.isFoul;
    case "chases":
      return pitch.isSwing && pitch.isInZone === false;
    case "all":
    default:
      return true;
  }
}

function mapComparisonPitch(
  pitch: HitterInsightPitchRecord
): ChartingPlayerComparisonPitchRecord {
  return {
    id: pitch.id,
    paId: pitch.paId,
    gameId: pitch.gameId,
    gameDate: pitch.gameDate,
    opponent: pitch.opponent,
    pitcherHand: pitch.pitcherHand,
    pitchOrder: pitch.pitchOrder,
    pitchType: pitch.pitchType,
    locationCell: pitch.locationCell,
    countLabel: pitch.countLabel,
    ballsBefore: pitch.ballsBefore,
    strikesBefore: pitch.strikesBefore,
    velocity: pitch.velocity,
    isSwing: pitch.isSwing,
    isWhiff: pitch.isWhiff,
    isTake: pitch.isTake,
    isFoul: pitch.isFoul,
    isBallInPlay: pitch.isBallInPlay,
    isInZone: pitch.isInZone,
    outcomeCategory: pitch.outcomeCategory,
    outcomeLabel: pitch.outcomeLabel,
    terminalPlateAppearance: pitch.terminalPlateAppearance,
    terminalAtBat: pitch.terminalAtBat,
    terminalHit: pitch.terminalHit,
    terminalExtraBaseHit: pitch.terminalExtraBaseHit,
    terminalOnBase: pitch.terminalOnBase,
    terminalBases: pitch.terminalBases,
    wobaWeight: pitch.wobaWeight,
  };
}

export function summarizeChartingPlayerComparisonPitches(
  pitches: ChartingPlayerComparisonPitchRecord[]
): ChartingPlayerComparisonSummary {
  const terminalPitches = pitches.filter((pitch) => pitch.terminalPlateAppearance);
  const atBats = terminalPitches.filter((pitch) => pitch.terminalAtBat);
  const hits = terminalPitches.filter((pitch) => pitch.terminalHit);
  const walks = terminalPitches.filter((pitch) => pitch.outcomeCategory === "walk");
  const hitByPitch = terminalPitches.filter(
    (pitch) => pitch.outcomeCategory === "hitByPitch"
  );
  const strikeouts = terminalPitches.filter(
    (pitch) => pitch.outcomeCategory === "strikeout"
  );
  const wobaDenominator = terminalPitches.filter(
    (pitch) =>
      pitch.terminalAtBat ||
      pitch.outcomeCategory === "walk" ||
      pitch.outcomeCategory === "hitByPitch"
  );
  const wobaNumerator = terminalPitches.reduce((sum, pitch) => sum + pitch.wobaWeight, 0);
  const swings = pitches.filter((pitch) => pitch.isSwing).length;
  const whiffs = pitches.filter((pitch) => pitch.isWhiff).length;

  return {
    totalPitches: pitches.length,
    plateAppearances: terminalPitches.length,
    atBats: atBats.length,
    hits: hits.length,
    singles: terminalPitches.filter((pitch) => pitch.outcomeCategory === "single").length,
    doubles: terminalPitches.filter((pitch) => pitch.outcomeCategory === "double").length,
    triples: terminalPitches.filter((pitch) => pitch.outcomeCategory === "triple").length,
    homeRuns: terminalPitches.filter((pitch) => pitch.outcomeCategory === "homeRun").length,
    strikeouts: strikeouts.length,
    walks: walks.length,
    hitByPitch: hitByPitch.length,
    battingAverage: atBats.length > 0 ? hits.length / atBats.length : null,
    strikeoutRate: pct(strikeouts.length, terminalPitches.length),
    woba: wobaDenominator.length > 0 ? wobaNumerator / wobaDenominator.length : null,
    swings,
    whiffs,
    swingPct: pct(swings, pitches.length),
    whiffPct: pct(whiffs, swings),
  };
}

export function buildChartingPlayerComparisonPitchMix(
  pitches: ChartingPlayerComparisonPitchRecord[]
): ChartingPlayerComparisonPitchMixItem[] {
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
      if (typeDiff !== 0) return typeDiff;
      return right.count - left.count;
    });
}

export function buildChartingPlayerComparisonZoneBuckets(
  pitches: ChartingPlayerComparisonPitchRecord[]
): ChartingPlayerComparisonZoneBucket[] {
  return buildComparisonZoneBuckets(pitches, {
    getLocationCell: (pitch) => pitch.locationCell,
    summarize: summarizeChartingPlayerComparisonPitches,
  });
}

export function hiddenChartingPlayerComparisonZonePitchCount(
  pitches: ChartingPlayerComparisonPitchRecord[]
): number {
  return hiddenComparisonZonePitchCount(pitches, (pitch) => pitch.locationCell);
}

export function filterChartingPlayerComparisonPitches(
  pitches: ChartingPlayerComparisonPitchRecord[],
  filters: ChartingPlayerComparisonFilters
): ChartingPlayerComparisonPitchRecord[] {
  return pitches.filter((pitch) => {
    if (filters.season && seasonFromDate(pitch.gameDate) !== filters.season) {
      return false;
    }
    if (filters.pitcherHand !== "all" && pitch.pitcherHand !== filters.pitcherHand) {
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

export function buildChartingPlayerComparisonDirectory(
  entries: ChartingHitterInsightsDirectoryEntry[]
): ChartingPlayerComparisonDirectoryEntry[] {
  return entries.map((entry) => {
    const pitches = entry.insights.pitches.map(mapComparisonPitch);
    const seasons = [...new Set(pitches.map((pitch) => seasonFromDate(pitch.gameDate)))]
      .filter((season): season is string => season !== null)
      .sort((left, right) => right.localeCompare(left));
    const pitchTypes = [...new Set(pitches.map((pitch) => pitch.pitchType))].sort(
      comparePitchTypes
    );
    const counts = [...new Set(pitches.map((pitch) => pitch.countLabel))].sort(compareCountLabels);
    const velocities = pitches
      .map((pitch) => pitch.velocity)
      .filter((velocity): velocity is number => velocity !== null);

    return {
      playerSlug: entry.playerSlug,
      playerId: entry.playerId,
      displayName: entry.displayName,
      batterHand: entry.batterHand,
      matchedHitterNames: entry.matchedHitterNames,
      sessionCount: entry.sessionCount,
      totalPitches: entry.pitchCount,
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
      pitches,
      summary: summarizeChartingPlayerComparisonPitches(pitches),
    } satisfies ChartingPlayerComparisonDirectoryEntry;
  });
}

export function metricValueForChartingPlayerComparisonSummary(
  summary: ChartingPlayerComparisonSummary,
  metricId: ChartingPlayerComparisonMetricId
): number | null {
  return metricValue(summary, metricId);
}

export { zoneBucketForLocationCell };
