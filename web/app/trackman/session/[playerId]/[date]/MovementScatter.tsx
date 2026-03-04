"use client";

import { useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import { pitchDisplayName } from "@/lib/pitchNames";
import { uniquePitchTypes, type TrackmanPitch } from "@/lib/trackman/metrics";

const SIZE = 340;
const PAD = 40;
const PLOT = SIZE - 2 * PAD;

/** Map a value in inches to SVG x/y within the plot area. Origin is center. */
function toSvg(value: number, maxAbs: number): number {
  return PAD + ((value / maxAbs + 1) / 2) * PLOT;
}

/** Pick a nice round max for the axes (10, 15, 20, 25, 30…). */
function niceMax(raw: number): number {
  if (raw <= 10) return 10;
  if (raw <= 15) return 15;
  if (raw <= 20) return 20;
  if (raw <= 25) return 25;
  return Math.ceil(raw / 5) * 5;
}

export default function MovementScatter({ pitches }: { pitches: TrackmanPitch[] }) {
  const valid = useMemo(
    () => pitches.filter((p) => p.hb !== null && p.ivb !== null),
    [pitches],
  );
  const types = useMemo(() => uniquePitchTypes(valid), [valid]);

  // Symmetric range centered on 0
  const rawMax = useMemo(() => {
    if (valid.length === 0) return 20;
    const vals = valid.flatMap((p) => [Math.abs(p.hb!), Math.abs(p.ivb!)]);
    return Math.max(...vals);
  }, [valid]);
  const maxAbs = niceMax(rawMax + 1);

  // Tick values (negative through positive, skipping 0)
  const ticks = useMemo(() => {
    const step = maxAbs <= 15 ? 5 : 10;
    const arr: number[] = [];
    for (let v = -maxAbs; v <= maxAbs; v += step) {
      if (v !== 0) arr.push(v);
    }
    return arr;
  }, [maxAbs]);

  const cx = PAD + PLOT / 2;
  const cy = PAD + PLOT / 2;

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/65 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.28)]">
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        Movement Profile
      </h3>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[340px] mx-auto">
        {/* Plot background */}
        <rect x={PAD} y={PAD} width={PLOT} height={PLOT} fill="#18181b" rx={4} />

        {/* Grid lines at each tick */}
        {ticks.map((v) => {
          const pos = toSvg(v, maxAbs);
          return (
            <g key={v}>
              {/* Vertical grid */}
              <line x1={pos} y1={PAD} x2={pos} y2={PAD + PLOT} stroke="#27272a" strokeWidth={0.5} />
              {/* Horizontal grid */}
              <line x1={PAD} y1={pos} x2={PAD + PLOT} y2={pos} stroke="#27272a" strokeWidth={0.5} />
            </g>
          );
        })}

        {/* Zero axes (bolder) */}
        <line x1={PAD} y1={cy} x2={PAD + PLOT} y2={cy} stroke="#3f3f46" strokeWidth={1} />
        <line x1={cx} y1={PAD} x2={cx} y2={PAD + PLOT} stroke="#3f3f46" strokeWidth={1} />

        {/* Tick labels — X axis (HB) */}
        {ticks.map((v) => (
          <text
            key={`x${v}`}
            x={toSvg(v, maxAbs)}
            y={PAD + PLOT + 14}
            textAnchor="middle"
            className="fill-zinc-500 text-[9px] font-mono"
          >
            {v}
          </text>
        ))}

        {/* Tick labels — Y axis (IVB), inverted so positive is up */}
        {ticks.map((v) => (
          <text
            key={`y${v}`}
            x={PAD - 6}
            y={toSvg(-v, maxAbs) + 3}
            textAnchor="end"
            className="fill-zinc-500 text-[9px] font-mono"
          >
            {v}
          </text>
        ))}

        {/* Axis titles */}
        <text x={cx} y={SIZE - 2} textAnchor="middle" className="fill-zinc-500 text-[10px]">
          Horizontal Break (″)
        </text>
        <text
          x={8}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90, 8, ${cy})`}
          className="fill-zinc-500 text-[10px]"
        >
          Induced Vertical Break (″)
        </text>

        {/* Pitch dots */}
        {valid.map((p) => (
          <circle
            key={p.pitchNo}
            cx={toSvg(p.hb!, maxAbs)}
            cy={toSvg(-p.ivb!, maxAbs)}
            r={4.5}
            fill={pitchColor(p.pitchType)}
            opacity={0.8}
            stroke="#09090b"
            strokeWidth={0.5}
          />
        ))}

        {valid.length === 0 && (
          <text x={cx} y={cy} textAnchor="middle" className="fill-zinc-500 text-[11px]">
            No movement data
          </text>
        )}
      </svg>

      {/* Legend */}
      {types.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {types.map((type) => (
            <div key={type} className="flex items-center gap-1 text-[10px] text-zinc-400">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: pitchColor(type) }}
              />
              {pitchDisplayName(type)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
