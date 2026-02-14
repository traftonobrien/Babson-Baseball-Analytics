"use client";

import { useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import type { TrackmanPitchTypeSummary } from "@/lib/trackman/metrics";

const SIZE = 340;
const PAD = 40;
const PLOT = SIZE - 2 * PAD;

function toSvg(value: number, maxAbs: number): number {
  return PAD + ((value / maxAbs + 1) / 2) * PLOT;
}

function niceMax(raw: number): number {
  if (raw <= 10) return 10;
  if (raw <= 15) return 15;
  if (raw <= 20) return 20;
  if (raw <= 25) return 25;
  return Math.ceil(raw / 5) * 5;
}

export default function MovementScatterByType({
  pitchTypes,
}: {
  pitchTypes: TrackmanPitchTypeSummary[];
}) {
  const valid = useMemo(
    () => pitchTypes.filter((p) => p.avgHb !== null && p.avgIvb !== null),
    [pitchTypes],
  );

  const rawMax = useMemo(() => {
    if (valid.length === 0) return 20;
    const vals = valid.flatMap((p) => [Math.abs(p.avgHb!), Math.abs(p.avgIvb!)]);
    return Math.max(...vals);
  }, [valid]);
  const maxAbs = niceMax(rawMax + 1);

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
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-3">
        Movement Profile (By Type)
      </h3>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[340px] mx-auto">
        <rect x={PAD} y={PAD} width={PLOT} height={PLOT} fill="#18181b" rx={4} />

        {ticks.map((v) => {
          const pos = toSvg(v, maxAbs);
          return (
            <g key={v}>
              <line x1={pos} y1={PAD} x2={pos} y2={PAD + PLOT} stroke="#27272a" strokeWidth={0.5} />
              <line x1={PAD} y1={pos} x2={PAD + PLOT} y2={pos} stroke="#27272a" strokeWidth={0.5} />
            </g>
          );
        })}

        <line x1={PAD} y1={cy} x2={PAD + PLOT} y2={cy} stroke="#3f3f46" strokeWidth={1} />
        <line x1={cx} y1={PAD} x2={cx} y2={PAD + PLOT} stroke="#3f3f46" strokeWidth={1} />

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

        {valid.map((p) => {
          const x = toSvg(p.avgHb!, maxAbs);
          const y = toSvg(-p.avgIvb!, maxAbs);
          return (
            <g key={p.pitchType}>
              <circle
                cx={x}
                cy={y}
                r={5}
                fill={pitchColor(p.pitchType)}
                opacity={0.85}
                stroke="#09090b"
                strokeWidth={0.5}
              />
              <text
                x={x + 6}
                y={y - 6}
                className="fill-zinc-400 text-[9px] font-mono"
              >
                {p.pitchType}
              </text>
            </g>
          );
        })}

        {valid.length === 0 && (
          <text x={cx} y={cy} textAnchor="middle" className="fill-zinc-500 text-[11px]">
            No movement data
          </text>
        )}
      </svg>
    </div>
  );
}
