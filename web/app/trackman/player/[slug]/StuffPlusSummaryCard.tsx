"use client";

import {
  computeTotalStuffPlus,
  stuffPlusAccentClass,
  plusMetricBadgeStyle,
} from "@/lib/stuffPlusUtils";

interface StuffPlusPitch {
  pitchType: string;
  meanStuffPlus: number;
}

interface Props {
  arsenal: StuffPlusPitch[];
  playerId: string;
}

/**
 * Stuff+ hero card: Total Stuff+ number with color-coded badge and pitch count.
 */
export default function StuffPlusSummaryCard({ arsenal, playerId }: Props) {
  if (arsenal.length === 0) return null;

  const total = computeTotalStuffPlus(arsenal);
  const accentBorder =
    total != null ? `border-l-4 ${stuffPlusAccentClass(total)}` : "";

  return (
    <div
      className={`flex flex-col items-center justify-center h-full min-h-0 rounded-xl border border-zinc-800 overflow-hidden shadow-lg shadow-black/20 transition-smooth bg-zinc-900/80 p-5 ${accentBorder}`}
    >
      {total != null && (
        <>
          <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-2 font-medium">
            Total Stuff+
          </p>
          <div
            className="inline-flex items-center justify-center min-w-[4rem] rounded-xl px-4 py-2 font-mono text-3xl font-bold tracking-tight"
            style={plusMetricBadgeStyle(total)}
          >
            {total.toFixed(1)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            {arsenal.length} pitch type{arsenal.length !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>
  );
}
