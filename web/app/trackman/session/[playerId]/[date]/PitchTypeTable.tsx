"use client";

import { useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import type { TrackmanPitchTypeSummary, TrackmanSessionSummary } from "@/lib/trackman/metrics";

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

/** Stuff+ color by scouting scale */
function stuffPlusColor(v: number): string {
  if (v >= 110) return "bg-rose-600 text-white";
  if (v >= 100) return "bg-orange-500/80 text-white";
  if (v >= 90) return "bg-zinc-400 text-zinc-900";
  return "bg-sky-500/80 text-white";
}

export default function PitchTypeTable({
  pitchTypes,
  summary,
}: {
  pitchTypes: TrackmanPitchTypeSummary[];
  summary?: TrackmanSessionSummary | null;
}) {
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-zinc-800/50 text-zinc-400 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Pitch</th>
              {showCounts && <th className="px-3 py-2 text-right">#</th>}
              <th className="px-3 py-2 text-right">Stuff+</th>
              <th className="px-3 py-2 text-right">Avg Velo</th>
              <th className="px-3 py-2 text-right">Avg Spin</th>
              <th className="px-3 py-2 text-right">Avg IVB</th>
              <th className="px-3 py-2 text-right">Avg HB</th>
              <th className="px-3 py-2 text-right">Avg Ext</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pitchType} className="border-t border-zinc-800/50">
                <td className="px-3 py-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: pitchColor(row.pitchType) }}
                  />
                  {pitchName(row.pitchType)}
                </td>
                {showCounts && (
                  <td className="px-3 py-1.5 text-right font-mono">
                    {row.count ?? "\u2014"}
                  </td>
                )}
                <td className="px-3 py-1.5 text-right">
                  {row.meanStuffPlus != null ? (
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${stuffPlusColor(row.meanStuffPlus)}`}
                    >
                      {row.meanStuffPlus.toFixed(1)}
                    </span>
                  ) : (
                    <span className="font-mono text-zinc-500">—</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(row.avgVelo)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(row.avgSpin, 0)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(row.avgIvb)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(row.avgHb)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmt(row.avgExtension)}</td>
              </tr>
            ))}
            {summary && (
              <tr className="border-t border-zinc-700 bg-zinc-800/30 font-medium">
                <td className="px-3 py-1.5 text-zinc-400">Total</td>
                {showCounts && (
                  <td className="px-3 py-1.5 text-right font-mono">
                    {summary.totalPitches ?? "\u2014"}
                  </td>
                )}
                <td className="px-3 py-1.5" />
                <td className="px-3 py-1.5 text-right font-mono">
                  {fmt(summary.weightedAvgVelo)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {fmt(summary.weightedAvgSpin, 0)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {fmt(summary.weightedAvgIvb)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {fmt(summary.weightedAvgHb)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
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
