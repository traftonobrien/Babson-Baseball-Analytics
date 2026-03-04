"use client";

import { useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import { pitchDisplayName } from "@/lib/pitchNames";
import { deriveMetrics, type TrackmanPitch } from "@/lib/trackman/metrics";

function fmt(v: number | null, d = 1): string {
  if (v === null) return "\u2014";
  return v.toFixed(d);
}

export default function KpiCards({ pitches }: { pitches: TrackmanPitch[] }) {
  const rows = useMemo(() => {
    const countByType = new Map<string, number>();
    for (const p of pitches) {
      countByType.set(p.pitchType, (countByType.get(p.pitchType) ?? 0) + 1);
    }
    // Sort by count descending
    const types = Array.from(countByType.keys()).sort(
      (a, b) => countByType.get(b)! - countByType.get(a)!,
    );
    return types.map((type) => {
      const subset = pitches.filter((p) => p.pitchType === type);
      const kpis = deriveMetrics(subset);
      return { type, kpis };
    });
  }, [pitches]);

  const totals = useMemo(() => deriveMetrics(pitches), [pitches]);

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/65 shadow-[0_24px_64px_rgba(0,0,0,0.28)]">
      <div className="border-b border-zinc-800/80 px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Session Averages by Pitch
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/70 text-zinc-400 uppercase">
            <tr>
              <th className="px-5 py-3 text-left text-[10px] font-semibold tracking-[0.18em]">Pitch</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Count</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Avg Velocity</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Max Velocity</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Avg Spin</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Avg Vertical Break</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Avg Horizontal Break</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold tracking-[0.18em]">Avg Extension</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {rows.map(({ type, kpis }) => (
              <tr
                key={type}
                className="transition-smooth hover:bg-zinc-900/35"
              >
                <td className="px-5 py-3">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: pitchColor(type) }}
                  />
                  {pitchDisplayName(type)}
                </td>
                <td className="px-5 py-3 text-right font-mono">{kpis.count}</td>
                <td className="px-5 py-3 text-right font-mono">{fmt(kpis.avgVelo)}</td>
                <td className="px-5 py-3 text-right font-mono">{fmt(kpis.maxVelo)}</td>
                <td className="px-5 py-3 text-right font-mono">{fmt(kpis.avgSpin, 0)}</td>
                <td className="px-5 py-3 text-right font-mono">{fmt(kpis.avgIvb)}</td>
                <td className="px-5 py-3 text-right font-mono">{fmt(kpis.avgHb)}</td>
                <td className="px-5 py-3 text-right font-mono">{fmt(kpis.avgExtension)}</td>
              </tr>
            ))}
            <tr className="bg-zinc-900/45 font-medium text-zinc-300">
              <td className="px-5 py-3 text-zinc-400">Session Total</td>
              <td className="px-5 py-3 text-right font-mono">{totals.count}</td>
              <td className="px-5 py-3 text-right font-mono">{fmt(totals.avgVelo)}</td>
              <td className="px-5 py-3 text-right font-mono">{fmt(totals.maxVelo)}</td>
              <td className="px-5 py-3 text-right font-mono">{fmt(totals.avgSpin, 0)}</td>
              <td className="px-5 py-3 text-right font-mono">{fmt(totals.avgIvb)}</td>
              <td className="px-5 py-3 text-right font-mono">{fmt(totals.avgHb)}</td>
              <td className="px-5 py-3 text-right font-mono">{fmt(totals.avgExtension)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
