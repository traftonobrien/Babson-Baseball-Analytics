"use client";

import type { Pitch } from "../types";
import { config } from "@/lib/config";
import { pitchColor } from "../utils";

interface Props {
  pitches: Pitch[];
  selected: Pitch | null;
  onSelect: (p: Pitch) => void;
}

const PAD = 40; // px padding for labels
const SIZE = 320; // svg viewBox logical size (square)
const INNER = SIZE - PAD * 2;

function toSvg(inches: number): number {
  const range = config.plotMax - config.plotMin;
  return PAD + ((inches - config.plotMin) / range) * INNER;
}

export default function StrikeZoneScatter({
  pitches,
  selected,
  onSelect,
}: Props) {
  // Strike zone rectangle (visual only)
  const zx1 = toSvg(-config.zoneWidth);
  const zx2 = toSvg(config.zoneWidth);
  const zy1 = toSvg(-config.zoneHeight);
  const zy2 = toSvg(config.zoneHeight);

  // Axes
  const cx = toSvg(0);
  const cy = toSvg(0);

  return (
    <div className="bg-zinc-900 rounded-lg p-3">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
        Miss Scatter (inches from target)
      </h3>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-xs mx-auto">
        {/* Strike zone box */}
        <rect
          x={zx1}
          y={zy1}
          width={zx2 - zx1}
          height={zy2 - zy1}
          fill="none"
          stroke="#3f3f46"
          strokeWidth={1}
          strokeDasharray="4 2"
        />

        {/* Crosshair at origin */}
        <line
          x1={PAD}
          x2={SIZE - PAD}
          y1={cy}
          y2={cy}
          stroke="#27272a"
          strokeWidth={0.5}
        />
        <line
          x1={cx}
          x2={cx}
          y1={PAD}
          y2={SIZE - PAD}
          stroke="#27272a"
          strokeWidth={0.5}
        />

        {/* Axis labels */}
        <text x={SIZE - PAD + 4} y={cy + 3} fill="#71717a" fontSize={8}>
          Arm
        </text>
        <text x={PAD - 4} y={cy + 3} fill="#71717a" fontSize={8} textAnchor="end">
          Glove
        </text>
        <text x={cx} y={PAD - 6} fill="#71717a" fontSize={8} textAnchor="middle">
          High
        </text>
        <text x={cx} y={SIZE - PAD + 12} fill="#71717a" fontSize={8} textAnchor="middle">
          Low
        </text>

        {/* Origin dot */}
        <circle cx={cx} cy={cy} r={3} fill="#3f3f46" />

        {/* Pitch dots */}
        {pitches.map((p) => {
          const px = toSvg(p.h_miss_signed);
          // Negate v so positive (low) goes down visually
          const py = toSvg(p.v_miss_signed);
          const isSel = selected?.pitch_number === p.pitch_number;
          return (
            <circle
              key={p.pitch_number}
              cx={px}
              cy={py}
              r={isSel ? 6 : 4}
              fill={pitchColor(p.pitch_type)}
              fillOpacity={isSel ? 1 : 0.7}
              stroke={isSel ? "#fff" : "none"}
              strokeWidth={isSel ? 1.5 : 0}
              className="cursor-pointer transition-all"
              onClick={() => onSelect(p)}
            >
              <title>
                #{p.pitch_number} {p.pitch_type} —{" "}
                {p.total_miss_inches.toFixed(1)}&quot;
              </title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
