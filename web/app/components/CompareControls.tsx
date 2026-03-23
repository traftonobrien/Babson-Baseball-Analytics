"use client";

import type { Outing } from "@/lib/dataIndex";
import type { PitchSelection } from "@/lib/comparisonModel";

interface Props {
  side: "A" | "B";
  selection: PitchSelection;
  onChange: (selection: PitchSelection) => void;
  availableOutings: Outing[];
  playerId: string;
}

export default function CompareControls({
  side,
  selection,
  onChange,
  availableOutings,
  playerId,
}: Props) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col rounded-3xl border border-border bg-background p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-4">
      <label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-zinc-400">
        Side {side}
      </label>
      <select
        value={selection.outingId ?? ""}
        onChange={(e) => {
          const val = e.target.value || null;
          onChange({ ...selection, playerId, outingId: val });
        }}
        className="mt-2 w-full min-w-0 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-surface px-3 py-2.5 text-sm text-slate-900 dark:text-zinc-50 outline-none transition-smooth focus:border-[var(--brand-primary-border)] focus:ring-1 focus:ring-[var(--brand-primary-border)] sm:mt-2.5 sm:px-4 sm:py-3"
      >
        <option value="">Select outing...</option>
        {availableOutings.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
