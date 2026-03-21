"use client";

import type { CSSProperties } from "react";

import type { ComparisonView } from "../explorerState";
import { formatMetricValue, joinClasses, metricValueForSummary } from "../_lib/helpers";
import { ZONE_BUCKET_LAYOUT } from "../_lib/zone-display";
import type {
  ComparisonMetricId,
  ExplorerSummary,
  ExplorerZoneBucket,
} from "../_lib/types";

export function ZoneSectionRegion({
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
        className,
      )}
      style={{
        ...style,
        clipPath: clipPath ?? "none",
        borderRadius: chase ? "1.5rem" : "0.65rem",
        opacity: subdued ? (chase ? 0.28 : 0.4) : 1,
      }}
    >
      <span
        className={joinClasses(
          "absolute font-bold uppercase leading-none tracking-wider",
          chase
            ? joinClasses("text-[8px] text-zinc-500", labelCornerClass ?? "left-4 top-3")
            : "left-1.5 top-1.5 text-[8px] text-zinc-500",
        )}
      >
        {labelText}
      </span>

      {!chase && (
        <span
          className={joinClasses(
            "absolute inset-0 flex items-center justify-center font-black tabular-nums tracking-tight",
            empty
              ? "text-[11px] text-zinc-700"
              : lowSample
                ? "text-sm text-zinc-400"
                : "text-sm text-zinc-50",
          )}
        >
          {empty ? "—" : formatMetricValue(view, metricId, metricValue)}
        </span>
      )}

      {!empty && (
        <span
          className={joinClasses(
            "absolute leading-none tabular-nums",
            chase
              ? "bottom-3 right-3 text-[10px] font-semibold text-zinc-400"
              : "bottom-1.5 right-1.5 text-[8px] font-semibold text-zinc-500",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
