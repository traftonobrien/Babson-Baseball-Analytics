"use client";

import { useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import type { TrackmanPitchTypeSummary } from "@/lib/trackman/metrics";

function fmt(v: number | null): string {
  if (v === null) return "\u2014";
  return v.toFixed(1);
}

export default function VeloByTypeBar({
  pitchTypes,
}: {
  pitchTypes: TrackmanPitchTypeSummary[];
}) {
  const rows = useMemo(
    () => pitchTypes.filter((p) => p.avgVelo !== null),
    [pitchTypes],
  );
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (b.avgVelo ?? 0) - (a.avgVelo ?? 0));
  }, [rows]);
  const maxVelo = sorted.length > 0 ? Math.max(...sorted.map((r) => r.avgVelo ?? 0)) : 1;

  const barHeight = 22;
  const gap = 6;
  const labelWidth = 52;
  const valueWidth = 44;
  const chartWidth = 220;
  const svgWidth = labelWidth + chartWidth + valueWidth;
  const svgHeight = sorted.length * (barHeight + gap) - gap + 8;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-3">
        Avg Velocity (By Type)
      </h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-zinc-500">No velocity data</p>
      ) : (
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full">
          {sorted.map((row, i) => {
            const y = i * (barHeight + gap);
            const value = row.avgVelo ?? 0;
            const barW = maxVelo > 0 ? (value / maxVelo) * (chartWidth - 4) : 0;
            return (
              <g key={row.pitchType}>
                <text
                  x={labelWidth - 6}
                  y={y + barHeight / 2 + 1}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-zinc-300 text-[11px] font-mono"
                >
                  {row.pitchType}
                </text>
                <rect
                  x={labelWidth}
                  y={y + 2}
                  width={barW}
                  height={barHeight - 4}
                  rx={3}
                  fill={pitchColor(row.pitchType)}
                  opacity={0.85}
                />
                <text
                  x={labelWidth + barW + 6}
                  y={y + barHeight / 2 + 1}
                  dominantBaseline="middle"
                  className="fill-zinc-500 text-[10px] font-mono"
                >
                  {fmt(row.avgVelo)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
