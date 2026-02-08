"use client";

import type { ComparisonReport } from "@/lib/comparisonModel";
import { laneDisplayName } from "@/lib/reportModel";

interface Props {
  comparison: ComparisonReport["laneComparison"];
  pitcherHand: string;
}

function cell(v: number | null | undefined, unit: string, decimals: number = 1): string {
  if (v == null) return "\u2014";
  return `${v.toFixed(decimals)}${unit}`;
}

export default function CompareLaneTable({ comparison, pitcherHand }: Props) {
  return (
    <table className="w-full text-[10px] border-collapse">
      <thead>
        <tr className="text-left text-zinc-500 border-b border-zinc-600">
          <th className="py-[3px] pr-1.5 font-semibold">Lane</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">N (A)</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">N (B)</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">Avg Miss A</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">Avg Miss B</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">&Delta; Avg</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">On Tgt A</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">On Tgt B</th>
          <th className="py-[3px] text-right font-semibold">&Delta; Tgt</th>
        </tr>
      </thead>
      <tbody>
        {comparison.map((row, i) => {
          const stripe = i % 2 === 1 ? "bg-zinc-900/30" : "";
          const deltaAvgColor =
            row.deltaAvgMiss == null
              ? ""
              : row.deltaAvgMiss < 0
                ? "text-green-400"
                : row.deltaAvgMiss > 0
                  ? "text-red-400"
                  : "";
          const deltaTgtColor =
            row.deltaOnTargetPct == null
              ? ""
              : row.deltaOnTargetPct > 0
                ? "text-green-400"
                : row.deltaOnTargetPct < 0
                  ? "text-red-400"
                  : "";
          return (
            <tr
              key={row.lane}
              className={`border-b border-zinc-800/40 ${stripe}`}
            >
              <td className="py-[3px] pr-1.5 font-semibold">
                {laneDisplayName(row.lane, pitcherHand)}
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono">
                {row.sideA?.count ?? "\u2014"}
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono">
                {row.sideB?.count ?? "\u2014"}
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono">
                {cell(row.sideA?.avgMiss, "\u2033")}
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono">
                {cell(row.sideB?.avgMiss, "\u2033")}
              </td>
              <td className={`py-[3px] pr-1.5 text-right font-mono font-bold ${deltaAvgColor}`}>
                {row.deltaAvgMiss != null
                  ? `${row.deltaAvgMiss > 0 ? "+" : ""}${row.deltaAvgMiss.toFixed(1)}\u2033`
                  : "\u2014"}
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono">
                {cell(row.sideA?.onTargetPct, "%", 0)}
              </td>
              <td className="py-[3px] pr-1.5 text-right font-mono">
                {cell(row.sideB?.onTargetPct, "%", 0)}
              </td>
              <td className={`py-[3px] text-right font-mono font-bold ${deltaTgtColor}`}>
                {row.deltaOnTargetPct != null
                  ? `${row.deltaOnTargetPct > 0 ? "+" : ""}${row.deltaOnTargetPct.toFixed(0)}%`
                  : "\u2014"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
