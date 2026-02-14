"use client";

import { pitchColor } from "@/lib/pitchColors";
import type { TrackmanPitch } from "@/lib/trackman/metrics";

const SIZE = 260;
const PAD = 30;

function scale(value: number, min: number, max: number): number {
  const range = max - min || 1;
  return PAD + ((value - min) / range) * (SIZE - 2 * PAD);
}

export default function ReleaseScatter({ pitches }: { pitches: TrackmanPitch[] }) {
  const valid = pitches.filter((p) => p.relSide !== null && p.relHeight !== null);

  const sides = valid.map((p) => p.relSide!);
  const heights = valid.map((p) => p.relHeight!);
  const sMin = sides.length > 0 ? Math.min(...sides) - 0.2 : -3;
  const sMax = sides.length > 0 ? Math.max(...sides) + 0.2 : 3;
  const hMin = heights.length > 0 ? Math.min(...heights) - 0.2 : 4;
  const hMax = heights.length > 0 ? Math.max(...heights) + 0.2 : 7;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-3">
        Release Point
      </h3>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[260px] mx-auto">
        {/* Crosshair */}
        <line
          x1={PAD}
          y1={SIZE / 2}
          x2={SIZE - PAD}
          y2={SIZE / 2}
          stroke="#3f3f46"
          strokeWidth={0.5}
        />
        <line
          x1={SIZE / 2}
          y1={PAD}
          x2={SIZE / 2}
          y2={SIZE - PAD}
          stroke="#3f3f46"
          strokeWidth={0.5}
        />

        {/* Axis labels */}
        <text x={SIZE / 2} y={SIZE - 4} textAnchor="middle" className="fill-zinc-500 text-[9px]">
          Release Side (ft)
        </text>
        <text
          x={6}
          y={SIZE / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90, 6, ${SIZE / 2})`}
          className="fill-zinc-500 text-[9px]"
        >
          Release Height (ft)
        </text>

        {/* Dots */}
        {valid.map((p) => (
          <circle
            key={p.pitchNo}
            cx={scale(p.relSide!, sMin, sMax)}
            cy={SIZE - scale(p.relHeight!, hMin, hMax) + PAD}
            r={4}
            fill={pitchColor(p.pitchType)}
            opacity={0.8}
            stroke="#18181b"
            strokeWidth={0.5}
          />
        ))}

        {valid.length === 0 && (
          <text x={SIZE / 2} y={SIZE / 2} textAnchor="middle" className="fill-zinc-500 text-[11px]">
            No release data
          </text>
        )}
      </svg>
    </div>
  );
}
