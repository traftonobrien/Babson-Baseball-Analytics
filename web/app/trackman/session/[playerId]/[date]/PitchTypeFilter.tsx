"use client";

import { pitchColor } from "@/lib/pitchColors";

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
      {/* Pitch type toggles */}
      <div className="flex flex-wrap gap-1.5">
        {allTypes.map((type) => {
          const active = activePitchTypes.size === 0 || activePitchTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              className={`px-2.5 py-1 text-xs rounded-md font-mono transition-colors border ${
                active
                  ? "border-zinc-600 text-zinc-100"
                  : "border-zinc-800 text-zinc-500"
              }`}
              style={{
                backgroundColor: active ? pitchColor(type) + "33" : undefined,
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: pitchColor(type) }}
              />
              {type}
            </button>
          );
        })}
      </div>

      {/* Reset */}
      {hasFilters && (
        <button
          onClick={() => onClearTypes()}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}
