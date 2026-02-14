"use client";

import { pitchColor } from "@/lib/pitchColors";
import type { TrackmanPitch } from "@/lib/trackman/metrics";

export default function PitchTypeChart({ pitches }: { pitches: TrackmanPitch[] }) {
  // Count by type
  const counts = new Map<string, number>();
  for (const p of pitches) {
    counts.set(p.pitchType, (counts.get(p.pitchType) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

  const barHeight = 24;
  const gap = 6;
  const labelWidth = 44;
  const countWidth = 36;
  const chartWidth = 300;
  const svgWidth = labelWidth + chartWidth + countWidth;
  const svgHeight = sorted.length * (barHeight + gap) - gap + 8;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-3">
        Pitch Usage
      </h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-zinc-500">No data</p>
      ) : (
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full"
          role="img"
          aria-label="Pitch type usage chart"
        >
          {sorted.map(([type, count], i) => {
            const y = i * (barHeight + gap);
            const barW = (count / maxCount) * (chartWidth - 4);
            return (
              <g key={type}>
                <text
                  x={labelWidth - 6}
                  y={y + barHeight / 2 + 1}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-zinc-300 text-[11px] font-mono"
                >
                  {type}
                </text>
                <rect
                  x={labelWidth}
                  y={y + 2}
                  width={barW}
                  height={barHeight - 4}
                  rx={3}
                  fill={pitchColor(type)}
                  opacity={0.85}
                />
                <text
                  x={labelWidth + barW + 6}
                  y={y + barHeight / 2 + 1}
                  dominantBaseline="middle"
                  className="fill-zinc-500 text-[10px] font-mono"
                >
                  {count}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
