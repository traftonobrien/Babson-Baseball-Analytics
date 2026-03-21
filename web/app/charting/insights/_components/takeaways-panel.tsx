"use client";

import type { ChartingPlayerComparisonSummary } from "@/lib/charting/playerComparison";
import type { PitcherComparisonSummary } from "@/lib/charting/pitcherComparison";

import { deriveHitterExplorerTakeaways, derivePitcherExplorerTakeaways } from "../_lib/takeaways";
import type { ComparisonPitchMixItem } from "../_lib/types";

export function TakeawaysPanel({
  isPitcher,
  summary,
  pitchMix,
}: {
  isPitcher: boolean;
  summary: ChartingPlayerComparisonSummary | PitcherComparisonSummary;
  pitchMix: ComparisonPitchMixItem[];
}) {
  const takeaways = isPitcher
    ? derivePitcherExplorerTakeaways(summary as PitcherComparisonSummary, pitchMix)
    : deriveHitterExplorerTakeaways(summary as ChartingPlayerComparisonSummary, pitchMix);

  if (takeaways.length === 0) return null;

  return (
    <div className="rounded-[1.7rem] border border-zinc-800/50 bg-zinc-950/40 px-5 py-4">
      <ul className="space-y-1.5">
        {takeaways.map((takeaway) => (
          <li key={takeaway} className="text-sm leading-relaxed text-zinc-400">
            {takeaway}
          </li>
        ))}
      </ul>
    </div>
  );
}
