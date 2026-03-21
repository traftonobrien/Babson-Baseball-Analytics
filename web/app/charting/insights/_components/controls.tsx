"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { ChartingPlayerComparisonVelocityRange } from "@/lib/charting/playerComparison";

import type { ComparisonView } from "../explorerState";
import {
  formatCount,
  formatPct,
  handLabelForEntry,
  joinClasses,
  metricOptionsForView,
} from "../_lib/helpers";
import { placeholderVelocityText } from "../_lib/zone-display";
import type {
  ComparisonMetricId,
  ComparisonPitchMixItem,
  SearchResultCardProps,
  ZoneDisplayMode,
} from "../_lib/types";

export function SearchResultCard({
  view,
  entry,
  active,
  onClick,
}: SearchResultCardProps) {
  const handLabel = handLabelForEntry(view, entry);

  return (
    <button
      type="button"
      onClick={onClick}
      className={joinClasses(
        "rounded-[1.5rem] border px-4 py-4 text-left transition-smooth",
        active
          ? "border-emerald-400/35 bg-emerald-500/10 shadow-[0_22px_48px_rgba(16,185,129,0.10)]"
          : "border-zinc-800 bg-zinc-950/75 hover:border-zinc-700 hover:bg-zinc-950/90",
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
            active ? "text-emerald-300" : "text-zinc-600",
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

export function FilterSelect({
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

export function ComparisonViewToggle({
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
                : "text-zinc-500 hover:text-zinc-100",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function VelocityRangeControl({
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
                  : next,
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

export function MetricToggle({
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
                : "text-zinc-500 hover:text-zinc-100",
            )}
          >
            {metric.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ZoneDisplayModeToggle({
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
                : "text-zinc-500 hover:text-zinc-100",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MiniStat({
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

export function PitchMixPanel({
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
