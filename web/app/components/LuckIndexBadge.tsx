"use client";

import { useState } from "react";
import type { LuckIndexResult } from "@/lib/charting/luckIndex";
import { luckBadgeClasses } from "@/lib/charting/luckIndex";

const CONFIDENCE_DOT: Record<string, string> = {
  low: "bg-slate-400 dark:bg-zinc-500",
  medium: "bg-slate-500 dark:bg-zinc-400",
  high: "bg-slate-700 dark:bg-zinc-200",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  low: "Small sample",
  medium: "Moderate sample",
  high: "Large sample",
};

function formatContribution(raw: number, weight: number): string {
  const sign = raw * weight >= 0 ? "+" : "";
  return `${sign}${(raw * weight * 25).toFixed(1)} pts`;
}

interface Props {
  result: LuckIndexResult;
  playerType: "pitcher" | "hitter";
  showBreakdown?: boolean;
}

export default function LuckIndexBadge({
  result,
  playerType,
  showBreakdown = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const badgeClasses = luckBadgeClasses(result, playerType);

  return (
    <div className="inline-flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => showBreakdown && setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold leading-none transition-smooth ${badgeClasses} ${showBreakdown ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
        aria-expanded={showBreakdown ? open : undefined}
      >
        <span className="font-mono tracking-tight">{result.score.toFixed(0)}</span>
        <span className="tracking-[0.04em]">{result.label}</span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${CONFIDENCE_DOT[result.confidence]}`}
          title={CONFIDENCE_LABEL[result.confidence]}
        />
      </button>

      {showBreakdown && open && (
        <div className="w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            Luck Breakdown
          </p>
          <div className="space-y-1.5">
            {result.components.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-600 dark:text-zinc-300">{c.label}</span>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    c.contribution > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : c.contribution < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-slate-400 dark:text-zinc-500"
                  }`}
                >
                  {formatContribution(c.raw, c.weight)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-400 dark:text-zinc-500">
            {CONFIDENCE_LABEL[result.confidence]} • 100 = neutral
          </p>
        </div>
      )}
    </div>
  );
}
