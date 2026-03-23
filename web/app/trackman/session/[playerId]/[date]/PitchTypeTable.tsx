"use client";

import { useMemo } from "react";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { pitchDisplayName } from "@/lib/pitchNames";
import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import type { TrackmanPitchTypeSummary, TrackmanSessionSummary } from "@/lib/trackman/metrics";

function fmt(v: number | null, d = 1): string {
  if (v === null) return "\u2014";
  return v.toFixed(d);
}

export default function PitchTypeTable({
  pitchTypes,
  summary,
  variant = "dark",
}: {
  pitchTypes: TrackmanPitchTypeSummary[];
  summary?: TrackmanSessionSummary | null;
  /** `"light"` for Trackman player hub; session pages stay `"dark"` until migrated. */
  variant?: "dark" | "light";
}) {
  const light = variant === "light";
  const showCounts = summary?.totalPitches != null && summary?.pitchMixPct != null;

  const rows = useMemo(() => {
    const sorted = [...pitchTypes];
    if (showCounts && sorted.some((r) => r.count != null)) {
      sorted.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    } else {
      sorted.sort((a, b) => (b.avgVelo ?? 0) - (a.avgVelo ?? 0));
    }
    return sorted;
  }, [pitchTypes, showCounts]);

  return (
    <div
      className={
        light
          ? "overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]"
          : "overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/65 shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead
            className={
              light
                ? "bg-slate-50 uppercase text-slate-500 dark:text-zinc-400"
                : "bg-zinc-900/70 text-zinc-400 uppercase"
            }
          >
            <tr>
              <th className="px-5 py-3 text-left text-[10px] font-semibold tracking-[0.18em]">Pitch</th>
              {showCounts && <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Count</th>}
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Stuff+</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Avg Velocity</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Avg Spin</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Avg Vertical Break</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Avg Horizontal Break</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Avg Extension</th>
            </tr>
          </thead>
          <tbody
            className={light ? "divide-y divide-[#F1F5F9] text-slate-900 dark:text-zinc-50" : "divide-y divide-zinc-800/60"}
          >
            {rows.map((row) => (
              <tr
                key={row.pitchType}
                className={
                  light
                    ? "transition-smooth hover:bg-slate-50/80"
                    : "transition-smooth hover:bg-zinc-900/35"
                }
              >
                <td className="px-5 py-3">
                  <PitchTypeChip
                    pitchType={row.pitchType}
                    label={pitchDisplayName(row.pitchType)}
                    size="xs"
                    variant="soft"
                    className="align-middle"
                  />
                </td>
                {showCounts && (
                  <td className="px-5 py-3 text-right font-mono">
                    {row.count ?? "\u2014"}
                  </td>
                )}
                <td className="px-5 py-3 text-right">
                  {row.meanStuffPlus != null ? (
                    <span
                      className="inline-flex items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-tight"
                      style={plusMetricBadgeStyle(row.meanStuffPlus)}
                    >
                      {row.meanStuffPlus.toFixed(1)}
                    </span>
                  ) : (
                    <span className={light ? "font-mono text-slate-400 dark:text-zinc-500" : "font-mono text-zinc-500"}>—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-mono">{fmt(row.avgVelo)}</td>
                <td className="px-5 py-3 text-right font-mono">{fmt(row.avgSpin, 0)}</td>
                <td className="px-5 py-3 text-right font-mono">{fmt(row.avgIvb)}</td>
                <td className="px-5 py-3 text-right font-mono">{fmt(row.avgHb)}</td>
                <td className="px-5 py-3 text-right font-mono">{fmt(row.avgExtension)}</td>
              </tr>
            ))}
            {summary && (
              <tr
                className={
                  light
                    ? "bg-slate-50 font-medium text-slate-900 dark:text-zinc-50"
                    : "bg-zinc-900/45 font-medium text-zinc-300"
                }
              >
                <td className={light ? "px-5 py-3 text-slate-500 dark:text-zinc-400" : "px-5 py-3 text-zinc-400"}>
                  Session Total
                </td>
                {showCounts && (
                  <td className="px-5 py-3 text-right font-mono">
                    {summary.totalPitches ?? "\u2014"}
                  </td>
                )}
                <td className="px-5 py-3" />
                <td className="px-5 py-3 text-right font-mono">
                  {fmt(summary.weightedAvgVelo)}
                </td>
                <td className="px-5 py-3 text-right font-mono">
                  {fmt(summary.weightedAvgSpin, 0)}
                </td>
                <td className="px-5 py-3 text-right font-mono">
                  {fmt(summary.weightedAvgIvb)}
                </td>
                <td className="px-5 py-3 text-right font-mono">
                  {fmt(summary.weightedAvgHb)}
                </td>
                <td className="px-5 py-3 text-right font-mono">
                  {fmt(summary.weightedAvgExtension)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
