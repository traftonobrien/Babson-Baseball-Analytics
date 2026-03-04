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
    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        Side {side}
      </label>
      <select
        value={selection.outingId ?? ""}
        onChange={(e) => {
          const val = e.target.value || null;
          onChange({ ...selection, playerId, outingId: val });
        }}
        className="mt-3 w-full rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 py-3 text-sm text-zinc-200 outline-none transition-smooth focus:border-orange-400/35"
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
