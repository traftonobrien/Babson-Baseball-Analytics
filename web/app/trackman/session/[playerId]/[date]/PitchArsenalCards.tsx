"use client";

import { useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import type { TrackmanPitchTypeSummary } from "@/lib/trackman/metrics";

function fmt(v: number | null, decimals = 1): string {
  if (v === null) return "\u2014";
  return v.toFixed(decimals);
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="text-sm font-mono text-zinc-200">
        {value}
        {unit && <span className="text-zinc-500 text-[10px] ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

export default function PitchArsenalCards({
  pitchTypes,
}: {
  pitchTypes: TrackmanPitchTypeSummary[];
}) {
  const sorted = useMemo(
    () => [...pitchTypes].sort((a, b) => (b.avgVelo ?? 0) - (a.avgVelo ?? 0)),
    [pitchTypes],
  );

  if (sorted.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-3">
        Pitch Arsenal
      </h3>
      <div className="flex flex-col gap-3">
        {sorted.map((row) => {
          const color = pitchColor(row.pitchType);
          return (
            <div
              key={row.pitchType}
              className="relative bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-hidden transition-smooth duration-300 hover:border-zinc-700"
            >
              {/* Colored accent bar */}
              <div
                className="absolute top-0 left-0 w-full h-0.5"
                style={{ backgroundColor: color }}
              />
              {/* Pitch name + color dot */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-semibold text-zinc-100">
                  {row.pitchType}
                </span>
              </div>
              {/* Hero velo */}
              <div className="mb-3">
                <span className="text-3xl font-bold tabular-nums text-zinc-50">
                  {fmt(row.avgVelo)}
                </span>
                <span className="text-xs text-zinc-500 ml-1">mph</span>
              </div>
              {/* Secondary metrics */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <Metric label="Spin" value={fmt(row.avgSpin, 0)} unit="rpm" />
                <Metric label="IVB" value={fmt(row.avgIvb)} unit={"\u2033"} />
                <Metric label="HB" value={fmt(row.avgHb)} unit={"\u2033"} />
                <Metric label="Extension" value={fmt(row.avgExtension)} unit="ft" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
