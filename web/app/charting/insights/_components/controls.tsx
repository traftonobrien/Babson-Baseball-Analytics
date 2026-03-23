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
          ? "border-emerald-300 bg-emerald-50 shadow-[0_4px_12px_rgba(16,185,129,0.10)]"
          : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-[#0F172A]">{entry.displayName}</div>
          <div className="mt-1 text-[11px] text-[#94A3B8]">
            {entry.seasons[0] ?? "No season"} • {formatCount(entry.totalPitches)} pitches
          </div>
        </div>
        <ArrowRight
          className={joinClasses(
            "mt-0.5 h-4 w-4 shrink-0",
            active ? "text-emerald-600" : "text-[#CBD5E1]",
          )}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
          {entry.sessionCount} session{entry.sessionCount === 1 ? "" : "s"}
        </span>
        {handLabel ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">
        {label}
      </div>
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-1.5">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm font-semibold text-[#0F172A] outline-none focus:border-[var(--brand-primary-border)] focus:bg-white"
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
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        View
      </span>
      <div className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F1F5F9] p-1">
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
                ? "bg-white text-[#0F172A] shadow-sm ring-1 ring-slate-200"
                : "text-[#64748B] hover:text-[#0F172A]",
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
      <div className="rounded-[1.4rem] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
          {label}
        </div>
        <div className="mt-2 text-sm text-[#94A3B8]">No tracked velocity</div>
      </div>
    );
  }

  const resolved = value ?? (boundary === "min" ? range.min : range.max);

  return (
    <div className="rounded-[1.4rem] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
          {label}
        </div>
        <span className="rounded-full border border-[#E2E8F0] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#334155]">
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
          className="w-full accent-[var(--brand-primary)]"
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-[#94A3B8]">
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
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        Metric
      </span>
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F1F5F9] p-1">
        {metricOptionsForView(view).map((metric) => (
          <button
            key={metric.id}
            type="button"
            onClick={() => onChange(metric.id)}
            className={joinClasses(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-smooth",
              value === metric.id
                ? "bg-white text-[#0F172A] shadow-sm ring-1 ring-slate-200"
                : "text-[#64748B] hover:text-[#0F172A]",
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
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        View
      </span>
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F1F5F9] p-1">
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
                ? "bg-white text-[#0F172A] shadow-sm ring-1 ring-slate-200"
                : "text-[#64748B] hover:text-[#0F172A]",
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
      ? "text-emerald-600"
      : tone === "sky"
        ? "text-sky-600"
        : "text-[#0F172A]";

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
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
    <div className="rounded-[1.6rem] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
            {title}
          </div>
          <div className="mt-1 text-[11px] text-[#94A3B8]">{subtitle}</div>
        </div>
        <div className="rounded-full border border-[#E2E8F0] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#334155]">
          {pitches.length} type{pitches.length === 1 ? "" : "s"}
        </div>
      </div>

      {pitches.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#E2E8F0] bg-white px-4 py-5 text-sm text-[#94A3B8]">
          No pitches in this sample.
        </div>
      ) : (
        <>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full border border-[#E2E8F0] bg-[#F1F5F9]">
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
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-3 py-2.5"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0 text-sm font-semibold text-[#0F172A]">{item.label}</div>
                <div className="text-xs text-[#94A3B8]">{formatCount(item.count)}</div>
                <div className="text-xs font-semibold text-[#334155]">
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
