"use client";

import type { Pitch } from "../types";
import { config } from "@/lib/config";

interface Props {
  pitches: Pitch[];
}

const PAD = 40;
const SIZE = 320;
const INNER = SIZE - PAD * 2;
const GRID = 12; // 12×12 bins

function binIndex(inches: number): number {
  const range = config.plotMax - config.plotMin;
  const frac = (inches - config.plotMin) / range;
  return Math.min(GRID - 1, Math.max(0, Math.floor(frac * GRID)));
}

// Blue → yellow → red gradient
function heatColor(density: number, maxDensity: number): string {
  if (maxDensity === 0) return "transparent";
  const t = density / maxDensity;
  if (t === 0) return "transparent";
  // Interpolate hue from 240 (blue) → 60 (yellow) → 0 (red)
  const hue = 240 - t * 240;
  const lightness = 60 - t * 20;
  return `hsl(${hue}, 80%, ${lightness}%)`;
}

export default function Heatmap({ pitches }: Props) {
  // Build density grid
  const grid = Array.from({ length: GRID }, () => new Array(GRID).fill(0));
  for (const p of pitches) {
    const xi = binIndex(p.h_miss_signed);
    const yi = binIndex(p.v_miss_signed);
    grid[yi][xi]++;
  }
  const maxDensity = Math.max(1, ...grid.flat());

  const cellW = INNER / GRID;
  const cellH = INNER / GRID;

  // Strike zone rectangle
  const range = config.plotMax - config.plotMin;
  const toSvg = (inches: number) =>
    PAD + ((inches - config.plotMin) / range) * INNER;
  const zx1 = toSvg(-config.zoneWidth);
  const zx2 = toSvg(config.zoneWidth);
  const zy1 = toSvg(-config.zoneHeight);
  const zy2 = toSvg(config.zoneHeight);
  const cx = toSvg(0);
  const cy = toSvg(0);

  return (
    <div className="bg-zinc-900 rounded-lg p-3">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
        Miss Heatmap
      </h3>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-xs mx-auto">
        {/* Heat cells */}
        {grid.map((row, yi) =>
          row.map((count, xi) => (
            <rect
              key={`${yi}-${xi}`}
              x={PAD + xi * cellW}
              y={PAD + yi * cellH}
              width={cellW}
              height={cellH}
              fill={heatColor(count, maxDensity)}
              rx={1}
            />
          ))
        )}

        {/* Strike zone box */}
        <rect
          x={zx1}
          y={zy1}
          width={zx2 - zx1}
          height={zy2 - zy1}
          fill="none"
          stroke="#52525b"
          strokeWidth={1}
          strokeDasharray="4 2"
        />

        {/* Crosshair */}
        <line x1={PAD} x2={SIZE - PAD} y1={cy} y2={cy} stroke="#27272a" strokeWidth={0.5} />
        <line x1={cx} x2={cx} y1={PAD} y2={SIZE - PAD} stroke="#27272a" strokeWidth={0.5} />

        {/* Origin */}
        <circle cx={cx} cy={cy} r={2} fill="#52525b" />

        {/* Labels */}
        <text x={SIZE - PAD + 4} y={cy + 3} fill="#71717a" fontSize={8}>Arm</text>
        <text x={PAD - 4} y={cy + 3} fill="#71717a" fontSize={8} textAnchor="end">Glove</text>
        <text x={cx} y={PAD - 6} fill="#71717a" fontSize={8} textAnchor="middle">High</text>
        <text x={cx} y={SIZE - PAD + 12} fill="#71717a" fontSize={8} textAnchor="middle">Low</text>
      </svg>
    </div>
  );
}
