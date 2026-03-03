"use client";

import {
  computeTotalStuffPlus,
  plusMetricBadgeStyle,
  stuffPlusAccentClass,
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
    total != null ? `border-l-2 ${stuffPlusAccentClass(total)}` : "";

  return (
    <div
      className={`relative flex h-full min-h-[156px] flex-col overflow-hidden rounded-[1.2rem] border border-zinc-800/85 bg-[radial-gradient(circle_at_84%_14%,rgba(59,130,246,0.05),transparent_22%),linear-gradient(180deg,rgba(24,24,27,0.84),rgba(9,9,11,0.96))] p-3.5 shadow-[0_14px_28px_rgba(0,0,0,0.14)] ${accentBorder}`}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      {total != null && (
        <>
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Total Stuff+
              </p>
              <p className="mt-1.5 text-[13px] text-zinc-500">
                Across the full Trackman sample.
              </p>
            </div>
            <div className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
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
