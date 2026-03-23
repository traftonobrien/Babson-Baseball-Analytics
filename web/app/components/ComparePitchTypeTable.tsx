"use client";

import type { ComparisonReport } from "@/lib/comparisonModel";
import { pitchColor } from "@/lib/pitchColors";

interface Props {
  comparison: ComparisonReport["pitchTypeComparison"];
}

function cell(v: number | null | undefined, unit: string, decimals: number = 1): string {
  if (v == null) return "\u2014";
  return `${v.toFixed(decimals)}${unit}`;
}

export default function ComparePitchTypeTable({ comparison }: Props) {
  if (comparison.length === 0) {
    return <p className="text-[10px] italic text-slate-500 dark:text-zinc-400">No pitch type data.</p>;
  }

  return (
    <table className="w-full text-[10px] border-collapse">
      <thead>
        <tr className="border-b border-border text-left text-slate-500 dark:text-zinc-400">
          <th className="py-[3px] pr-1.5 font-semibold">Type</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">N (A)</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">N (B)</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">Avg Miss A</th>
          <th className="py-[3px] pr-1.5 text-right font-semibold">Avg Miss B</th>
          <th className="py-[3px] text-right font-semibold">&Delta; Avg</th>
        </tr>
      </thead>
      <tbody>
        {comparison.map((row, i) => {
          const stripe = i % 2 === 1 ? "bg-slate-50/90" : "";
          const deltaColor =
            row.deltaAvgMiss == null
              ? ""
              : row.deltaAvgMiss < 0
                ? "text-green-700"
                : row.deltaAvgMiss > 0
                  ? "text-red-600"
                  : "";
          return (
            <tr
              key={row.pitchType}
              className={`border-b border-slate-100 dark:border-zinc-800 ${stripe}`}
            >
              <td className="py-[3px] pr-1.5">
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
                    style={{ backgroundColor: pitchColor(row.pitchType) }}
                  />
                  <span className="font-mono font-bold text-[11px]">{row.pitchType}</span>
                </span>
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
              <td className={`py-[3px] text-right font-mono font-bold ${deltaColor}`}>
                {row.deltaAvgMiss != null
                  ? `${row.deltaAvgMiss > 0 ? "+" : ""}${row.deltaAvgMiss.toFixed(1)}\u2033`
                  : "\u2014"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
