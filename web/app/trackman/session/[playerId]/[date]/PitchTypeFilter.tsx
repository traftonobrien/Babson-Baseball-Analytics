"use client";

import { PitchTypeChip } from "@/components/ui/pitch-type-chip";

interface Props {
  allTypes: string[];
  activePitchTypes: Set<string>;
  onToggleType: (type: string) => void;
  onClearTypes: () => void;
}

export default function PitchTypeFilter({
  allTypes,
  activePitchTypes,
  onToggleType,
  onClearTypes,
}: Props) {
  const hasFilters = activePitchTypes.size > 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-2">
        {allTypes.map((type) => {
          const active = activePitchTypes.size === 0 || activePitchTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              className={`rounded-full transition-smooth ${
                active ? "opacity-100" : "opacity-40 hover:opacity-80"
              }`}
              aria-pressed={active}
            >
              <PitchTypeChip pitchType={type} label={type} size="xs" variant="solid" />
            </button>
          );
        })}
      </div>

      {hasFilters && (
        <button
          onClick={() => onClearTypes()}
          className="rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 transition-smooth hover:border-zinc-600 hover:text-zinc-200"
        >
          Reset
        </button>
      )}
    </div>
  );
}
