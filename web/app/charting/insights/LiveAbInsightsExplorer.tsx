"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardList,
  Crosshair,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import {
  LeaderboardHero,
  LeaderboardIntro,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardStatBlock,
  LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";
import {
  CHARTING_PLAYER_COMPARISON_EVENTS,
  CHARTING_PLAYER_COMPARISON_METRICS,
  CHARTING_PLAYER_COMPARISON_PITCHER_HAND_OPTIONS,
  buildChartingPlayerComparisonPitchMix,
  buildChartingPlayerComparisonZoneBuckets,
  filterChartingPlayerComparisonPitches,
  hiddenChartingPlayerComparisonZonePitchCount,
  metricValueForChartingPlayerComparisonSummary,
  summarizeChartingPlayerComparisonPitches,
  type ChartingPlayerComparisonPitchRecord,
  type ChartingPlayerComparisonDirectoryEntry,
  type ChartingPlayerComparisonEventId,
  type ChartingPlayerComparisonMetricId,
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
  type PitcherComparisonPitchMixItem,
  type PitcherComparisonPitchRecord,
  type PitcherComparisonSummary,
} from "@/lib/charting/pitcherComparison";
import { clipPathForLocationCell } from "@/lib/charting/locationGrid";
import { config } from "@/lib/config";
import { comparePitchTypes } from "@/lib/pitchTypeOrder";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { SIZE, toSvg } from "@/app/components/ZoneOverlay";
import {
  buildHitterExplorerQuery,
  buildPitcherExplorerQuery,
  normalizeHitterEvent,
  normalizePitcherEvent,
  normalizePitcherHandFilter,
  readHitterExplorerQuery,
  readPitcherExplorerQuery,
  type ComparisonView,
} from "./explorerState";
import type { ComparisonZoneBucketId } from "@/lib/charting/comparisonZones";

type Catalog = {
  seasons: string[];
  pitchTypes: string[];
  counts: string[];
  velocityRange: ChartingPlayerComparisonVelocityRange | null;
};

type ZoneDisplayMode = "heatmap" | "sections";
type ComparisonMetricId = ChartingPlayerComparisonMetricId | PitcherComparisonMetricId;
type ComparisonEventId = ChartingPlayerComparisonEventId | PitcherComparisonEventId;
type ExplorerEntry = ChartingPlayerComparisonDirectoryEntry | PitcherComparisonDirectoryEntry;
type ExplorerPitch = ChartingPlayerComparisonPitchRecord | PitcherComparisonPitchRecord;
type ExplorerSummary = ChartingPlayerComparisonSummary | PitcherComparisonSummary;
type ExplorerZoneBucket = {
  id: ComparisonZoneBucketId;
  label: string;
  placement: "chase" | "zone";
  cellIds: number[];
  pitches: ExplorerPitch[];
  summary: ExplorerSummary;
};
type ComparisonMetricOption = {
  id: ComparisonMetricId;
  label: string;
  description: string;
  lowerBetter: boolean;
};
type ComparisonEventOption = {
  id: ComparisonEventId;
  label: string;
  description: string;
};
type ComparisonPitchMixItem = ReturnType<typeof buildChartingPlayerComparisonPitchMix>[number] | PitcherComparisonPitchMixItem;

const SEARCH_RESULT_LIMIT = 8;

const ZONE_BUCKET_LAYOUT: Record<
  ComparisonZoneBucketId,
  {
    label: string;
    caption: string;
    style: CSSProperties;
    strikeZone?: boolean;
    chaseKind?: "topLeftCorner" | "topRightCorner" | "bottomLeftCorner" | "bottomRightCorner";
  }
> = {
  chaseUpperLeft: {
    label: "Chase UL",
    caption: "Upper-left chase",
    style: { left: "6%", top: "6%", width: "30%", height: "30%" },
    chaseKind: "topLeftCorner",
  },
  chaseUpperRight: {
    label: "Chase UR",
    caption: "Upper-right chase",
    style: { right: "6%", top: "6%", width: "30%", height: "30%" },
    chaseKind: "topRightCorner",
  },
  chaseLowerLeft: {
    label: "Chase LL",
    caption: "Lower-left chase",
    style: { left: "6%", bottom: "6%", width: "30%", height: "30%" },
    chaseKind: "bottomLeftCorner",
  },
  chaseLowerRight: {
    label: "Chase LR",
    caption: "Lower-right chase",
    style: { right: "6%", bottom: "6%", width: "30%", height: "30%" },
    chaseKind: "bottomRightCorner",
  },
  upperLeft: {
    label: "Upper Left",
    caption: "Cells 1 + 2",
    strikeZone: true,
    style: { left: "23%", top: "23%", width: "27%", height: "27%" },
  },
  upperRight: {
    label: "Upper Right",
    caption: "Cells 3 + 6",
    strikeZone: true,
    style: { left: "50%", top: "23%", width: "27%", height: "27%" },
  },
  lowerLeft: {
    label: "Lower Left",
    caption: "Cells 4 + 7",
    strikeZone: true,
    style: { left: "23%", top: "50%", width: "27%", height: "27%" },
  },
  lowerRight: {
    label: "Lower Right",
    caption: "Cells 8 + 9",
    strikeZone: true,
    style: { left: "50%", top: "50%", width: "27%", height: "27%" },
  },
  heart: {
    label: "Heart",
    caption: "Cell 5",
    strikeZone: true,
    style: {
      left: "50%",
      top: "50%",
      width: "22%",
      height: "22%",
      transform: "translate(-50%, -50%)",
    },
  },
};

const HEAT_BUCKET_SHAPES: Record<
  ComparisonZoneBucketId,
  {
    kind: "ellipse" | "rect";
    cx?: number;
    cy?: number;
    rx?: number;
    ry?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    radius?: number;
  }
> = {
  chaseUpperLeft: { kind: "ellipse", cx: 106, cy: 96, rx: 56, ry: 64 },
  chaseUpperRight: { kind: "ellipse", cx: 214, cy: 96, rx: 56, ry: 64 },
  chaseLowerLeft: { kind: "ellipse", cx: 106, cy: 228, rx: 58, ry: 68 },
  chaseLowerRight: { kind: "ellipse", cx: 214, cy: 228, rx: 58, ry: 68 },
  upperLeft: { kind: "ellipse", cx: 124, cy: 122, rx: 48, ry: 40 },
  upperRight: { kind: "ellipse", cx: 194, cy: 128, rx: 48, ry: 42 },
  lowerLeft: { kind: "ellipse", cx: 124, cy: 194, rx: 54, ry: 48 },
  lowerRight: { kind: "ellipse", cx: 200, cy: 198, rx: 54, ry: 48 },
  heart: { kind: "ellipse", cx: 160, cy: 164, rx: 30, ry: 30 },
};

const ZONE_SECTION_GRID_ITEMS: Array<{
  key: string;
  bucketId: ComparisonZoneBucketId;
  cellId?: number;
  className: string;
  labelText: string;
  clipPath?: string;
  labelCornerClass?: string;
  chase?: boolean;
  heart?: boolean;
}> = [
  { key: "chaseUpperLeft",  bucketId: "chaseUpperLeft",  className: "col-[1_/_span_2] row-[1_/_span_2]", labelText: "UL", clipPath: clipPathForLocationCell("topLeftCorner"),     labelCornerClass: "left-4 top-3",    chase: true },
  { key: "chaseUpperRight", bucketId: "chaseUpperRight", className: "col-[4_/_span_2] row-[1_/_span_2]", labelText: "UR", clipPath: clipPathForLocationCell("topRightCorner"),    labelCornerClass: "right-4 top-3",   chase: true },
  { key: "chaseLowerLeft",  bucketId: "chaseLowerLeft",  className: "col-[1_/_span_2] row-[4_/_span_2]", labelText: "LL", clipPath: clipPathForLocationCell("bottomLeftCorner"),  labelCornerClass: "left-4 bottom-3", chase: true },
  { key: "chaseLowerRight", bucketId: "chaseLowerRight", className: "col-[4_/_span_2] row-[4_/_span_2]", labelText: "LR", clipPath: clipPathForLocationCell("bottomRightCorner"), labelCornerClass: "right-4 bottom-3", chase: true },
  { key: "cell-1", bucketId: "upperLeft",  cellId: 1, className: "col-start-2 row-start-2", labelText: "1" },
  { key: "cell-2", bucketId: "upperLeft",  cellId: 2, className: "col-start-3 row-start-2", labelText: "2" },
  { key: "cell-3", bucketId: "upperRight", cellId: 3, className: "col-start-4 row-start-2", labelText: "3" },
  { key: "cell-4", bucketId: "lowerLeft",  cellId: 4, className: "col-start-2 row-start-3", labelText: "4" },
  { key: "cell-5", bucketId: "heart",      cellId: 5, className: "col-start-3 row-start-3", labelText: "5", heart: true },
  { key: "cell-6", bucketId: "upperRight", cellId: 6, className: "col-start-4 row-start-3", labelText: "6" },
  { key: "cell-7", bucketId: "lowerLeft",  cellId: 7, className: "col-start-2 row-start-4", labelText: "7" },
  { key: "cell-8", bucketId: "lowerRight", cellId: 8, className: "col-start-3 row-start-4", labelText: "8" },
  { key: "cell-9", bucketId: "lowerRight", cellId: 9, className: "col-start-4 row-start-4", labelText: "9" },
];

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatRate(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(3).replace(/^0(?=\.)/, "");
}

function formatPct(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return `${value.toFixed(digits)}%`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildCatalog(entries: ExplorerEntry[]): Catalog {
  const seasons = [...new Set(entries.flatMap((entry) => entry.seasons))].sort((left, right) =>
    right.localeCompare(left)
  );
  const pitchTypes = [...new Set(entries.flatMap((entry) => entry.pitchTypes))].sort(
    comparePitchTypes
  );
  const counts = [...new Set(entries.flatMap((entry) => entry.counts))].sort((left, right) => {
    const [leftBalls, leftStrikes] = left.split("-").map(Number);
    const [rightBalls, rightStrikes] = right.split("-").map(Number);
    if (Number.isNaN(leftBalls) || Number.isNaN(rightBalls)) {
      return left.localeCompare(right);
    }
    if (leftBalls !== rightBalls) return leftBalls - rightBalls;
    return leftStrikes - rightStrikes;
  });
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
}

function isPitcherView(view: ComparisonView) {
  return view === "pitchers";
}

function metricOptionsForView(view: ComparisonView): ComparisonMetricOption[] {
  return isPitcherView(view) ? PITCHER_COMPARISON_METRICS : CHARTING_PLAYER_COMPARISON_METRICS;
}

function eventOptionsForView(view: ComparisonView): ComparisonEventOption[] {
  return isPitcherView(view) ? PITCHER_COMPARISON_EVENTS : CHARTING_PLAYER_COMPARISON_EVENTS;
}

function defaultMetricForView(view: ComparisonView): ComparisonMetricId {
  return isPitcherView(view) ? "strikePct" : "avg";
}

function formatMetricValue(view: ComparisonView, metricId: ComparisonMetricId, value: number | null) {
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
}

function metricValueForSummary(
  view: ComparisonView,
  summary: ExplorerSummary,
  metricId: ComparisonMetricId
): number | null {
  return isPitcherView(view)
    ? metricValueForPitcherComparisonSummary(summary as PitcherComparisonSummary, metricId as PitcherComparisonMetricId)
    : metricValueForChartingPlayerComparisonSummary(
        summary as ChartingPlayerComparisonSummary,
        metricId as ChartingPlayerComparisonMetricId
      );
}

function summarizeExplorerPitches(view: ComparisonView, pitches: ExplorerPitch[]): ExplorerSummary {
  return isPitcherView(view)
    ? summarizePitcherComparisonPitches(pitches as PitcherComparisonPitchRecord[])
    : summarizeChartingPlayerComparisonPitches(pitches as ChartingPlayerComparisonPitchRecord[]);
}

function buildExplorerZoneBuckets(view: ComparisonView, pitches: ExplorerPitch[]): ExplorerZoneBucket[] {
  return isPitcherView(view)
    ? buildPitcherComparisonZoneBuckets(pitches as PitcherComparisonPitchRecord[])
    : buildChartingPlayerComparisonZoneBuckets(pitches as ChartingPlayerComparisonPitchRecord[]);
}

function buildExplorerPitchMix(view: ComparisonView, pitches: ExplorerPitch[]): ComparisonPitchMixItem[] {
  return isPitcherView(view)
    ? buildPitcherComparisonPitchMix(pitches as PitcherComparisonPitchRecord[])
    : buildChartingPlayerComparisonPitchMix(pitches as ChartingPlayerComparisonPitchRecord[]);
}

function hiddenExplorerZonePitchCount(view: ComparisonView, pitches: ExplorerPitch[]): number {
  return isPitcherView(view)
    ? hiddenPitcherComparisonZonePitchCount(pitches as PitcherComparisonPitchRecord[])
    : hiddenChartingPlayerComparisonZonePitchCount(pitches as ChartingPlayerComparisonPitchRecord[]);
}

function filterExplorerPitches(
  view: ComparisonView,
  pitches: ExplorerPitch[],
  filters: {
    season: string | null;
    pitchType: string | null;
    count: string | null;
    event: ComparisonEventId;
    veloMin: number | null;
    veloMax: number | null;
    pitcherHand: ChartingPlayerComparisonPitcherHandFilter;
  }
): ExplorerPitch[] {
  return isPitcherView(view)
    ? filterPitcherComparisonPitches(pitches as PitcherComparisonPitchRecord[], {
        season: filters.season,
        pitchType: filters.pitchType,
        count: filters.count,
        event: filters.event as PitcherComparisonEventId,
        veloMin: filters.veloMin,
        veloMax: filters.veloMax,
      })
    : filterChartingPlayerComparisonPitches(pitches as ChartingPlayerComparisonPitchRecord[], {
        season: filters.season,
        pitcherHand: filters.pitcherHand,
        pitchType: filters.pitchType,
        count: filters.count,
        event: filters.event as ChartingPlayerComparisonEventId,
        veloMin: filters.veloMin,
        veloMax: filters.veloMax,
      });
}

function handLabelForEntry(view: ComparisonView, entry: ExplorerEntry): string | null {
  if (isPitcherView(view)) {
    const pitcherEntry = entry as PitcherComparisonDirectoryEntry;
    return pitcherEntry.throws ? `${pitcherEntry.throws}HP` : null;
  }

  const hitterEntry = entry as ChartingPlayerComparisonDirectoryEntry;
  return hitterEntry.batterHand ? `${hitterEntry.batterHand}HH` : null;
}

function searchPlaceholderForView(view: ComparisonView): string {
  return isPitcherView(view)
    ? "Search pitcher by name or slug"
    : "Search hitter by name, slug, or charted alias";
}

function countNounForView(view: ComparisonView): string {
  return isPitcherView(view) ? "pitcher" : "hitter";
}

function heroDescriptionForView(view: ComparisonView): string {
  if (isPitcherView(view)) {
    return "A Babson take on the Savant player-visuals workflow, rebuilt for charted pitchers: player search, season scope, pitch-speed filters, command/result event slices, the same rough zone map, and a one-line summary table.";
  }

  return "A Babson take on the Savant player-visuals workflow, rebuilt around the charting fields we actually capture today: player search, pitcher-hand filters, season scope, pitch-speed filters, rough zone buckets, and a one-line season table.";
}

function eventLabelForView(view: ComparisonView, eventId: ComparisonEventId): string {
  return (
    eventOptionsForView(view).find((event) => event.id === eventId)?.label ??
    eventId
  );
}

function buildExplorerHref({
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
}: {
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
}) {
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
        })
  );

  if (isPitcherView(view)) {
    params.set("view", "pitchers");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function bucketHeat(
  view: ComparisonView,
  buckets: ExplorerZoneBucket[],
  bucket: ExplorerZoneBucket,
  metricId: ComparisonMetricId
): number {
  const option = metricOptionsForView(view).find((metric) => metric.id === metricId);
  const values = buckets
    .map((candidate) => metricValueForSummary(view, candidate.summary, metricId))
    .filter((value): value is number => value !== null);
  const currentValue = metricValueForSummary(view, bucket.summary, metricId);

  if (!option || currentValue === null || values.length === 0) {
    return 0;
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) {
    return 0.55;
  }

  const normalized = (currentValue - minimum) / (maximum - minimum);
  return option.lowerBetter ? 1 - normalized : normalized;
}

function cellHeat(
  view: ComparisonView,
  cellSummaries: Map<number, ExplorerSummary>,
  cellId: number,
  metricId: ComparisonMetricId
): number {
  const option = metricOptionsForView(view).find((metric) => metric.id === metricId);
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map((id) => {
      const s = cellSummaries.get(id);
      return s ? metricValueForSummary(view, s, metricId) : null;
    })
    .filter((v): v is number => v !== null);
  const summary = cellSummaries.get(cellId);
  const currentValue = summary ? metricValueForSummary(view, summary, metricId) : null;
  if (!option || currentValue === null || values.length === 0) return 0;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return 0.55;
  const normalized = (currentValue - minimum) / (maximum - minimum);
  return option.lowerBetter ? 1 - normalized : normalized;
}

function cellRow(cellId: number): number { return Math.floor((cellId - 1) / 3); }
function cellCol(cellId: number): number { return (cellId - 1) % 3; }

const ZONE_ROW_LABELS = ["High", "Mid", "Low"] as const;
const ZONE_COL_LABELS = ["L", "Ctr", "R"] as const;

function interpolateChannel(start: number, end: number, t: number) {
  return Math.round(start + (end - start) * t);
}

function bucketPalette(heat: number): { solid: string; glow: string; border: string } {
  if (heat <= 0.5) {
    const t = heat / 0.5;
    const start: [number, number, number] = [59, 130, 246];
    const end: [number, number, number] = [226, 232, 240];
    const rgb = start.map((value, index) => interpolateChannel(value, end[index]!, t));
    return {
      solid: `rgb(${rgb.join(",")})`,
      glow: `rgba(${rgb.join(",")}, ${0.18 + t * 0.12})`,
      border: `rgba(${rgb.join(",")}, ${0.24 + t * 0.18})`,
    };
  }

  const t = (heat - 0.5) / 0.5;
  const start: [number, number, number] = [254, 226, 226];
  const end: [number, number, number] = [239, 68, 68];
  const rgb = start.map((value, index) => interpolateChannel(value, end[index]!, t));
  return {
    solid: `rgb(${rgb.join(",")})`,
    glow: `rgba(${rgb.join(",")}, ${0.24 + t * 0.18})`,
    border: `rgba(${rgb.join(",")}, ${0.28 + t * 0.2})`,
  };
}

function withAlpha(color: string, alpha: number) {
  if (!color.startsWith("rgb(")) {
    return color;
  }
  return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}

function zoneSectionStyle({
  heat,
  selected,
  empty,
  chase = false,
}: {
  heat: number;
  selected: boolean;
  empty: boolean;
  chase?: boolean;
}): CSSProperties {
  if (empty) {
    return {
      borderColor: selected ? "rgba(244,244,245,0.18)" : "rgba(39,39,42,0.5)",
      background: "rgba(9,9,11,0.7)",
    };
  }

  const palette = bucketPalette(heat);
  const fillAlpha = chase ? 0.05 + heat * 0.07 : 0.1 + heat * 0.18;
  return {
    borderColor: selected
      ? "rgba(255,255,255,0.28)"
      : withAlpha(palette.solid, chase ? 0.12 : 0.22),
    background: withAlpha(palette.solid, fillAlpha),
  };
}

function SimpleZoneOverlay() {
  const zx1 = toSvg(-config.zoneWidth);
  const zx2 = toSvg(config.zoneWidth);
  const zy1 = toSvg(-config.zoneHeight);
  const zy2 = toSvg(config.zoneHeight);
  const zw = zx2 - zx1;
  const zh = zy2 - zy1;
  const col1 = zx1 + zw / 3;
  const col2 = zx1 + (2 * zw) / 3;
  const row1 = zy1 + zh / 3;
  const row2 = zy1 + (2 * zh) / 3;

  return (
    <g>
      <rect
        x="20"
        y="20"
        width={SIZE - 40}
        height={SIZE - 40}
        rx="28"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
      />
      <rect
        x={zx1}
        y={zy1}
        width={zw}
        height={zh}
        rx="8"
        fill="none"
        stroke="#71717a"
        strokeWidth="1.4"
        strokeDasharray="4 3"
      />
      <line x1={col1} x2={col1} y1={zy1} y2={zy2} stroke="#3f3f46" strokeWidth="1" />
      <line x1={col2} x2={col2} y1={zy1} y2={zy2} stroke="#3f3f46" strokeWidth="1" />
      <line x1={zx1} x2={zx2} y1={row1} y2={row1} stroke="#3f3f46" strokeWidth="1" />
      <line x1={zx1} x2={zx2} y1={row2} y2={row2} stroke="#3f3f46" strokeWidth="1" />
      <path
        d="M144 286h32l8 18-24 8-24-8 8-18z"
        fill="#d4d4d8"
        opacity="0.18"
      />
    </g>
  );
}

function placeholderVelocityText(
  value: number | null,
  fallback: number | null,
  boundary: "min" | "max"
) {
  if (value !== null) return `${value} mph`;
  if (fallback === null) return "N/A";
  return boundary === "min" ? `${fallback} mph floor` : `${fallback} mph ceiling`;
}

function SearchResultCard({
  view,
  entry,
  active,
  onClick,
}: {
  view: ComparisonView;
  entry: ExplorerEntry;
  active: boolean;
  onClick: () => void;
}) {
  const handLabel = handLabelForEntry(view, entry);

  return (
    <button
      type="button"
      onClick={onClick}
      className={joinClasses(
        "rounded-[1.5rem] border px-4 py-4 text-left transition-smooth",
        active
          ? "border-emerald-400/35 bg-emerald-500/10 shadow-[0_22px_48px_rgba(16,185,129,0.10)]"
          : "border-zinc-800 bg-zinc-950/75 hover:border-zinc-700 hover:bg-zinc-950/90"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-zinc-100">{entry.displayName}</div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {entry.seasons[0] ?? "No season"} • {formatCount(entry.totalPitches)} pitches
          </div>
        </div>
        <ArrowRight
          className={joinClasses(
            "mt-0.5 h-4 w-4 shrink-0",
            active ? "text-emerald-300" : "text-zinc-600"
          )}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {entry.sessionCount} session{entry.sessionCount === 1 ? "" : "s"}
        </span>
        {handLabel ? (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
            {handLabel}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm font-semibold text-zinc-100 outline-none"
        >
          {children}
        </select>
      </div>
    </label>
  );
}

function ComparisonViewToggle({
  view,
  onChange,
}: {
  view: ComparisonView;
  onChange: (view: ComparisonView) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        View
      </span>
      <div className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/80 p-1">
        {([
          { id: "hitters", label: "Hitters" },
          { id: "pitchers", label: "Pitchers" },
        ] as const).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={joinClasses(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-smooth",
              view === option.id
                ? "bg-emerald-500/12 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)]"
                : "text-zinc-500 hover:text-zinc-100"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function VelocityRangeControl({
  label,
  boundary,
  value,
  fallback,
  range,
  onChange,
}: {
  label: string;
  boundary: "min" | "max";
  value: number | null;
  fallback: number | null;
  range: ChartingPlayerComparisonVelocityRange | null;
  onChange: (next: number | null) => void;
}) {
  if (!range) {
    return (
      <div className="rounded-[1.4rem] border border-zinc-800 bg-zinc-950/70 px-4 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </div>
        <div className="mt-2 text-sm text-zinc-500">No tracked velocity</div>
      </div>
    );
  }

  const resolved = value ?? (boundary === "min" ? range.min : range.max);

  return (
    <div className="rounded-[1.4rem] border border-zinc-800 bg-zinc-950/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </div>
        <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
          {placeholderVelocityText(value, fallback, boundary)}
        </span>
      </div>
      <div className="mt-4">
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={1}
          value={resolved}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(
              boundary === "min"
                ? next <= range.min
                  ? null
                  : next
                : next >= range.max
                  ? null
                  : next
            );
          }}
          className="w-full accent-emerald-400"
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{range.min} mph</span>
        <span>{range.max} mph</span>
      </div>
    </div>
  );
}

function MetricToggle({
  view,
  value,
  onChange,
}: {
  view: ComparisonView;
  value: ComparisonMetricId;
  onChange: (value: ComparisonMetricId) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        Metric
      </span>
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/80 p-1">
        {metricOptionsForView(view).map((metric) => (
          <button
            key={metric.id}
            type="button"
            onClick={() => onChange(metric.id)}
            className={joinClasses(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-smooth",
              value === metric.id
                ? "bg-emerald-500/12 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)]"
                : "text-zinc-500 hover:text-zinc-100"
            )}
          >
            {metric.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ZoneSectionRegion({
  view,
  bucket,
  summary,
  selected,
  subdued,
  labelText,
  chase = false,
  clipPath,
  labelCornerClass,
  className,
  metricId,
  style,
  onHoverStart,
  onHoverEnd,
  onSelect,
}: {
  view: ComparisonView;
  bucket: ExplorerZoneBucket;
  summary: ExplorerSummary;
  selected: boolean;
  subdued: boolean;
  labelText: string;
  chase?: boolean;
  clipPath?: string;
  labelCornerClass?: string;
  className?: string;
  metricId: ComparisonMetricId;
  style: CSSProperties;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onSelect: () => void;
}) {
  const empty = summary.totalPitches === 0;
  const lowSample = !empty && summary.totalPitches < 3;
  const count = summary.totalPitches;
  const metricValue = metricValueForSummary(view, summary, metricId);

  return (
    <button
      type="button"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      onClick={onSelect}
      title={`${ZONE_BUCKET_LAYOUT[bucket.id].label}: ${ZONE_BUCKET_LAYOUT[bucket.id].caption}`}
      aria-pressed={selected}
      className={joinClasses(
        "relative overflow-hidden rounded-[0.65rem] border text-left transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60",
        className
      )}
      style={{
        ...style,
        clipPath: clipPath ?? "none",
        borderRadius: chase ? "1.5rem" : "0.65rem",
        opacity: subdued ? (chase ? 0.28 : 0.4) : 1,
      }}
    >
      {/* Label — outer corner for chase, top-left for zone */}
      <span
        className={joinClasses(
          "absolute font-bold uppercase leading-none tracking-wider",
          chase
            ? joinClasses("text-[8px] text-zinc-500", labelCornerClass ?? "left-4 top-3")
            : "left-1.5 top-1.5 text-[8px] text-zinc-500"
        )}
      >
        {labelText}
      </span>

      {/* Metric value — center (in-zone cells only) */}
      {!chase && (
        <span
          className={joinClasses(
            "absolute inset-0 flex items-center justify-center font-black tabular-nums tracking-tight",
            empty ? "text-[11px] text-zinc-700" : lowSample ? "text-sm text-zinc-400" : "text-sm text-zinc-50"
          )}
        >
          {empty ? "—" : formatMetricValue(view, metricId, metricValue)}
        </span>
      )}

      {/* Count — positioned inside visible clip area for chase, bottom-right for zone */}
      {!empty && (
        <span
          className={joinClasses(
            "absolute leading-none tabular-nums",
            chase
              ? "bottom-3 right-3 text-[10px] font-semibold text-zinc-400"
              : "bottom-1.5 right-1.5 text-[8px] font-semibold text-zinc-500"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ZoneDisplayModeToggle({
  value,
  onChange,
}: {
  value: ZoneDisplayMode;
  onChange: (value: ZoneDisplayMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        View
      </span>
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/80 p-1">
        {[
          { id: "heatmap", label: "Heatmap" },
          { id: "sections", label: "Zone Sections" },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id as ZoneDisplayMode)}
            className={joinClasses(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-smooth",
              value === option.id
                ? "bg-zinc-100 text-zinc-950"
                : "text-zinc-500 hover:text-zinc-100"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "emerald" | "sky";
}) {
  const emphasis =
    tone === "emerald"
      ? "text-emerald-200"
      : tone === "sky"
        ? "text-sky-200"
        : "text-zinc-100";

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/65 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className={joinClasses("mt-2 text-xl font-black tracking-tight", emphasis)}>
        {value}
      </div>
    </div>
  );
}

function PitchMixPanel({
  title,
  subtitle,
  pitches,
}: {
  title: string;
  subtitle: string;
  pitches: ComparisonPitchMixItem[];
}) {
  return (
    <div className="rounded-[1.6rem] border border-zinc-800/80 bg-zinc-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {title}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">{subtitle}</div>
        </div>
        <div className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
          {pitches.length} type{pitches.length === 1 ? "" : "s"}
        </div>
      </div>

      {pitches.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-5 text-sm text-zinc-500">
          No pitches in this sample.
        </div>
      ) : (
        <>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full border border-zinc-800 bg-zinc-950/80">
            {pitches.map((item) => (
              <div
                key={item.pitchType}
                style={{ width: `${Math.max(item.share, 6)}%`, backgroundColor: item.color }}
                className="h-full"
              />
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {pitches.map((item) => (
              <div
                key={item.pitchType}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/65 px-3 py-2.5"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 12px ${item.color}` }}
                />
                <div className="min-w-0 text-sm font-semibold text-zinc-100">{item.label}</div>
                <div className="text-xs text-zinc-500">{formatCount(item.count)}</div>
                <div className="text-xs font-semibold text-zinc-300">
                  {formatPct(item.share, 1)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ZoneCanvas({
  view,
  buckets,
  metricId,
  metricOptions,
  displayMode,
  selectedBucketId,
  selectedCellId,
  selectedRowId,
  selectedColId,
  cellSummaries,
  rowSummaries,
  colSummaries,
  allSummary,
  allPitchCount,
  onSelectBucket,
  onSelectCell,
  onSelectRow,
  onSelectCol,
}: {
  view: ComparisonView;
  buckets: ExplorerZoneBucket[];
  metricId: ComparisonMetricId;
  metricOptions: ComparisonMetricOption[];
  displayMode: ZoneDisplayMode;
  selectedBucketId: ComparisonZoneBucketId | null;
  selectedCellId: number | null;
  selectedRowId: number | null;
  selectedColId: number | null;
  cellSummaries: Map<number, ExplorerSummary>;
  rowSummaries: Map<number, ExplorerSummary>;
  colSummaries: Map<number, ExplorerSummary>;
  allSummary: ExplorerSummary;
  allPitchCount: number;
  onSelectBucket: (bucketId: ComparisonZoneBucketId | null) => void;
  onSelectCell: (cellId: number | null) => void;
  onSelectRow: (rowId: number | null) => void;
  onSelectCol: (colId: number | null) => void;
}) {
  const [hoveredBucketId, setHoveredBucketId] =
    useState<ComparisonZoneBucketId | null>(null);
  const [hoveredCellId, setHoveredCellId] = useState<number | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);
  const [hoveredColId, setHoveredColId] = useState<number | null>(null);
  const activeMetric = metricOptions.find((metric) => metric.id === metricId)?.label ?? metricId;
  const hoveredBucket =
    hoveredBucketId !== null
      ? buckets.find((bucket) => bucket.id === hoveredBucketId) ?? null
      : null;
  const selectedBucket =
    selectedBucketId !== null
      ? buckets.find((bucket) => bucket.id === selectedBucketId) ?? null
      : null;
  const focusBucket = hoveredBucket ?? selectedBucket;
  const focusLayout = focusBucket ? ZONE_BUCKET_LAYOUT[focusBucket.id] : null;
  const focusCellId = hoveredCellId ?? selectedCellId;
  const focusRowId = hoveredRowId ?? selectedRowId;
  const focusColId = hoveredColId ?? selectedColId;
  const focusCellSummary = focusCellId !== null ? cellSummaries.get(focusCellId) ?? null : null;
  const focusRowSummary = focusRowId !== null ? rowSummaries.get(focusRowId) ?? null : null;
  const focusColSummary = focusColId !== null ? colSummaries.get(focusColId) ?? null : null;
  const hasAnyFocus = focusCellId !== null || focusBucket !== null || focusRowId !== null || focusColId !== null;
  const displayedSummary =
    (selectedCellId !== null ? cellSummaries.get(selectedCellId) : null) ??
    (selectedRowId !== null ? rowSummaries.get(selectedRowId) : null) ??
    (selectedColId !== null ? colSummaries.get(selectedColId) : null) ??
    selectedBucket?.summary ??
    allSummary;
  const focusSummary = focusCellSummary ?? focusRowSummary ?? focusColSummary ?? focusBucket?.summary ?? null;
  const focusLabel =
    focusCellId !== null ? `Zone Cell ${focusCellId}`
    : focusRowId !== null ? `Row: ${ZONE_ROW_LABELS[focusRowId] ?? focusRowId}`
    : focusColId !== null ? `Col: ${ZONE_COL_LABELS[focusColId] ?? focusColId}`
    : focusLayout?.label ?? null;
  const focusShare =
    focusSummary && allPitchCount > 0
      ? (focusSummary.totalPitches / allPitchCount) * 100
      : null;

  return (
    <div className="rounded-[1.9rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_50%_28%,rgba(45,212,191,0.08),transparent_30%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.95))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {displayMode === "heatmap" ? "Pitch Heatmap" : "Zone Sections"}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>{activeMetric}</span>
            <span className="text-zinc-700">•</span>
            <span>
              {displayMode === "heatmap"
                ? "Pitch location adjusted to batter zone"
                : "Rough bucket sections"}
            </span>
            {(selectedBucket || selectedCellId !== null || selectedRowId !== null || selectedColId !== null) ? (
              <>
                <span className="text-zinc-700">•</span>
                <span className="text-zinc-300">
                  {selectedCellId !== null ? `Cell ${selectedCellId}`
                    : selectedRowId !== null ? `${ZONE_ROW_LABELS[selectedRowId]} row`
                    : selectedColId !== null ? `${ZONE_COL_LABELS[selectedColId]} col`
                    : selectedBucket?.label} selected
                </span>
              </>
            ) : null}
          </div>
        </div>
        {(selectedBucket || selectedCellId !== null || selectedRowId !== null || selectedColId !== null) ? (
          <button
            type="button"
            onClick={() => { onSelectBucket(null); onSelectCell(null); onSelectRow(null); onSelectCol(null); }}
            className="rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
          >
            Clear Selection
          </button>
        ) : null}
      </div>

      {displayMode === "heatmap" ? (
        <div className="relative aspect-[0.92] overflow-hidden rounded-[2.15rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_50%_38%,rgba(37,99,235,0.10),transparent_34%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(9,9,11,0.96))] p-3">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)]"
          >
            <defs>
              <filter id="player-comparison-heat-blur" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="18" />
              </filter>
            </defs>

            {buckets.map((bucket) => {
              const heat = bucketHeat(view, buckets, bucket, metricId);
              const selected = selectedBucketId === bucket.id;
              const empty = bucket.summary.totalPitches === 0;
              const shape = HEAT_BUCKET_SHAPES[bucket.id];
              const palette = bucketPalette(heat);
              const opacity = empty ? 0.02 : 0.12 + heat * 0.52;
              const crispOpacity = empty ? 0.02 : 0.08 + heat * 0.12;

              if (shape.kind === "ellipse") {
                return (
                  <g key={bucket.id}>
                    <ellipse
                      cx={shape.cx}
                      cy={shape.cy}
                      rx={shape.rx}
                      ry={shape.ry}
                      fill={palette.solid}
                      opacity={opacity}
                      filter="url(#player-comparison-heat-blur)"
                    />
                    <ellipse
                      cx={shape.cx}
                      cy={shape.cy}
                      rx={shape.rx}
                      ry={shape.ry}
                      fill={palette.solid}
                      opacity={crispOpacity}
                    />
                    {selected ? (
                      <ellipse
                        cx={shape.cx}
                        cy={shape.cy}
                        rx={shape.rx}
                        ry={shape.ry}
                        fill="none"
                        stroke="rgba(255,255,255,0.68)"
                        strokeWidth="2"
                      />
                    ) : null}
                  </g>
                );
              }

              return (
                <g key={bucket.id}>
                  <rect
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    rx={shape.radius}
                    fill={palette.solid}
                    opacity={opacity}
                    filter="url(#player-comparison-heat-blur)"
                  />
                  <rect
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    rx={shape.radius}
                    fill={palette.solid}
                    opacity={crispOpacity}
                  />
                  {selected ? (
                    <rect
                      x={shape.x}
                      y={shape.y}
                      width={shape.width}
                      height={shape.height}
                      rx={shape.radius}
                      fill="none"
                      stroke="rgba(255,255,255,0.68)"
                      strokeWidth="2"
                    />
                  ) : null}
                </g>
              );
            })}

            <SimpleZoneOverlay />
          </svg>

          {buckets.map((bucket) => {
            const layout = ZONE_BUCKET_LAYOUT[bucket.id];
            const selected = selectedBucketId === bucket.id;

            return (
              <button
                key={bucket.id}
                type="button"
                onClick={() => onSelectBucket(selected ? null : bucket.id)}
                title={`${layout.label}: ${layout.caption}`}
                className={joinClasses(
                  "absolute rounded-[1.2rem] border border-transparent transition-smooth hover:border-white/12",
                  selected ? "border-white/25 bg-white/[0.03]" : "bg-transparent"
                )}
                style={{
                  ...layout.style,
                  clipPath: layout.chaseKind ? clipPathForLocationCell(layout.chaseKind) : "none",
                }}
              />
            );
          })}
          <div className="pointer-events-none absolute inset-3 rounded-[1.9rem] border border-white/5" />
        </div>
      ) : (
        <div className="relative rounded-[2.15rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_50%_38%,rgba(37,99,235,0.10),transparent_34%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(9,9,11,0.96))] p-3">
          {/* Row / Col bar selectors */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Row</span>
              {([0, 1, 2] as const).map((row) => (
                <button
                  key={row}
                  type="button"
                  onMouseEnter={() => setHoveredRowId(row)}
                  onMouseLeave={() => setHoveredRowId(null)}
                  onClick={() => {
                    onSelectRow(selectedRowId === row ? null : row);
                  }}
                  className={joinClasses(
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-smooth",
                    selectedRowId === row
                      ? "bg-sky-500/18 text-sky-200 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)]"
                      : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200"
                  )}
                >
                  {ZONE_ROW_LABELS[row]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Col</span>
              {([0, 1, 2] as const).map((col) => (
                <button
                  key={col}
                  type="button"
                  onMouseEnter={() => setHoveredColId(col)}
                  onMouseLeave={() => setHoveredColId(null)}
                  onClick={() => {
                    onSelectCol(selectedColId === col ? null : col);
                  }}
                  className={joinClasses(
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-smooth",
                    selectedColId === col
                      ? "bg-sky-500/18 text-sky-200 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)]"
                      : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200"
                  )}
                >
                  {ZONE_COL_LABELS[col]}
                </button>
              ))}
            </div>
          </div>
          <div className="aspect-[0.92] overflow-hidden rounded-[1.75rem]">
          <div className="grid h-full grid-cols-5 grid-rows-5 gap-2">
            {ZONE_SECTION_GRID_ITEMS.map((item) => {
              const bucket = buckets.find((candidate) => candidate.id === item.bucketId);
              if (!bucket) return null;

              const isZoneCell = item.cellId !== undefined;
              const summary = isZoneCell
                ? (cellSummaries.get(item.cellId!) ?? bucket.summary)
                : bucket.summary;
              const heat = isZoneCell
                ? cellHeat(view, cellSummaries, item.cellId!, metricId)
                : bucketHeat(view, buckets, bucket, metricId);
              const selected = isZoneCell
                ? selectedCellId === item.cellId
                : selectedBucketId === bucket.id;
              let subdued = false;
              if (hasAnyFocus) {
                if (focusCellId !== null) {
                  subdued = isZoneCell ? focusCellId !== item.cellId : true;
                } else if (focusRowId !== null) {
                  subdued = isZoneCell ? cellRow(item.cellId!) !== focusRowId : true;
                } else if (focusColId !== null) {
                  subdued = isZoneCell ? cellCol(item.cellId!) !== focusColId : true;
                } else if (focusBucket !== null) {
                  subdued = item.chase ? focusBucket.id !== bucket.id : true;
                }
              }
              const style = zoneSectionStyle({
                heat,
                selected,
                empty: summary.totalPitches === 0,
                chase: item.chase,
              });

              return (
                <ZoneSectionRegion
                  key={item.key}
                  view={view}
                  bucket={bucket}
                  summary={summary}
                  selected={selected}
                  subdued={subdued}
                  labelText={item.labelText}
                  chase={item.chase}
                  clipPath={item.clipPath}
                  labelCornerClass={item.labelCornerClass}
                  className={item.className}
                  metricId={metricId}
                  style={style}
                  onHoverStart={() => {
                    if (isZoneCell) setHoveredCellId(item.cellId!);
                    else setHoveredBucketId(bucket.id);
                  }}
                  onHoverEnd={() => {
                    if (isZoneCell) setHoveredCellId((c) => c === item.cellId ? null : c);
                    else setHoveredBucketId((c) => c === bucket.id ? null : c);
                  }}
                  onSelect={() => {
                    if (isZoneCell) {
                      onSelectCell(selectedCellId === item.cellId ? null : item.cellId!);
                    } else {
                      onSelectBucket(selectedBucketId === bucket.id ? null : bucket.id);
                    }
                  }}
                />
              );
            })}
          </div>
          </div>{/* end aspect wrapper */}

          {hasAnyFocus && focusSummary ? (
            <div className="pointer-events-none absolute right-3 top-16 rounded-[0.75rem] border border-white/10 bg-zinc-950/92 px-3 py-2 text-[11px] text-zinc-300 shadow-[0_8px_20px_rgba(0,0,0,0.4)] backdrop-blur-sm">
              <div className="font-semibold text-zinc-100">{focusLabel}</div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span>
                  n=<span className="font-semibold text-zinc-100">{focusSummary.totalPitches}</span>
                </span>
                <span>
                  {activeMetric}{" "}
                  <span className="font-semibold text-zinc-100">
                    {formatMetricValue(view, metricId, metricValueForSummary(view, focusSummary, metricId))}
                  </span>
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-zinc-800/70 bg-zinc-950/55 px-4 py-3">
        <div className="text-[11px] text-zinc-500">
          {hasAnyFocus ? (
            <>
              <span className="font-semibold text-zinc-200">{focusLabel}</span>
              {focusLayout?.caption && focusCellId === null && focusRowId === null && focusColId === null ? (
                <>
                  <span className="mx-2 text-zinc-700">•</span>
                  <span>{focusLayout.caption}</span>
                </>
              ) : null}
            </>
          ) : (
            displayMode === "sections"
              ? "Hover or click a cell to inspect that zone."
              : "Click a zone to isolate that rough bucket."
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          {hasAnyFocus && focusSummary ? (
            <>
              <span className="text-zinc-500">
                Pitches{" "}
                <span className="font-semibold text-zinc-100">
                  {formatCount(focusSummary.totalPitches)}
                </span>
              </span>
              <span className="text-zinc-500">
                {activeMetric}{" "}
                <span className="font-semibold text-zinc-100">
                  {formatMetricValue(view, metricId, metricValueForSummary(view, focusSummary, metricId))}
                </span>
              </span>
              <span className="text-zinc-500">
                Share{" "}
                <span className="font-semibold text-zinc-100">
                  {focusShare === null ? "—" : formatPct(focusShare, 0)}
                </span>
              </span>
            </>
          ) : (
            <>
              <span className="text-zinc-500">
                Pitches{" "}
                <span className="font-semibold text-zinc-100">
                  {formatCount(displayedSummary.totalPitches)}
                </span>
              </span>
              <span className="text-zinc-500">
                {activeMetric}{" "}
                <span className="font-semibold text-zinc-100">
                  {formatMetricValue(view, metricId, metricValueForSummary(view, displayedSummary, metricId))}
                </span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryTable({
  view,
  entry,
  seasonLabel,
  summary,
}: {
  view: ComparisonView;
  entry: ExplorerEntry;
  seasonLabel: string;
  summary: ExplorerSummary;
}) {
  if (isPitcherView(view)) {
    const pitcherEntry = entry as PitcherComparisonDirectoryEntry;
    const pitcherSummary = summary as PitcherComparisonSummary;

    return (
      <LeaderboardPanel className="overflow-hidden">
        <div className="border-b border-zinc-800/80 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Summary Table
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Filtered season-line summary for the selected pitcher.
              </div>
            </div>
            <LeaderboardPill tone="neutral">{seasonLabel}</LeaderboardPill>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-950/40">
                {[
                  "Player",
                  "Throw",
                  "Season",
                  "Pitches",
                  "TBF",
                  "Strike%",
                  "Zone%",
                  "Whiff%",
                  "Chase%",
                  "BAA",
                  "K%",
                  "BB%",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pitcherSummary.totalPitches === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-10 text-center text-sm text-zinc-500">
                    No pitches match the current player and filter scope.
                  </td>
                </tr>
              ) : (
                <tr className="border-b border-zinc-800/70 transition-smooth hover:bg-emerald-500/5">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-sm font-black text-emerald-200">
                        {pitcherEntry.displayName
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part.charAt(0))
                          .join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-100">{pitcherEntry.displayName}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          {pitcherEntry.throws ? `${pitcherEntry.throws}HP` : "Hand unknown"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-200">
                    {pitcherEntry.throws ? `${pitcherEntry.throws}HP` : "—"}
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-zinc-100">{seasonLabel}</td>
                  <td className="px-4 py-4 text-sm text-zinc-200">
                    {formatCount(pitcherSummary.totalPitches)}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-200">{pitcherSummary.plateAppearances}</td>
                  <td className="px-4 py-4 text-sm text-zinc-200">{formatPct(pitcherSummary.strikePct, 1)}</td>
                  <td className="px-4 py-4 text-sm text-zinc-200">{formatPct(pitcherSummary.zonePct, 1)}</td>
                  <td className="px-4 py-4 text-sm text-zinc-200">{formatPct(pitcherSummary.whiffPct, 1)}</td>
                  <td className="px-4 py-4 text-sm text-zinc-200">{formatPct(pitcherSummary.chasePct, 1)}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-emerald-200">
                    {formatRate(pitcherSummary.baa)}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-200">{formatPct(pitcherSummary.kPct, 1)}</td>
                  <td className="px-4 py-4 text-sm text-zinc-200">{formatPct(pitcherSummary.bbPct, 1)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </LeaderboardPanel>
    );
  }

  const hitterEntry = entry as ChartingPlayerComparisonDirectoryEntry;
  const hitterSummary = summary as ChartingPlayerComparisonSummary;

  return (
    <LeaderboardPanel className="overflow-hidden">
      <div className="border-b border-zinc-800/80 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Summary Table
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              Filtered season-line summary for the selected hitter.
            </div>
          </div>
          <LeaderboardPill tone="neutral">{seasonLabel}</LeaderboardPill>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1020px] w-full">
          <thead>
            <tr className="border-b border-zinc-800/80 bg-zinc-950/40">
              {[
                "Player",
                "Season",
                "Pitches",
                "PA",
                "AB",
                "H",
                "1B",
                "2B",
                "3B",
                "HR",
                "BA",
                "SO",
                "K%",
                "wOBA",
              ].map((label) => (
                <th
                  key={label}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hitterSummary.totalPitches === 0 ? (
              <tr>
                <td colSpan={14} className="px-6 py-10 text-center text-sm text-zinc-500">
                  No pitches match the current player and filter scope.
                </td>
              </tr>
            ) : (
              <tr className="border-b border-zinc-800/70 transition-smooth hover:bg-emerald-500/5">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-sm font-black text-emerald-200">
                      {entry.displayName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part.charAt(0))
                        .join("")}
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-100">{hitterEntry.displayName}</div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        {hitterEntry.batterHand ? `${hitterEntry.batterHand}HH` : "Hand unknown"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-zinc-100">{seasonLabel}</td>
                <td className="px-4 py-4 text-sm text-zinc-200">
                  {formatCount(hitterSummary.totalPitches)}
                </td>
                <td className="px-4 py-4 text-sm text-zinc-200">{hitterSummary.plateAppearances}</td>
                <td className="px-4 py-4 text-sm text-zinc-200">{hitterSummary.atBats}</td>
                <td className="px-4 py-4 text-sm text-zinc-200">{hitterSummary.hits}</td>
                <td className="px-4 py-4 text-sm text-zinc-200">{hitterSummary.singles}</td>
                <td className="px-4 py-4 text-sm text-zinc-200">{hitterSummary.doubles}</td>
                <td className="px-4 py-4 text-sm text-zinc-200">{hitterSummary.triples}</td>
                <td className="px-4 py-4 text-sm text-zinc-200">{hitterSummary.homeRuns}</td>
                <td className="px-4 py-4 text-sm font-semibold text-emerald-200">
                  {formatRate(hitterSummary.battingAverage)}
                </td>
                <td className="px-4 py-4 text-sm text-zinc-200">{hitterSummary.strikeouts}</td>
                <td className="px-4 py-4 text-sm text-zinc-200">
                  {formatPct(hitterSummary.strikeoutRate, 1)}
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-sky-200">
                  {formatRate(hitterSummary.woba)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </LeaderboardPanel>
  );
}

function EmptyState({
  view,
  filteredEntries,
  pinnedSlug,
  onOpenPinned,
}: {
  view: ComparisonView;
  filteredEntries: ExplorerEntry[];
  pinnedSlug: string | null;
  onOpenPinned: (() => void) | null;
}) {
  const isPitcher = isPitcherView(view);

  return (
    <LeaderboardPanel className="overflow-hidden p-6 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(14,165,233,0.14),transparent_24%),radial-gradient(circle_at_86%_22%,rgba(16,185,129,0.12),transparent_22%),linear-gradient(180deg,rgba(13,18,21,0.86),rgba(9,9,11,0.95))]" />
      <div className="relative grid gap-6 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)] xl:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
            <ClipboardList className="h-3.5 w-3.5" />
            Player Visuals
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-zinc-50">
            Search a {isPitcher ? "pitcher" : "hitter"} to open the visuals.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">
            {isPitcher
              ? "This page mirrors the Savant workflow with the Babson pitcher data we actually capture: player search, season and pitch filters, pitch-speed scope, command/result slices, rough zone buckets, and a one-line season table below."
              : "This page mirrors the Savant workflow with the Babson data we actually capture: player search, pitcher hand, season and pitch filters, pitch-speed scope, rough zone buckets, and a one-line season table below."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <LeaderboardPill tone="sky">
              {filteredEntries.length} roster {countNounForView(view)}
              {filteredEntries.length === 1 ? "" : "s"}
            </LeaderboardPill>
            <LeaderboardPill tone="neutral">9 rough zone buckets</LeaderboardPill>
            <LeaderboardPill tone="neutral">No EV or contour layer</LeaderboardPill>
          </div>
          {pinnedSlug && onOpenPinned ? (
            <button
              type="button"
              onClick={onOpenPinned}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-sm font-semibold text-zinc-200 transition-smooth hover:border-emerald-400/25 hover:text-emerald-200"
            >
              Reopen pinned {countNounForView(view)}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="rounded-[2rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_50%_30%,rgba(45,212,191,0.08),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="relative aspect-square rounded-[1.75rem] border border-zinc-800/80 bg-zinc-950/60">
            <div className="pointer-events-none absolute inset-[22%] rounded-[1.5rem] border border-dashed border-zinc-500/30" />
            {Object.values(ZONE_BUCKET_LAYOUT).map((bucket) => (
              <div
                key={bucket.label}
                className="absolute overflow-hidden rounded-[1.4rem] border border-zinc-800/80 bg-zinc-950/70"
                style={{
                  ...bucket.style,
                  clipPath: bucket.chaseKind ? clipPathForLocationCell(bucket.chaseKind) : "none",
                }}
              >
                <div className="p-2.5">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                    {bucket.label}
                  </div>
                  <div className="mt-6 text-right text-xl font-black tracking-tight text-zinc-700">
                    —
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LeaderboardPanel>
  );
}

// ---------------------------------------------------------------------------
// Insights Explorer — inline synthesis helpers
// ---------------------------------------------------------------------------

const MIN_EXPLORER_SAMPLE = 15;

function derivePitcherExplorerTakeaways(
  summary: PitcherComparisonSummary,
  pitchMix: ComparisonPitchMixItem[],
): string[] {
  if (summary.totalPitches < MIN_EXPLORER_SAMPLE) return [];
  const takeaways: string[] = [];
  const sorted = [...pitchMix].sort((a, b) => b.share - a.share);
  const top = sorted[0];
  const second = sorted[1];
  const spreadCount = sorted.filter((p) => p.share >= 15).length;

  // Usage (at most 1)
  if (top) {
    if (top.share >= 50) {
      takeaways.push(`Leans on the ${top.label} (${top.share.toFixed(0)}% of pitches in this slice).`);
    } else if (second && top.share + second.share >= 65) {
      takeaways.push(`Works mostly off the ${top.label} and ${second.label} (${(top.share + second.share).toFixed(0)}% combined).`);
    } else if (spreadCount >= 3) {
      takeaways.push(`Spread mix across ${spreadCount} pitch types in this sample.`);
    }
  }

  // Strike-throwing (at most 1)
  if (summary.strikePct !== null) {
    if (summary.strikePct >= 68) {
      takeaways.push(`Strong attack zone — ${summary.strikePct.toFixed(0)}% strike rate in this sample.`);
    } else if (summary.strikePct < 56) {
      takeaways.push(`Elevated ball rate — ${summary.strikePct.toFixed(0)}% strikes in this sample.`);
    }
  }

  // Bat-missing (at most 1)
  if (summary.whiffPct !== null && summary.whiffPct >= 22) {
    takeaways.push(`Generating misses — ${summary.whiffPct.toFixed(0)}% whiff rate on swings.`);
  }

  // Finish rate (only if under 3)
  if (takeaways.length < 3 && summary.kPct !== null && summary.kPct >= 28) {
    takeaways.push(`Strong strikeout rate — ${summary.kPct.toFixed(0)}% of PAs end in a K.`);
  }

  return takeaways.slice(0, 3);
}

function deriveHitterExplorerTakeaways(
  summary: ChartingPlayerComparisonSummary,
  pitchMix: ComparisonPitchMixItem[],
): string[] {
  if (summary.totalPitches < MIN_EXPLORER_SAMPLE) return [];
  const takeaways: string[] = [];
  const sorted = [...pitchMix].sort((a, b) => b.share - a.share);

  // Swing decisions (at most 1)
  if (summary.swingPct !== null) {
    if (summary.swingPct >= 55) {
      takeaways.push(`Aggressive swing decisions — swinging at ${summary.swingPct.toFixed(0)}% of pitches in this slice.`);
    } else if (summary.swingPct < 35) {
      takeaways.push(`Patient approach — swinging at only ${summary.swingPct.toFixed(0)}% of pitches in this slice.`);
    }
  }

  // Contact (at most 1)
  if (summary.whiffPct !== null && summary.whiffPct >= 30) {
    takeaways.push(`Trouble making contact — ${summary.whiffPct.toFixed(0)}% whiff rate when swinging.`);
  }

  // Production (at most 1)
  if (summary.woba !== null && (summary.plateAppearances ?? 0) >= 8) {
    if (summary.woba >= 0.380) {
      takeaways.push(`Strong production in this sample — ${summary.woba.toFixed(3)} wOBA.`);
    } else if (summary.woba < 0.270) {
      takeaways.push(`Limited production in this sample — ${summary.woba.toFixed(3)} wOBA.`);
    }
  }

  // Mix exposure (only if under 3)
  if (takeaways.length < 3 && sorted[0] && sorted[0].share >= 55) {
    takeaways.push(`Mostly sees ${sorted[0].label} in this slice (${sorted[0].share.toFixed(0)}%).`);
  }

  return takeaways.slice(0, 3);
}

export default function LiveAbInsightsExplorer({
  entries,
  view,
}: {
  entries: ExplorerEntry[];
  view: ComparisonView;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { slug: pinnedSlug, setSelectedPlayer } = useSelectedPlayer();
  const hitterQuery = useMemo(() => readHitterExplorerQuery(searchParams), [searchParams]);
  const pitcherQuery = useMemo(() => readPitcherExplorerQuery(searchParams), [searchParams]);
  const isPitcher = isPitcherView(view);
  const initialQuery = isPitcher ? pitcherQuery : hitterQuery;
  const [searchInput, setSearchInput] = useState("");
  const [selectedMetric, setSelectedMetric] =
    useState<ComparisonMetricId>(defaultMetricForView(view));
  const [zoneDisplayMode, setZoneDisplayMode] = useState<ZoneDisplayMode>("heatmap");
  const [selectedBucketId, setSelectedBucketId] =
    useState<ComparisonZoneBucketId | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<number | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [selectedColId, setSelectedColId] = useState<number | null>(null);
  const [selectedPlayerSlug, setSelectedPlayerSlug] = useState<string | null>(
    initialQuery.playerSlug
  );
  const [pitcherHandParam, setPitcherHandParam] =
    useState<ChartingPlayerComparisonPitcherHandFilter>(
      isPitcher ? "all" : hitterQuery.pitcherHand
    );
  const [seasonParam, setSeasonParam] = useState<string | null>(initialQuery.season);
  const [pitchTypeParam, setPitchTypeParam] = useState<string | null>(initialQuery.pitchType);
  const [countParam, setCountParam] = useState<string | null>(initialQuery.count);
  const [eventParam, setEventParam] = useState<ComparisonEventId>(initialQuery.event);
  const [veloMinParam, setVeloMinParam] = useState<number | null>(initialQuery.veloMin);
  const [veloMaxParam, setVeloMaxParam] = useState<number | null>(initialQuery.veloMax);
  const deferredSearch = useDeferredValue(searchInput);
  const metricOptions = useMemo(() => metricOptionsForView(view), [view]);

  const entryBySlug = useMemo(
    () => new Map(entries.map((entry) => [entry.playerSlug, entry])),
    [entries]
  );
  const globalCatalog = useMemo(() => buildCatalog(entries), [entries]);
  const totalPitches = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.totalPitches, 0),
    [entries]
  );
  const totalSeasons = globalCatalog.seasons.length;

  const resolvedPlayerSlug =
    selectedPlayerSlug && entryBySlug.has(selectedPlayerSlug) ? selectedPlayerSlug : null;
  const selectedEntry = resolvedPlayerSlug ? entryBySlug.get(resolvedPlayerSlug) ?? null : null;

  const catalog = selectedEntry
    ? {
        seasons: selectedEntry.seasons,
        pitchTypes: selectedEntry.pitchTypes,
        counts: selectedEntry.counts,
        velocityRange: selectedEntry.velocityRange,
      }
    : globalCatalog;

  const latestSeason = catalog.seasons[0] ?? null;
  const resolvedSeasonUi =
    seasonParam === "all"
      ? "all"
      : seasonParam && catalog.seasons.includes(seasonParam)
        ? seasonParam
        : latestSeason ?? "all";
  const resolvedPitchType =
    pitchTypeParam && catalog.pitchTypes.includes(pitchTypeParam) ? pitchTypeParam : null;
  const resolvedCount = countParam && catalog.counts.includes(countParam) ? countParam : null;
  const resolvedEvent = isPitcher
    ? normalizePitcherEvent(eventParam)
    : normalizeHitterEvent(eventParam);

  const resolvedVeloMin =
    catalog.velocityRange && veloMinParam !== null
      ? Math.max(catalog.velocityRange.min, Math.min(veloMinParam, catalog.velocityRange.max))
      : null;
  const resolvedVeloMax =
    catalog.velocityRange && veloMaxParam !== null
      ? Math.max(catalog.velocityRange.min, Math.min(veloMaxParam, catalog.velocityRange.max))
      : null;
  const constrainedVeloMin =
    resolvedVeloMin !== null &&
    resolvedVeloMax !== null &&
    resolvedVeloMin > resolvedVeloMax
      ? resolvedVeloMax
      : resolvedVeloMin;
  const constrainedVeloMax =
    resolvedVeloMin !== null &&
    resolvedVeloMax !== null &&
    resolvedVeloMax < resolvedVeloMin
      ? resolvedVeloMin
      : resolvedVeloMax;

  useEffect(() => {
    if (resolvedPlayerSlug) {
      setSelectedPlayer(resolvedPlayerSlug);
    }
  }, [resolvedPlayerSlug, setSelectedPlayer]);

  useEffect(() => {
    const nextHref = buildExplorerHref({
      view,
      pathname,
      playerSlug: resolvedPlayerSlug,
      pitcherHand: isPitcher ? "all" : pitcherHandParam,
      season: resolvedSeasonUi,
      latestSeason,
      pitchType: resolvedPitchType,
      count: resolvedCount,
      event: resolvedEvent,
      veloMin: constrainedVeloMin,
      veloMax: constrainedVeloMax,
    });
    const currentHref = `${pathname}${window.location.search}`;
    if (currentHref !== nextHref) {
      window.history.replaceState(window.history.state, "", nextHref);
    }
  }, [
    constrainedVeloMax,
    constrainedVeloMin,
    isPitcher,
    latestSeason,
    pathname,
    pitcherHandParam,
    resolvedCount,
    resolvedEvent,
    resolvedPitchType,
    resolvedPlayerSlug,
    resolvedSeasonUi,
    view,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      const nextQuery = isPitcher
        ? readPitcherExplorerQuery(new URLSearchParams(window.location.search))
        : readHitterExplorerQuery(new URLSearchParams(window.location.search));
      setSelectedPlayerSlug(nextQuery.playerSlug);
      setPitcherHandParam(isPitcher ? "all" : hitterQuery.pitcherHand);
      setSeasonParam(nextQuery.season);
      setPitchTypeParam(nextQuery.pitchType);
      setCountParam(nextQuery.count);
      setEventParam(nextQuery.event);
      setVeloMinParam(nextQuery.veloMin);
      setVeloMaxParam(nextQuery.veloMax);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hitterQuery.pitcherHand, isPitcher]);

  const filteredEntries = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return entries;
    }

    return entries.filter((entry) => {
      const aliases = "matchedHitterNames" in entry ? entry.matchedHitterNames : [];
      const haystack = [entry.displayName, entry.playerSlug, ...aliases]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredSearch, entries]);

  const filteredPitches = useMemo(() => {
    if (!selectedEntry) {
      return [];
    }

    return filterExplorerPitches(view, selectedEntry.pitches, {
      season: resolvedSeasonUi === "all" ? null : resolvedSeasonUi,
      pitcherHand: isPitcher ? "all" : pitcherHandParam,
      pitchType: resolvedPitchType,
      count: resolvedCount,
      event: resolvedEvent,
      veloMin: constrainedVeloMin,
      veloMax: constrainedVeloMax,
    });
  }, [
    constrainedVeloMax,
    constrainedVeloMin,
    isPitcher,
    pitcherHandParam,
    resolvedCount,
    resolvedEvent,
    resolvedPitchType,
    resolvedSeasonUi,
    selectedEntry,
    view,
  ]);

  const filteredSummary = useMemo(
    () => summarizeExplorerPitches(view, filteredPitches),
    [filteredPitches, view]
  );
  const zoneBuckets = useMemo(
    () => buildExplorerZoneBuckets(view, filteredPitches),
    [filteredPitches, view]
  );
  const selectedBucket =
    selectedBucketId !== null
      ? zoneBuckets.find((bucket) => bucket.id === selectedBucketId) ?? null
      : null;
  const cellSummaries = useMemo(() => {
    const map = new Map<number, ExplorerSummary>();
    for (const cellId of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const cellPitches = filteredPitches.filter((pitch) => pitch.locationCell === cellId);
      map.set(cellId, summarizeExplorerPitches(view, cellPitches));
    }
    return map;
  }, [filteredPitches, view]);
  const rowSummaries = useMemo(() => {
    const map = new Map<number, ExplorerSummary>();
    for (const row of [0, 1, 2]) {
      const rowPitches = filteredPitches.filter(
        (pitch) =>
          pitch.locationCell !== undefined &&
          pitch.locationCell !== null &&
          cellRow(pitch.locationCell) === row
      );
      map.set(row, summarizeExplorerPitches(view, rowPitches));
    }
    return map;
  }, [filteredPitches, view]);
  const colSummaries = useMemo(() => {
    const map = new Map<number, ExplorerSummary>();
    for (const col of [0, 1, 2]) {
      const colPitches = filteredPitches.filter(
        (pitch) =>
          pitch.locationCell !== undefined &&
          pitch.locationCell !== null &&
          cellCol(pitch.locationCell) === col
      );
      map.set(col, summarizeExplorerPitches(view, colPitches));
    }
    return map;
  }, [filteredPitches, view]);
  const selectedCellSummary =
    selectedCellId !== null ? cellSummaries.get(selectedCellId) ?? null : null;
  const selectedRowSummary =
    selectedRowId !== null ? rowSummaries.get(selectedRowId) ?? null : null;
  const selectedColSummary =
    selectedColId !== null ? colSummaries.get(selectedColId) ?? null : null;
  const selectionSummary =
    selectedCellSummary ??
    selectedRowSummary ??
    selectedColSummary ??
    selectedBucket?.summary ??
    filteredSummary;
  const selectionPitches = useMemo(() => {
    if (selectedCellId !== null) {
      return filteredPitches.filter((pitch) => pitch.locationCell === selectedCellId);
    }
    if (selectedRowId !== null) {
      return filteredPitches.filter(
        (pitch) =>
          pitch.locationCell !== undefined &&
          pitch.locationCell !== null &&
          cellRow(pitch.locationCell) === selectedRowId
      );
    }
    if (selectedColId !== null) {
      return filteredPitches.filter(
        (pitch) =>
          pitch.locationCell !== undefined &&
          pitch.locationCell !== null &&
          cellCol(pitch.locationCell) === selectedColId
      );
    }

    return selectedBucket ? selectedBucket.pitches : filteredPitches;
  }, [filteredPitches, selectedBucket, selectedCellId, selectedColId, selectedRowId]);
  const selectionPitchMix = useMemo(
    () => buildExplorerPitchMix(view, selectionPitches),
    [selectionPitches, view]
  );
  const hiddenZonePitchCount = useMemo(
    () => hiddenExplorerZonePitchCount(view, filteredPitches),
    [filteredPitches, view]
  );
  const selectionLabel =
    selectedCellId !== null
      ? `Zone Cell ${selectedCellId}`
      : selectedRowId !== null
        ? `${ZONE_ROW_LABELS[selectedRowId]} Row`
        : selectedColId !== null
          ? `${ZONE_COL_LABELS[selectedColId]} Col`
          : selectedBucket
            ? selectedBucket.label
            : "Filtered Sample";

  const activeFilterChips = useMemo(() => {
    const chips = [
      { label: "Season", value: resolvedSeasonUi === "all" ? "All seasons" : resolvedSeasonUi },
    ];

    if (!isPitcher && pitcherHandParam !== "all") {
      chips.push({ label: "Pitcher Hand", value: `${pitcherHandParam}HP` });
    }
    if (resolvedPitchType) {
      chips.push({ label: "Pitch Type", value: resolvedPitchType });
    }
    if (resolvedCount) {
      chips.push({ label: "Count", value: resolvedCount });
    }
    if (resolvedEvent !== "all") {
      chips.push({ label: "Event", value: eventLabelForView(view, resolvedEvent) });
    }
    if (constrainedVeloMin !== null || constrainedVeloMax !== null) {
      chips.push({
        label: "Pitch Speed",
        value: `${constrainedVeloMin ?? catalog.velocityRange?.min ?? "—"}-${constrainedVeloMax ?? catalog.velocityRange?.max ?? "—"} mph`,
      });
    }

    return chips;
  }, [
    catalog.velocityRange?.max,
    catalog.velocityRange?.min,
    constrainedVeloMax,
    constrainedVeloMin,
    isPitcher,
    pitcherHandParam,
    resolvedCount,
    resolvedEvent,
    resolvedPitchType,
    resolvedSeasonUi,
    view,
  ]);

  function handleSelectPlayer(playerSlug: string) {
    setSearchInput("");
    setSelectedBucketId(null);
    setSelectedCellId(null);
    setSelectedRowId(null);
    setSelectedColId(null);
    setSelectedPlayerSlug(playerSlug);
  }

  function handleChangeView(nextView: ComparisonView) {
    if (nextView === view) {
      return;
    }

    const nextHref = buildExplorerHref({
      view: nextView,
      pathname,
      playerSlug: resolvedPlayerSlug,
      pitcherHand: nextView === "hitters" ? pitcherHandParam : "all",
      season: resolvedSeasonUi,
      latestSeason,
      pitchType: resolvedPitchType,
      count: resolvedCount,
      event:
        nextView === "pitchers"
          ? normalizePitcherEvent(resolvedEvent)
          : normalizeHitterEvent(resolvedEvent),
      veloMin: constrainedVeloMin,
      veloMax: constrainedVeloMax,
    });

    setSearchInput("");
    router.replace(nextHref);
  }

  const resultsVisible = deferredSearch.trim().length > 0 || !selectedEntry;
  const visibleResults = resultsVisible ? filteredEntries.slice(0, SEARCH_RESULT_LIMIT) : [];

  return (
    <div className="flex flex-col gap-6">
      <LeaderboardIntro
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Charting", href: "/charting" },
          { label: "Insights" },
        ]}
      >
        <LeaderboardHero
          tone="emerald"
          icon={ClipboardList}
          eyebrow="Charting"
          title={<>Player Comparison Visuals</>}
          description={heroDescriptionForView(view)}
          meta={
            <>
              <LeaderboardPill tone="emerald">
                {entries.length} {countNounForView(view)}
                {entries.length === 1 ? "" : "s"}
              </LeaderboardPill>
              <LeaderboardPill tone="neutral">
                {formatCount(totalPitches)} charted pitches
              </LeaderboardPill>
              <LeaderboardPill tone="neutral">
                {totalSeasons} season{totalSeasons === 1 ? "" : "s"}
              </LeaderboardPill>
            </>
          }
          summary={
            <LeaderboardStatBlock
              label="Zone Schema"
              value="9"
              detail="4 rough quadrants, heart, and 4 chase corners"
              emphasisClassName="text-emerald-300"
            />
          }
          side={
            <div className="grid gap-3">
              <Link
                href={`/charting/leaderboard?tab=${isPitcher ? "pitchers" : "hitters"}`}
                className="block"
              >
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 transition-smooth hover:border-emerald-400/35">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/20 bg-zinc-950/70 text-emerald-300">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
                        Compare
                      </div>
                      <div className="mt-1 text-sm font-semibold text-emerald-50">
                        Open {isPitcher ? "Pitcher" : "Hitter"} Leaderboard
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              <Link href="/charting/faq" className="block">
                <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/75 p-4 transition-smooth hover:border-emerald-400/25">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-300">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Reference
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-100">
                        Charting FAQ & metrics
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          }
        />
      </LeaderboardIntro>

      <LeaderboardToolbar>
        <div className="grid gap-5">
          <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1.2fr)_auto] xl:items-end">
            <ComparisonViewToggle view={view} onChange={handleChangeView} />

            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Player Search
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={searchPlaceholderForView(view)}
                  className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              {selectedEntry ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBucketId(null);
                    setSelectedCellId(null);
                    setSelectedRowId(null);
                    setSelectedColId(null);
                    setSelectedPlayerSlug(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
                >
                  Clear Player
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setPitcherHandParam("all");
                  setSeasonParam(null);
                  setPitchTypeParam(null);
                  setCountParam(null);
                  setEventParam("all");
                  setVeloMinParam(null);
                  setVeloMaxParam(null);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 transition-smooth hover:border-emerald-400/35 hover:bg-emerald-500/15"
              >
                <RotateCcw className="h-4 w-4" />
                Clear Filters
              </button>
            </div>
          </div>

          {resultsVisible ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {visibleResults.length === 0 ? (
                <div className="col-span-full flex min-h-32 items-center justify-center rounded-[1.4rem] border border-dashed border-zinc-800 bg-zinc-950/60 px-5 text-center text-sm text-zinc-500">
                  No {countNounForView(view)}s match this search.
                </div>
              ) : (
                visibleResults.map((entry) => (
                  <SearchResultCard
                    key={entry.playerSlug}
                    view={view}
                    entry={entry}
                    active={resolvedPlayerSlug === entry.playerSlug}
                    onClick={() => handleSelectPlayer(entry.playerSlug)}
                  />
                ))
              )}
            </div>
          ) : null}

          <div
            className={joinClasses(
              "grid gap-4 md:grid-cols-2",
              isPitcher ? "xl:grid-cols-4" : "xl:grid-cols-5"
            )}
          >
            <FilterSelect
              label="Season"
              value={resolvedSeasonUi}
              onChange={(value) => setSeasonParam(value === (latestSeason ?? "all") ? null : value)}
            >
              {latestSeason ? (
                <option value={latestSeason}>{latestSeason}</option>
              ) : (
                <option value="all">All seasons</option>
              )}
              <option value="all">All seasons</option>
              {catalog.seasons
                .filter((season) => season !== latestSeason)
                .map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
            </FilterSelect>

            {!isPitcher ? (
              <FilterSelect
                label="Pitcher Hand"
                value={pitcherHandParam}
                onChange={(value) => setPitcherHandParam(normalizePitcherHandFilter(value))}
              >
                {CHARTING_PLAYER_COMPARISON_PITCHER_HAND_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </FilterSelect>
            ) : null}

            <FilterSelect
              label="Pitch Type"
              value={resolvedPitchType ?? "all"}
              onChange={(value) => setPitchTypeParam(value === "all" ? null : value)}
            >
              <option value="all">All pitch types</option>
              {catalog.pitchTypes.map((pitchType) => (
                <option key={pitchType} value={pitchType}>
                  {pitchType}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Count"
              value={resolvedCount ?? "all"}
              onChange={(value) => setCountParam(value === "all" ? null : value)}
            >
              <option value="all">All counts</option>
              {catalog.counts.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Event / Result"
              value={resolvedEvent}
              onChange={(value) =>
                setEventParam(isPitcher ? normalizePitcherEvent(value) : normalizeHitterEvent(value))
              }
            >
              {eventOptionsForView(view).map((event) => (
                <option key={event.id} value={event.id}>
                  {event.label}
                </option>
              ))}
            </FilterSelect>
          </div>

          <div className="grid gap-4 xl:grid-cols-2 xl:items-end">
            <VelocityRangeControl
              label="Pitch Speed Min"
              boundary="min"
              value={constrainedVeloMin}
              fallback={catalog.velocityRange?.min ?? null}
              range={catalog.velocityRange}
              onChange={(next) => {
                if (!catalog.velocityRange) return;
                const safeMax = constrainedVeloMax ?? catalog.velocityRange.max;
                const safeNext = next === null ? null : Math.min(next, safeMax);
                setVeloMinParam(safeNext);
              }}
            />

            <VelocityRangeControl
              label="Pitch Speed Max"
              boundary="max"
              value={constrainedVeloMax}
              fallback={catalog.velocityRange?.max ?? null}
              range={catalog.velocityRange}
              onChange={(next) => {
                if (!catalog.velocityRange) return;
                const safeMin = constrainedVeloMin ?? catalog.velocityRange.min;
                const safeNext = next === null ? null : Math.max(next, safeMin);
                setVeloMaxParam(safeNext);
              }}
            />
          </div>
        </div>
      </LeaderboardToolbar>

      {selectedEntry ? (
        <>
          <LeaderboardPanel className="overflow-hidden">
            <div className="border-b border-zinc-800/80 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Current {isPitcher ? "Pitcher" : "Hitter"}
                  </div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-zinc-50">
                    {selectedEntry.displayName}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-400">
                    {isPitcher
                      ? "Single-player charting visuals modeled after the Savant workflow, scoped to the filters currently applied across this pitcher’s Babson charting data."
                      : "Single-player charting visuals modeled after the Savant workflow, scoped to the filters currently applied across this hitter’s Babson charting data."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/players/${selectedEntry.playerSlug}?tab=live-ab`}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-sm font-semibold text-zinc-200 transition-smooth hover:border-zinc-700 hover:text-white"
                  >
                    Open player page
                  </Link>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <LeaderboardPill key={`${chip.label}-${chip.value}`} tone="neutral">
                    {chip.label}: {chip.value}
                  </LeaderboardPill>
                ))}
              </div>
            </div>

            <div className="grid gap-6 px-5 py-5 sm:px-6 sm:py-6 xl:grid-cols-[minmax(20rem,0.95fr)_minmax(0,1.05fr)]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <MetricToggle view={view} value={selectedMetric} onChange={setSelectedMetric} />
                  <ZoneDisplayModeToggle value={zoneDisplayMode} onChange={setZoneDisplayMode} />
                </div>
                <ZoneCanvas
                  view={view}
                  buckets={zoneBuckets}
                  metricId={selectedMetric}
                  metricOptions={metricOptions}
                  displayMode={zoneDisplayMode}
                  selectedBucketId={selectedBucketId}
                  selectedCellId={selectedCellId}
                  selectedRowId={selectedRowId}
                  selectedColId={selectedColId}
                  cellSummaries={cellSummaries}
                  rowSummaries={rowSummaries}
                  colSummaries={colSummaries}
                  allSummary={filteredSummary}
                  allPitchCount={filteredSummary.totalPitches}
                  onSelectBucket={(id) => {
                    setSelectedBucketId(id);
                    setSelectedCellId(null);
                    setSelectedRowId(null);
                    setSelectedColId(null);
                  }}
                  onSelectCell={(id) => {
                    setSelectedCellId(id);
                    setSelectedBucketId(null);
                    setSelectedRowId(null);
                    setSelectedColId(null);
                  }}
                  onSelectRow={(id) => {
                    setSelectedRowId(id);
                    setSelectedCellId(null);
                    setSelectedBucketId(null);
                    setSelectedColId(null);
                  }}
                  onSelectCol={(id) => {
                    setSelectedColId(id);
                    setSelectedCellId(null);
                    setSelectedBucketId(null);
                    setSelectedRowId(null);
                  }}
                />
                <div className="rounded-[1.5rem] border border-zinc-800/80 bg-zinc-950/60 px-4 py-3 text-[11px] text-zinc-500">
                  {hiddenZonePitchCount > 0
                    ? `${hiddenZonePitchCount} filtered pitch${hiddenZonePitchCount === 1 ? "" : "es"} fall outside the visible rough-zone buckets and are omitted from the grid.`
                    : "All mapped pitches in the current sample land inside the visible rough-zone schema."}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.6rem] border border-zinc-800/80 bg-zinc-950/60 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Selection Scope
                  </div>
                  <div className="mt-2 text-lg font-black tracking-tight text-zinc-100">
                    {selectionLabel}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    {selectionSummary.totalPitches === filteredSummary.totalPitches
                      ? "Current filters with no zone slice applied."
                      : "Current filters with a zone-level slice applied."}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat label="Pitches" value={formatCount(selectionSummary.totalPitches)} tone="emerald" />
                  {isPitcher ? (
                    <>
                      <MiniStat
                        label="TBF"
                        value={formatCount(
                          (selectionSummary as PitcherComparisonSummary).plateAppearances
                        )}
                      />
                      <MiniStat
                        label="Strike%"
                        value={formatPct(
                          (selectionSummary as PitcherComparisonSummary).strikePct,
                          1
                        )}
                        tone="sky"
                      />
                      <MiniStat
                        label="Whiff%"
                        value={formatPct(
                          (selectionSummary as PitcherComparisonSummary).whiffPct,
                          1
                        )}
                      />
                      <MiniStat
                        label="BAA"
                        value={formatRate((selectionSummary as PitcherComparisonSummary).baa)}
                        tone="emerald"
                      />
                      <MiniStat
                        label="K%"
                        value={formatPct((selectionSummary as PitcherComparisonSummary).kPct, 1)}
                        tone="sky"
                      />
                    </>
                  ) : (
                    <>
                      <MiniStat
                        label="PA"
                        value={formatCount(
                          (selectionSummary as ChartingPlayerComparisonSummary).plateAppearances
                        )}
                      />
                      <MiniStat
                        label="Swing%"
                        value={formatPct(
                          (selectionSummary as ChartingPlayerComparisonSummary).swingPct,
                          1
                        )}
                        tone="sky"
                      />
                      <MiniStat
                        label="Whiff%"
                        value={formatPct(
                          (selectionSummary as ChartingPlayerComparisonSummary).whiffPct,
                          1
                        )}
                      />
                      <MiniStat
                        label="AVG"
                        value={formatRate(
                          (selectionSummary as ChartingPlayerComparisonSummary).battingAverage
                        )}
                        tone="emerald"
                      />
                      <MiniStat
                        label="wOBA"
                        value={formatRate((selectionSummary as ChartingPlayerComparisonSummary).woba)}
                        tone="sky"
                      />
                    </>
                  )}
                </div>

                {/* Inline synthesis takeaways */}
                {(() => {
                  const takeaways = isPitcher
                    ? derivePitcherExplorerTakeaways(
                        selectionSummary as PitcherComparisonSummary,
                        selectionPitchMix,
                      )
                    : deriveHitterExplorerTakeaways(
                        selectionSummary as ChartingPlayerComparisonSummary,
                        selectionPitchMix,
                      );
                  if (takeaways.length === 0) return null;
                  return (
                    <div className="rounded-[1.7rem] border border-zinc-800/50 bg-zinc-950/40 px-5 py-4">
                      <ul className="space-y-1.5">
                        {takeaways.map((t) => (
                          <li key={t} className="text-sm leading-relaxed text-zinc-400">
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                <PitchMixPanel
                  title={
                    selectedCellId !== null
                      ? `Cell ${selectedCellId} Mix`
                      : selectedRowId !== null
                        ? `${ZONE_ROW_LABELS[selectedRowId]} Row Mix`
                        : selectedColId !== null
                          ? `${ZONE_COL_LABELS[selectedColId]} Col Mix`
                          : selectedBucket
                            ? `${selectedBucket.label} Mix`
                            : "Filtered Pitch Mix"
                  }
                  subtitle={
                    selectedCellId !== null
                      ? "Pitch distribution in this zone cell."
                      : selectedRowId !== null
                        ? "Pitch distribution across this horizontal row."
                        : selectedColId !== null
                          ? "Pitch distribution across this vertical column."
                          : selectedBucket
                            ? "Pitch distribution inside the active rough bucket."
                            : `Pitch distribution for the full filtered ${countNounForView(view)} scope.`
                  }
                  pitches={selectionPitchMix}
                />

                <div className="rounded-[1.6rem] border border-zinc-800/80 bg-zinc-950/60 p-4">
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Crosshair className="h-4 w-4 text-sky-300" />
                    <div className="text-sm font-bold tracking-tight">What This View Has</div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-400">
                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/70 px-3 py-2.5">
                      {isPitcher
                        ? "Exact player search, season scope, pitch type, count, event, and pitch-speed filters."
                        : "Exact player search, pitcher hand, season scope, pitch type, count, event, and pitch-speed filters."}
                    </div>
                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/70 px-3 py-2.5">
                      Same 9 rough zone buckets and the same heatmap versus sections layout used by the hitter visuals.
                    </div>
                    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/70 px-3 py-2.5">
                      {isPitcher
                        ? "Command and result metrics only in v1: Strike%, Whiff%, Chase%, BAA, filtered pitch mix, and the one-line summary table."
                        : "No exit velocity, launch-speed, or quality-of-contact controls in this visuals view."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </LeaderboardPanel>

          <SummaryTable
            view={view}
            entry={selectedEntry}
            seasonLabel={resolvedSeasonUi}
            summary={filteredSummary}
          />
        </>
      ) : (
        <EmptyState
          view={view}
          filteredEntries={filteredEntries}
          pinnedSlug={pinnedSlug}
          onOpenPinned={
            pinnedSlug && entryBySlug.has(pinnedSlug)
              ? () => setSelectedPlayerSlug(pinnedSlug)
              : null
          }
        />
      )}
    </div>
  );
}
