"use client";

import { useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import { deriveMetrics, type TrackmanPitch } from "@/lib/trackman/metrics";

const PITCH_NAMES: Record<string, string> = {
  FF: "Fastball",
  SI: "Sinker",
  SL: "Slider",
  CH: "Changeup",
  CU: "Curveball",
  FC: "Cutter",
  FS: "Splitter",
  KC: "Knuckle Curve",
  CB: "Curveball",
  CT: "Cutter",
};

function pitchName(abbr: string): string {
  return PITCH_NAMES[abbr] ?? abbr;
}

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
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-zinc-800/50 text-zinc-400 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Pitch</th>
              <th className="px-3 py-2 text-right">#</th>
              <th className="px-3 py-2 text-right">Avg Velo</th>
              <th className="px-3 py-2 text-right">Max Velo</th>
              <th className="px-3 py-2 text-right">Avg Spin</th>
              <th className="px-3 py-2 text-right">Avg IVB</th>
              <th className="px-3 py-2 text-right">Avg HB</th>
              <th className="px-3 py-2 text-right">Avg Ext</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ type, kpis }) => (
              <tr
                key={type}
                className="border-t border-zinc-800/50"
              >
                <td className="px-3 py-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: pitchColor(type) }}
                  />
                  {pitchName(type)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">{kpis.count}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(kpis.avgVelo)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(kpis.maxVelo)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(kpis.avgSpin, 0)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(kpis.avgIvb)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(kpis.avgHb)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(kpis.avgExtension)}</td>
              </tr>
            ))}
            {/* Totals row */}
            <tr className="border-t border-zinc-700 bg-zinc-800/30 font-medium">
              <td className="px-3 py-1.5 text-zinc-400">Total</td>
              <td className="px-3 py-1.5 text-right font-mono">{totals.count}</td>
              <td className="px-3 py-1.5 text-right font-mono">{fmt(totals.avgVelo)}</td>
              <td className="px-3 py-1.5 text-right font-mono">{fmt(totals.maxVelo)}</td>
              <td className="px-3 py-1.5 text-right font-mono">{fmt(totals.avgSpin, 0)}</td>
              <td className="px-3 py-1.5 text-right font-mono">{fmt(totals.avgIvb)}</td>
              <td className="px-3 py-1.5 text-right font-mono">{fmt(totals.avgHb)}</td>
              <td className="px-3 py-1.5 text-right font-mono">{fmt(totals.avgExtension)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
