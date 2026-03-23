import type { CSSProperties } from "react";

import { SIZE, toSvg } from "@/app/components/ZoneOverlay";
import { clipPathForLocationCell } from "@/lib/charting/locationGrid";
import { config } from "@/lib/config";
import type { ComparisonZoneBucketId } from "@/lib/charting/comparisonZones";

import {
  metricOptionsForView,
  metricValueForSummary,
} from "./helpers";
import type { ComparisonView } from "../explorerState";
import type {
  ComparisonMetricId,
  ExplorerSummary,
  ExplorerZoneBucket,
} from "./types";

export const ZONE_BUCKET_LAYOUT: Record<
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

export const HEAT_BUCKET_SHAPES: Record<
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

export const ZONE_SECTION_GRID_ITEMS: Array<{
  key: string;
  bucketId: ComparisonZoneBucketId;
  cellId?: number;
  className: string;
  labelText: string;
  clipPath?: string;
  labelCornerClass?: string;
  chase?: boolean;
}> = [
  {
    key: "chaseUpperLeft",
    bucketId: "chaseUpperLeft",
    className: "col-[1_/_span_2] row-[1_/_span_2]",
    labelText: "UL",
    clipPath: clipPathForLocationCell("topLeftCorner"),
    labelCornerClass: "left-4 top-3",
    chase: true,
  },
  {
    key: "chaseUpperRight",
    bucketId: "chaseUpperRight",
    className: "col-[4_/_span_2] row-[1_/_span_2]",
    labelText: "UR",
    clipPath: clipPathForLocationCell("topRightCorner"),
    labelCornerClass: "right-4 top-3",
    chase: true,
  },
  {
    key: "chaseLowerLeft",
    bucketId: "chaseLowerLeft",
    className: "col-[1_/_span_2] row-[4_/_span_2]",
    labelText: "LL",
    clipPath: clipPathForLocationCell("bottomLeftCorner"),
    labelCornerClass: "left-4 bottom-3",
    chase: true,
  },
  {
    key: "chaseLowerRight",
    bucketId: "chaseLowerRight",
    className: "col-[4_/_span_2] row-[4_/_span_2]",
    labelText: "LR",
    clipPath: clipPathForLocationCell("bottomRightCorner"),
    labelCornerClass: "right-4 bottom-3",
    chase: true,
  },
  { key: "cell-1", bucketId: "upperLeft", cellId: 1, className: "col-start-2 row-start-2", labelText: "1" },
  { key: "cell-2", bucketId: "upperLeft", cellId: 2, className: "col-start-3 row-start-2", labelText: "2" },
  { key: "cell-3", bucketId: "upperRight", cellId: 3, className: "col-start-4 row-start-2", labelText: "3" },
  { key: "cell-4", bucketId: "lowerLeft", cellId: 4, className: "col-start-2 row-start-3", labelText: "4" },
  { key: "cell-5", bucketId: "heart", cellId: 5, className: "col-start-3 row-start-3", labelText: "5" },
  { key: "cell-6", bucketId: "upperRight", cellId: 6, className: "col-start-4 row-start-3", labelText: "6" },
  { key: "cell-7", bucketId: "lowerLeft", cellId: 7, className: "col-start-2 row-start-4", labelText: "7" },
  { key: "cell-8", bucketId: "lowerRight", cellId: 8, className: "col-start-3 row-start-4", labelText: "8" },
  { key: "cell-9", bucketId: "lowerRight", cellId: 9, className: "col-start-4 row-start-4", labelText: "9" },
];

export const ZONE_ROW_LABELS = ["High", "Mid", "Low"] as const;
export const ZONE_COL_LABELS = ["L", "Ctr", "R"] as const;

export const bucketHeat = (
  view: ComparisonView,
  buckets: ExplorerZoneBucket[],
  bucket: ExplorerZoneBucket,
  metricId: ComparisonMetricId,
): number => {
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
};

export const cellHeat = (
  view: ComparisonView,
  cellSummaries: Map<number, ExplorerSummary>,
  cellId: number,
  metricId: ComparisonMetricId,
): number => {
  const option = metricOptionsForView(view).find((metric) => metric.id === metricId);
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map((id) => {
      const summary = cellSummaries.get(id);
      return summary ? metricValueForSummary(view, summary, metricId) : null;
    })
    .filter((value): value is number => value !== null);
  const summary = cellSummaries.get(cellId);
  const currentValue = summary ? metricValueForSummary(view, summary, metricId) : null;

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
};

export const cellRow = (cellId: number): number => Math.floor((cellId - 1) / 3);
export const cellCol = (cellId: number): number => (cellId - 1) % 3;

const interpolateChannel = (start: number, end: number, t: number): number => {
  return Math.round(start + (end - start) * t);
};

export const bucketPalette = (
  heat: number,
): { solid: string; glow: string; border: string } => {
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
};

const withAlpha = (color: string, alpha: number): string => {
  if (!color.startsWith("rgb(")) {
    return color;
  }
  return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
};

interface ZoneSectionStyleArgs {
  heat: number;
  selected: boolean;
  empty: boolean;
  chase?: boolean;
}

export const zoneSectionStyle = ({
  heat,
  selected,
  empty,
  chase = false,
}: ZoneSectionStyleArgs): CSSProperties => {
  if (empty) {
    return {
      borderColor: selected ? "rgba(99,102,241,0.30)" : "#E2E8F0",
      background: "#F8FAFC",
    };
  }

  const palette = bucketPalette(heat);
  const fillAlpha = chase ? 0.08 + heat * 0.10 : 0.13 + heat * 0.22;
  return {
    borderColor: selected
      ? "rgba(99,102,241,0.35)"
      : withAlpha(palette.solid, chase ? 0.18 : 0.30),
    background: withAlpha(palette.solid, fillAlpha),
  };
};

export const SimpleZoneOverlay = () => {
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
        stroke="rgba(15,23,42,0.05)"
      />
      <rect
        x={zx1}
        y={zy1}
        width={zw}
        height={zh}
        rx="8"
        fill="none"
        stroke="#94A3B8"
        strokeWidth="1.4"
        strokeDasharray="4 3"
      />
      <line x1={col1} x2={col1} y1={zy1} y2={zy2} stroke="#CBD5E1" strokeWidth="1" />
      <line x1={col2} x2={col2} y1={zy1} y2={zy2} stroke="#CBD5E1" strokeWidth="1" />
      <line x1={zx1} x2={zx2} y1={row1} y2={row1} stroke="#CBD5E1" strokeWidth="1" />
      <line x1={zx1} x2={zx2} y1={row2} y2={row2} stroke="#CBD5E1" strokeWidth="1" />
      <path
        d="M144 286h32l8 18-24 8-24-8 8-18z"
        fill="#94A3B8"
        opacity="0.25"
      />
    </g>
  );
};

export const placeholderVelocityText = (
  value: number | null,
  fallback: number | null,
  boundary: "min" | "max",
): string => {
  if (value !== null) return `${value} mph`;
  if (fallback === null) return "N/A";
  return boundary === "min" ? `${fallback} mph floor` : `${fallback} mph ceiling`;
};
