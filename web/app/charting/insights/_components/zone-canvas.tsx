"use client";

import { useState } from "react";
import { SIZE } from "@/app/components/ZoneOverlay";
import { clipPathForLocationCell } from "@/lib/charting/locationGrid";
import type { ComparisonZoneBucketId } from "@/lib/charting/comparisonZones";

import type { ComparisonView } from "../explorerState";
import {
  formatMetricValue,
  joinClasses,
  metricValueForSummary,
} from "../_lib/helpers";
import {
  HEAT_BUCKET_SHAPES,
  SimpleZoneOverlay,
  ZONE_BUCKET_LAYOUT,
  ZONE_COL_LABELS,
  ZONE_ROW_LABELS,
  ZONE_SECTION_GRID_ITEMS,
  bucketHeat,
  bucketPalette,
  cellCol,
  cellHeat,
  cellRow,
  zoneSectionStyle,
} from "../_lib/zone-display";
import type {
  ComparisonMetricId,
  ComparisonMetricOption,
  ExplorerSummary,
  ExplorerZoneBucket,
  ZoneDisplayMode,
} from "../_lib/types";
import { ZoneSectionRegion } from "./zone-section-region";

export function ZoneCanvas({
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
  const [hoveredBucketId, setHoveredBucketId] = useState<ComparisonZoneBucketId | null>(null);
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
  const hasAnyFocus =
    focusCellId !== null || focusBucket !== null || focusRowId !== null || focusColId !== null;
  const displayedSummary =
    (selectedCellId !== null ? cellSummaries.get(selectedCellId) : null) ??
    (selectedRowId !== null ? rowSummaries.get(selectedRowId) : null) ??
    (selectedColId !== null ? colSummaries.get(selectedColId) : null) ??
    selectedBucket?.summary ??
    allSummary;
  const focusSummary =
    focusCellSummary ?? focusRowSummary ?? focusColSummary ?? focusBucket?.summary ?? null;
  const focusLabel =
    focusCellId !== null
      ? `Zone Cell ${focusCellId}`
      : focusRowId !== null
        ? `Row: ${ZONE_ROW_LABELS[focusRowId] ?? focusRowId}`
        : focusColId !== null
          ? `Col: ${ZONE_COL_LABELS[focusColId] ?? focusColId}`
          : focusLayout?.label ?? null;
  return (
    <div className="rounded-[1.9rem] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">
            {displayMode === "heatmap" ? "Pitch Heatmap" : "Zone Sections"}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#94A3B8]">
            <span>{activeMetric}</span>
            <span className="text-[#CBD5E1]">•</span>
            <span>
              {displayMode === "heatmap"
                ? "Pitch location adjusted to batter zone"
                : "Rough bucket sections"}
            </span>
            {selectedBucket || selectedCellId !== null || selectedRowId !== null || selectedColId !== null ? (
              <>
                <span className="text-[#CBD5E1]">•</span>
                <span className="text-[#334155]">
                  {selectedCellId !== null
                    ? `Cell ${selectedCellId}`
                    : selectedRowId !== null
                      ? `${ZONE_ROW_LABELS[selectedRowId]} row`
                      : selectedColId !== null
                        ? `${ZONE_COL_LABELS[selectedColId]} col`
                        : selectedBucket?.label} selected
                </span>
              </>
            ) : null}
          </div>
        </div>
        {selectedBucket || selectedCellId !== null || selectedRowId !== null || selectedColId !== null ? (
          <button
            type="button"
            onClick={() => {
              onSelectBucket(null);
              onSelectCell(null);
              onSelectRow(null);
              onSelectCol(null);
            }}
            className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B] transition-smooth hover:border-[#CBD5E1] hover:text-[#0F172A]"
          >
            Clear Selection
          </button>
        ) : null}
      </div>

      {displayMode === "heatmap" ? (
        <div className="relative aspect-[0.92] overflow-hidden rounded-[2.15rem] border border-[#E2E8F0] bg-[#EEF2FF] p-3">
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
                  "absolute rounded-[1.2rem] border border-transparent transition-smooth hover:border-slate-900/10",
                  selected ? "border-slate-900/20 bg-slate-900/[0.03]" : "bg-transparent",
                )}
                style={{
                  ...layout.style,
                  clipPath: layout.chaseKind ? clipPathForLocationCell(layout.chaseKind) : "none",
                }}
              />
            );
          })}
          <div className="pointer-events-none absolute inset-3 rounded-[1.9rem] border border-slate-900/5" />
        </div>
      ) : (
        <div className="relative rounded-[2.15rem] border border-[#E2E8F0] bg-[#F1F5F9] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#94A3B8]">Row</span>
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
                      ? "bg-sky-100 text-sky-700 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.30)]"
                      : "text-[#94A3B8] hover:bg-slate-200 hover:text-[#0F172A]",
                  )}
                >
                  {ZONE_ROW_LABELS[row]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#94A3B8]">Col</span>
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
                      ? "bg-sky-100 text-sky-700 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.30)]"
                      : "text-[#94A3B8] hover:bg-slate-200 hover:text-[#0F172A]",
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
                      if (isZoneCell) {
                        setHoveredCellId((current) => (current === item.cellId ? null : current));
                      } else {
                        setHoveredBucketId((current) => (current === bucket.id ? null : current));
                      }
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
          </div>

          {hasAnyFocus && focusSummary ? (
            <div className="pointer-events-none absolute right-3 top-16 rounded-[0.75rem] border border-[#E2E8F0] bg-white px-3 py-2 text-[11px] text-[#64748B] shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
              <div className="font-semibold text-[#0F172A]">{focusLabel}</div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span>
                  n=<span className="font-semibold text-[#0F172A]">{focusSummary.totalPitches}</span>
                </span>
                <span>
                  {activeMetric}{" "}
                  <span className="font-semibold text-[#0F172A]">
                    {formatMetricValue(view, metricId, metricValueForSummary(view, focusSummary, metricId))}
                  </span>
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}

    </div>
  );
}
