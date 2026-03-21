import {
  CHARTING_PLAYER_COMPARISON_EVENTS,
  CHARTING_PLAYER_COMPARISON_METRICS,
  buildChartingPlayerComparisonPitchMix,
  buildChartingPlayerComparisonZoneBuckets,
  filterChartingPlayerComparisonPitches,
  hiddenChartingPlayerComparisonZonePitchCount,
  metricValueForChartingPlayerComparisonSummary,
  summarizeChartingPlayerComparisonPitches,
  type ChartingPlayerComparisonDirectoryEntry,
  type ChartingPlayerComparisonEventId,
  type ChartingPlayerComparisonMetricId,
  type ChartingPlayerComparisonPitchRecord,
  type ChartingPlayerComparisonPitcherHandFilter,
  type ChartingPlayerComparisonSummary,
  type ChartingPlayerComparisonVelocityRange,
} from "@/lib/charting/playerComparison";
import {
  PITCHER_COMPARISON_EVENTS,
  PITCHER_COMPARISON_METRICS,
  buildPitcherComparisonPitchMix,
  buildPitcherComparisonZoneBuckets,
  filterPitcherComparisonPitches,
  hiddenPitcherComparisonZonePitchCount,
  metricValueForPitcherComparisonSummary,
  summarizePitcherComparisonPitches,
  type PitcherComparisonDirectoryEntry,
  type PitcherComparisonEventId,
  type PitcherComparisonMetricId,
  type PitcherComparisonPitchRecord,
  type PitcherComparisonSummary,
} from "@/lib/charting/pitcherComparison";
import { comparePitchTypes } from "@/lib/pitchTypeOrder";

import {
  buildHitterExplorerQuery,
  buildPitcherExplorerQuery,
  normalizeHitterEvent,
  normalizePitcherEvent,
  type ComparisonView,
} from "../explorerState";
import type {
  Catalog,
  ComparisonEventId,
  ComparisonEventOption,
  ComparisonMetricId,
  ComparisonMetricOption,
  ComparisonPitchMixItem,
  ExplorerEntry,
  ExplorerPitch,
  ExplorerSummary,
  ExplorerZoneBucket,
} from "./types";

export const joinClasses = (
  ...values: Array<string | false | null | undefined>
): string => {
  return values.filter(Boolean).join(" ");
};

export const formatRate = (value: number | null): string => {
  if (value === null) return "—";
  return value.toFixed(3).replace(/^0(?=\.)/, "");
};

export const formatPct = (value: number | null, digits = 1): string => {
  if (value === null) return "—";
  return `${value.toFixed(digits)}%`;
};

export const formatCount = (value: number): string => {
  return new Intl.NumberFormat("en-US").format(value);
};

export const buildCatalog = (entries: ExplorerEntry[]): Catalog => {
  const seasons = [...new Set(entries.flatMap((entry) => entry.seasons))].sort(
    (left, right) => right.localeCompare(left),
  );
  const pitchTypes = [...new Set(entries.flatMap((entry) => entry.pitchTypes))].sort(
    comparePitchTypes,
  );
  const counts = [...new Set(entries.flatMap((entry) => entry.counts))].sort(
    (left, right) => {
      const [leftBalls, leftStrikes] = left.split("-").map(Number);
      const [rightBalls, rightStrikes] = right.split("-").map(Number);
      if (Number.isNaN(leftBalls) || Number.isNaN(rightBalls)) {
        return left.localeCompare(right);
      }
      if (leftBalls !== rightBalls) return leftBalls - rightBalls;
      return leftStrikes - rightStrikes;
    },
  );
  const velocityRanges = entries
    .map((entry) => entry.velocityRange)
    .filter((range): range is ChartingPlayerComparisonVelocityRange => range !== null);

  return {
    seasons,
    pitchTypes,
    counts,
    velocityRange:
      velocityRanges.length > 0
        ? {
            min: Math.min(...velocityRanges.map((range) => range.min)),
            max: Math.max(...velocityRanges.map((range) => range.max)),
          }
        : null,
  };
};

export const isPitcherView = (view: ComparisonView): boolean => view === "pitchers";

export const metricOptionsForView = (
  view: ComparisonView,
): ComparisonMetricOption[] => {
  return isPitcherView(view)
    ? PITCHER_COMPARISON_METRICS
    : CHARTING_PLAYER_COMPARISON_METRICS;
};

export const eventOptionsForView = (
  view: ComparisonView,
): ComparisonEventOption[] => {
  return isPitcherView(view)
    ? PITCHER_COMPARISON_EVENTS
    : CHARTING_PLAYER_COMPARISON_EVENTS;
};

export const defaultMetricForView = (view: ComparisonView): ComparisonMetricId => {
  return isPitcherView(view) ? "strikePct" : "avg";
};

export const formatMetricValue = (
  view: ComparisonView,
  metricId: ComparisonMetricId,
  value: number | null,
): string => {
  if (value === null) {
    return "—";
  }

  if (isPitcherView(view)) {
    if (metricId === "baa") {
      return formatRate(value);
    }

    return formatPct(value, 0);
  }

  switch (metricId) {
    case "avg":
    case "woba":
      return formatRate(value);
    case "swingPct":
    case "whiffPct":
      return formatPct(value, 0);
    default:
      return formatPct(value, 0);
  }
};

export const metricValueForSummary = (
  view: ComparisonView,
  summary: ExplorerSummary,
  metricId: ComparisonMetricId,
): number | null => {
  return isPitcherView(view)
    ? metricValueForPitcherComparisonSummary(
        summary as PitcherComparisonSummary,
        metricId as PitcherComparisonMetricId,
      )
    : metricValueForChartingPlayerComparisonSummary(
        summary as ChartingPlayerComparisonSummary,
        metricId as ChartingPlayerComparisonMetricId,
      );
};

