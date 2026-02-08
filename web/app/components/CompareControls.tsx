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
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Side {side}
      </span>
      <select
        value={selection.outingId ?? ""}
        onChange={(e) => {
          const val = e.target.value || null;
          onChange({ ...selection, playerId, outingId: val });
        }}
        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
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
