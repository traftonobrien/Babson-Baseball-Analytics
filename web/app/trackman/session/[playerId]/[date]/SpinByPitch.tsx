"use client";

import { useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import { uniquePitchTypes, type TrackmanPitch } from "@/lib/trackman/metrics";

const W = 800;
const H = 200;
const PAD = { top: 20, right: 20, bottom: 30, left: 55 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

export default function SpinByPitch({ pitches }: { pitches: TrackmanPitch[] }) {
  const valid = useMemo(
    () => pitches.filter((p) => p.rpm !== null),
    [pitches],
  );
  const types = useMemo(() => uniquePitchTypes(valid), [valid]);

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    if (valid.length === 0) return { xMin: 1, xMax: 10, yMin: 1000, yMax: 3000 };
    const nos = valid.map((p) => p.pitchNo);
    const spins = valid.map((p) => p.rpm!);
    const sMin = Math.floor((Math.min(...spins) - 100) / 100) * 100;
    const sMax = Math.ceil((Math.max(...spins) + 100) / 100) * 100;
    return {
      xMin: Math.min(...nos),
      xMax: Math.max(...nos),
      yMin: sMin,
      yMax: sMax,
    };
  }, [valid]);

  function toX(pitchNo: number): number {
    const range = xMax - xMin || 1;
    return PAD.left + ((pitchNo - xMin) / range) * PW;
  }

  function toY(rpm: number): number {
    const range = yMax - yMin || 1;
    return PAD.top + PH - ((rpm - yMin) / range) * PH;
  }

  const yTicks = useMemo(() => {
    const range = yMax - yMin;
    const step = range > 1000 ? 500 : range > 400 ? 200 : 100;
    const ticks: number[] = [];
    let v = Math.ceil(yMin / step) * step;
    while (v <= yMax) {
      ticks.push(v);
      v += step;
    }
    return ticks;
  }, [yMin, yMax]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-3">
        Spin Rate by Pitch
      </h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="#18181b" rx={4} />

        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left} y1={toY(v)}
              x2={PAD.left + PW} y2={toY(v)}
              stroke="#27272a" strokeWidth={0.5}
            />
            <text
              x={PAD.left - 6} y={toY(v) + 3}
              textAnchor="end"
              className="fill-zinc-500 text-[9px] font-mono"
            >
              {v.toLocaleString()}
            </text>
          </g>
        ))}

        <text
          x={PAD.left + PW / 2} y={H - 4}
          textAnchor="middle"
          className="fill-zinc-500 text-[10px]"
        >
          Pitch Number
        </text>
        <text
          x={14} y={PAD.top + PH / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90, 14, ${PAD.top + PH / 2})`}
          className="fill-zinc-500 text-[10px]"
        >
          RPM
        </text>

        {valid.map((p) => (
          <circle
            key={p.pitchNo}
            cx={toX(p.pitchNo)}
            cy={toY(p.rpm!)}
            r={4}
            fill={pitchColor(p.pitchType)}
            opacity={0.8}
            stroke="#09090b"
            strokeWidth={0.5}
          />
        ))}

        {valid.length === 0 && (
          <text
            x={PAD.left + PW / 2} y={PAD.top + PH / 2}
            textAnchor="middle"
            className="fill-zinc-500 text-[11px]"
          >
            No spin data
          </text>
        )}
      </svg>

      {types.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {types.map((type) => (
            <div key={type} className="flex items-center gap-1 text-[10px] text-zinc-400">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: pitchColor(type) }}
              />
              {type}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
