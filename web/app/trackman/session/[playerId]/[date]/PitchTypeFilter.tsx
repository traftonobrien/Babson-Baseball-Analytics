"use client";

import { pitchColor } from "@/lib/pitchColors";

interface Props {
  allTypes: string[];
  activePitchTypes: Set<string>;
  onToggleType: (type: string) => void;
  onClearTypes: () => void;
  veloMin: number | null;
  veloMax: number | null;
  onVeloMinChange: (v: number | null) => void;
  onVeloMaxChange: (v: number | null) => void;
}

export default function PitchTypeFilter({
  allTypes,
  activePitchTypes,
  onToggleType,
  onClearTypes,
  veloMin,
  veloMax,
  onVeloMinChange,
  onVeloMaxChange,
}: Props) {
  const hasFilters = activePitchTypes.size > 0 || veloMin !== null || veloMax !== null;

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

      {/* Velo range */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <span>Velo:</span>
        <input
          type="number"
          placeholder="Min"
          value={veloMin ?? ""}
          onChange={(e) => onVeloMinChange(e.target.value ? Number(e.target.value) : null)}
          className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <span>\u2013</span>
        <input
          type="number"
          placeholder="Max"
          value={veloMax ?? ""}
          onChange={(e) => onVeloMaxChange(e.target.value ? Number(e.target.value) : null)}
          className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
      </div>

      {/* Reset */}
      {hasFilters && (
        <button
          onClick={() => {
            onClearTypes();
            onVeloMinChange(null);
            onVeloMaxChange(null);
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}