export const summarizeExplorerPitches = (
  view: ComparisonView,
  pitches: ExplorerPitch[],
): ExplorerSummary => {
  return isPitcherView(view)
    ? summarizePitcherComparisonPitches(pitches as PitcherComparisonPitchRecord[])
    : summarizeChartingPlayerComparisonPitches(
        pitches as ChartingPlayerComparisonPitchRecord[],
      );
};

export const buildExplorerZoneBuckets = (
  view: ComparisonView,
  pitches: ExplorerPitch[],
): ExplorerZoneBucket[] => {
  return isPitcherView(view)
    ? buildPitcherComparisonZoneBuckets(pitches as PitcherComparisonPitchRecord[])
    : buildChartingPlayerComparisonZoneBuckets(
        pitches as ChartingPlayerComparisonPitchRecord[],
      );
};

export const buildExplorerPitchMix = (
  view: ComparisonView,
  pitches: ExplorerPitch[],
): ComparisonPitchMixItem[] => {
  return isPitcherView(view)
    ? buildPitcherComparisonPitchMix(pitches as PitcherComparisonPitchRecord[])
    : buildChartingPlayerComparisonPitchMix(
        pitches as ChartingPlayerComparisonPitchRecord[],
      );
};

export const hiddenExplorerZonePitchCount = (
  view: ComparisonView,
  pitches: ExplorerPitch[],
): number => {
  return isPitcherView(view)
    ? hiddenPitcherComparisonZonePitchCount(pitches as PitcherComparisonPitchRecord[])
    : hiddenChartingPlayerComparisonZonePitchCount(
        pitches as ChartingPlayerComparisonPitchRecord[],
      );
};

interface FilterExplorerPitchesArgs {
  view: ComparisonView;
  pitches: ExplorerPitch[];
  season: string | null;
  pitchType: string | null;
  count: string | null;
  event: ComparisonEventId;
  veloMin: number | null;
  veloMax: number | null;
  pitcherHand: ChartingPlayerComparisonPitcherHandFilter;
}

export const filterExplorerPitches = ({
  view,
  pitches,
  season,
  pitchType,
  count,
  event,
  veloMin,
  veloMax,
  pitcherHand,
}: FilterExplorerPitchesArgs): ExplorerPitch[] => {
  return isPitcherView(view)
    ? filterPitcherComparisonPitches(
        pitches as PitcherComparisonPitchRecord[],
        {
          season,
          pitchType,
          count,
          event: event as PitcherComparisonEventId,
          veloMin,
          veloMax,
        },
      )
    : filterChartingPlayerComparisonPitches(
        pitches as ChartingPlayerComparisonPitchRecord[],
        {
          season,
          pitcherHand,
          pitchType,
          count,
          event: event as ChartingPlayerComparisonEventId,
          veloMin,
          veloMax,
        },
      );
};

export const handLabelForEntry = (
  view: ComparisonView,
  entry: ExplorerEntry,
): string | null => {
  if (isPitcherView(view)) {
    const pitcherEntry = entry as PitcherComparisonDirectoryEntry;
    return pitcherEntry.throws ? `${pitcherEntry.throws}HP` : null;
  }

  const hitterEntry = entry as ChartingPlayerComparisonDirectoryEntry;
  return hitterEntry.batterHand ? `${hitterEntry.batterHand}HH` : null;
};

export const searchPlaceholderForView = (view: ComparisonView): string => {
  return isPitcherView(view)
    ? "Search pitcher by name or slug"
    : "Search hitter by name, slug, or charted alias";
};

export const countNounForView = (view: ComparisonView): string => {
  return isPitcherView(view) ? "pitcher" : "hitter";
};

export const heroDescriptionForView = (view: ComparisonView): string => {
  if (isPitcherView(view)) {
    return "A Babson take on the Savant player-visuals workflow, rebuilt for charted pitchers: player search, season scope, pitch-speed filters, command/result event slices, the same rough zone map, and a one-line summary table.";
  }

  return "A Babson take on the Savant player-visuals workflow, rebuilt around the charting fields we actually capture today: player search, pitcher-hand filters, season scope, pitch-speed filters, rough zone buckets, and a one-line season table.";
};

export const eventLabelForView = (
  view: ComparisonView,
  eventId: ComparisonEventId,
): string => {
  return eventOptionsForView(view).find((event) => event.id === eventId)?.label ?? eventId;
};

interface BuildExplorerHrefArgs {
  view: ComparisonView;
  pathname: string;
  playerSlug: string | null;
  pitcherHand: ChartingPlayerComparisonPitcherHandFilter;
  season: string;
  latestSeason: string | null;
  pitchType: string | null;
  count: string | null;
  event: ComparisonEventId;
  veloMin: number | null;
  veloMax: number | null;
}

export const buildExplorerHref = ({
  view,
  pathname,
  playerSlug,
  pitcherHand,
  season,
  latestSeason,
  pitchType,
  count,
  event,
  veloMin,
  veloMax,
}: BuildExplorerHrefArgs): string => {
  const params = new URLSearchParams(
    isPitcherView(view)
      ? buildPitcherExplorerQuery({
          playerSlug,
          season,
          latestSeason,
          pitchType,
          count,
          event: normalizePitcherEvent(event),
          veloMin,
          veloMax,
        })
      : buildHitterExplorerQuery({
          playerSlug,
          pitcherHand,
          season,
          latestSeason,
          pitchType,
          count,
          event: normalizeHitterEvent(event),
          veloMin,
          veloMax,
        }),
  );

  return params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
};
