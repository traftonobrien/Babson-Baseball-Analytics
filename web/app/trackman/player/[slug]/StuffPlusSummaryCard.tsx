"use client";

import {
  computeTotalStuffPlus,
  plusMetricBadgeStyle,
  stuffPlusAccentClass,
} from "@/lib/stuffPlusUtils";
import { useSiteAppearance } from "@/app/components/SiteAppearanceContext";

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
export default function StuffPlusSummaryCard({ arsenal, playerId: _playerId }: Props) {
  const isDark = useSiteAppearance() === "dark";
  if (arsenal.length === 0) return null;

  const total = computeTotalStuffPlus(arsenal);
  const accentBorder =
    total != null ? `border-l-2 ${stuffPlusAccentClass(total)}` : "";

  return (
    <div
      className={
        isDark
          ? `relative flex h-full min-h-[156px] flex-col overflow-hidden rounded-[1.2rem] border border-zinc-700 bg-zinc-900/50 p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] ${accentBorder}`
          : `relative flex h-full min-h-[156px] flex-col overflow-hidden rounded-[1.2rem] border border-border bg-surface p-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] ${accentBorder}`
      }
    >
      <div
        className={
          isDark
            ? "pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-zinc-600 to-transparent"
            : "pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"
        }
      />
      {total != null && (
        <>
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400">
                Total Stuff+
              </p>
              <p className="mt-1.5 text-[13px] text-slate-500 dark:text-zinc-400">
                Across the full Trackman sample.
              </p>
            </div>
            <div
              className={
                isDark
                  ? "shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
                  : "shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]"
              }
            >
              {arsenal.length} pitch type{arsenal.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="relative mt-3 flex flex-1 items-center">
            <div
              className="inline-flex h-[62px] min-w-[8.5rem] items-center justify-center rounded-[1rem] px-4 font-mono text-[2.35rem] font-black tracking-tight"
              style={plusMetricBadgeStyle(total)}
            >
              {total.toFixed(1)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
