"use client";

import type { Filters, Pitch } from "../types";
import { uniqueTypes, uniqueQuadrants, pitchColor } from "../utils";

interface Props {
  pitches: Pitch[];
  filters: Filters;
  onChange: (f: Filters) => void;
}

export default function FilterPanel({ pitches, filters, onChange }: Props) {
  const types = uniqueTypes(pitches);
  const quads = uniqueQuadrants(pitches);

  const toggleType = (t: string) => {
    const next = new Set(filters.pitchTypes);
    next.has(t) ? next.delete(t) : next.add(t);
    onChange({ ...filters, pitchTypes: next });
  };

  const toggleQuad = (q: string) => {
    const next = new Set(filters.quadrants);
    next.has(q) ? next.delete(q) : next.add(q);
    onChange({ ...filters, quadrants: next });
  };

  return (
    <div className="space-y-4 text-sm">
      {/* Pitch type */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
          Pitch Type
        </h3>
        <div className="flex flex-wrap gap-2">
          {types.length === 0 ? (
            <span className="text-xs text-zinc-500 italic">No pitch types in data</span>
          ) : types.map((t) => {
            const active =
              filters.pitchTypes.size === 0 || filters.pitchTypes.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`px-2 py-0.5 rounded text-xs font-mono border transition-smooth ${
                  active
                    ? "border-zinc-500 text-white"
                    : "border-zinc-700 text-zinc-600"
                }`}
                style={active ? { backgroundColor: pitchColor(t) + "33" } : {}}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: pitchColor(t) }}
                />
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quadrant */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
          Result Quadrant
        </h3>
        <div className="flex flex-wrap gap-2">
          {quads.map((q) => {
            const active =
              filters.quadrants.size === 0 || filters.quadrants.has(q);
            return (
              <button
                key={q}
                onClick={() => toggleQuad(q)}
                className={`px-2 py-0.5 rounded text-xs font-mono border transition-smooth ${
                  active
                    ? "border-zinc-500 text-white bg-zinc-800"
                    : "border-zinc-700 text-zinc-600"
                }`}
              >
                {q}
              </button>
            );
          })}
        </div>
      </div>

      {/* Miss max */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
          Max Miss (inches)
        </h3>
        <input
          type="range"
          min={0}
          max={24}
          step={0.5}
          value={filters.maxMiss ?? 24}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange({ ...filters, maxMiss: v >= 24 ? null : v });
          }}
          className="w-full accent-blue-500"
        />
        <span className="text-zinc-400">
          {filters.maxMiss !== null ? `≤ ${filters.maxMiss}"` : "All"}
        </span>
      </div>

      {/* Reset */}
      <button
        onClick={() =>
          onChange({ pitchTypes: new Set(), quadrants: new Set(), maxMiss: null })
        }
        className="text-xs text-zinc-500 hover:text-zinc-300 underline"
      >
        Reset filters
      </button>
    </div>
  );
}
