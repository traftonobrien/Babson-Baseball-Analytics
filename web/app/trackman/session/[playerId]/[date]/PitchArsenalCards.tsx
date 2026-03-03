"use client";

import { useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import type { TrackmanPitchTypeSummary } from "@/lib/trackman/metrics";

function fmt(v: number | null, decimals = 1): string {
  if (v === null) return "\u2014";
  return v.toFixed(decimals);
}

function accentBackground(color: string): string {
  return `radial-gradient(circle at 86% 14%, ${color}1f, transparent 26%), linear-gradient(180deg, rgba(24,24,27,0.88), rgba(9,9,11,0.96))`;
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
              className="group relative overflow-hidden rounded-[1.35rem] border border-zinc-800/90 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.20)] transition-smooth duration-300 hover:border-zinc-700"
              style={{ background: accentBackground(color) }}
            >
              <div
                className="absolute bottom-4 left-0 top-4 w-[3px] rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
              />
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

              <div className="pl-3">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <PitchTypeChip
                    pitchType={row.pitchType}
                    label={row.pitchType}
                    size="sm"
                  />
                  {row.count != null ? (
                    <span className="rounded-full border border-zinc-800 bg-zinc-950/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {row.count} pitch{row.count !== 1 ? "es" : ""}
                    </span>
                  ) : null}
                </div>

                <div className="mb-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tabular-nums text-zinc-50">
                    {fmt(row.avgVelo)}
                  </span>
                  <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    mph
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <Metric label="Spin" value={fmt(row.avgSpin, 0)} unit="rpm" />
                  <Metric label="IVB" value={fmt(row.avgIvb)} unit={"\u2033"} />
                  <Metric label="HB" value={fmt(row.avgHb)} unit={"\u2033"} />
                  <Metric label="Extension" value={fmt(row.avgExtension)} unit="ft" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
