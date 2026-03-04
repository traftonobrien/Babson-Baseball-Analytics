"use client";

import type { Filters, Pitch } from "../types";
import { uniqueTypes, pitchColor } from "../utils";
import { pitchDisplayName } from "@/lib/pitchNames";

interface Props {
  pitches: Pitch[];
  filters: Filters;
  onChange: (f: Filters) => void;
}

export default function FilterPanel({ pitches, filters, onChange }: Props) {
  const types = uniqueTypes(pitches);

  const toggleType = (t: string) => {
    const next = new Set(filters.pitchTypes);
    next.has(t) ? next.delete(t) : next.add(t);
    onChange({ ...filters, pitchTypes: next });
  };

  return (
    <div className="space-y-5 text-sm">
      {/* Pitch type */}
      <div className="space-y-2.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
          Pitch Type
        </h3>
        <div className="flex flex-wrap gap-2">
          {types.length === 0 ? (
            <span className="text-xs text-zinc-500 italic">No pitches in this view</span>
          ) : types.map((t) => {
            const active =
              filters.pitchTypes.size === 0 || filters.pitchTypes.has(t);
            const color = pitchColor(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-300 ${
                  active
                    ? "text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "border-zinc-800 bg-zinc-950/70 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
                style={
                  active
                    ? {
                        borderColor: `${color}55`,
                        background: `linear-gradient(135deg, ${color}22, rgba(9,9,11,0.92))`,
                        boxShadow: `0 0 0 1px ${color}12`,
                      }
                    : undefined
                }
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: color, boxShadow: active ? `0 0 10px ${color}` : "none" }}
                />
                {pitchDisplayName(t)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Miss max */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Max Miss
          </h3>
          <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            {filters.maxMiss !== null ? `≤ ${filters.maxMiss}"` : "All"}
          </span>
        </div>
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-3">
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
            className="w-full accent-orange-400"
          />
        </div>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={() => onChange({ pitchTypes: new Set(), maxMiss: null })}
        className="rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 transition-all duration-300 hover:border-zinc-700 hover:text-zinc-300"
      >
        Reset filters
      </button>
    </div>
  );
}
