"use client";

import { useState } from "react";
import { SIZE } from "@/app/components/ZoneOverlay";
import { clipPathForLocationCell } from "@/lib/charting/locationGrid";
import type { ComparisonZoneBucketId } from "@/lib/charting/comparisonZones";

import type { ComparisonView } from "../explorerState";
import {
  formatCount,
  formatMetricValue,
  formatPct,
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
  const focusShare =
    focusSummary && allPitchCount > 0 ? (focusSummary.totalPitches / allPitchCount) * 100 : null;

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
            {selectedBucket || selectedCellId !== null || selectedRowId !== null || selectedColId !== null ? (
              <>
                <span className="text-zinc-700">•</span>
                <span className="text-zinc-300">
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
                  selected ? "border-white/25 bg-white/[0.03]" : "bg-transparent",
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
                      : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200",
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
                      : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-200",
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
