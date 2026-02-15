"use client";

import { useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import type { TrackmanPitchTypeSummary } from "@/lib/trackman/metrics";

/* ------------------------------------------------------------------ */
/*  Layout constants                                                   */
/* ------------------------------------------------------------------ */

const SIZE = 480;
const PAD = 40;
const PLOT = SIZE - 2 * PAD;
const CENTER = PAD + PLOT / 2;

const DOT_R = 6;
const HALO_R = 16;
const HALO_OPACITY = 0.14;
const HALO_STROKE_OPACITY = 0.25;

/* Ring radii in inches — drawn as concentric circles from center */
const RING_INCHES = [6, 12, 18, 24];
const OUTER_RING = 27; // subtle edge ring past 24″, no label

/* Label layout */
const LABEL_DX = 10;
const LABEL_DY_NAME = -8;
const LABEL_DY_METRICS = 3;
const MIN_LABEL_GAP = 18; // px — nudge threshold

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toSvg(value: number, maxAbs: number): number {
  return PAD + ((value / maxAbs + 1) / 2) * PLOT;
}

/* Plot range extends slightly past 24″ so the outer ring fits */
const AXIS_MAX = 27;

function fmt1(v: number | null): string {
  if (v === null) return "\u2014";
  return v.toFixed(1);
}

/** Inches to SVG pixel radius for concentric ring. */
function inchesToPx(inches: number, maxAbs: number): number {
  return (inches / maxAbs) * (PLOT / 2);
}

/** Basic vertical nudge to avoid overlapping labels. */
function resolveCollisions(
  labels: { key: string; x: number; y: number }[],
): { key: string; x: number; y: number }[] {
  const sorted = [...labels].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = curr.y - prev.y;
    if (gap < MIN_LABEL_GAP) {
      const push = (MIN_LABEL_GAP - gap) / 2;
      prev.y -= push;
      curr.y += push;
    }
  }
  return sorted;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MovementScatterByType({
  pitchTypes,
}: {
  pitchTypes: TrackmanPitchTypeSummary[];
}) {
  const valid = useMemo(
    () => pitchTypes.filter((p) => p.avgHb !== null && p.avgIvb !== null),
    [pitchTypes],
  );

  const maxAbs = AXIS_MAX;

  /* Tick values for axis labels — every 6 inches, up to ±24 */
  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let v = -24; v <= 24; v += 6) {
      if (v !== 0) arr.push(v);
    }
    return arr;
  }, []);

  const rings = RING_INCHES;

  /* Pre-compute label positions with collision avoidance */
  const labelPositions = useMemo(() => {
    const raw = valid.map((p) => ({
      key: p.pitchType,
      x: toSvg(p.avgHb!, maxAbs) + LABEL_DX,
      y: toSvg(-p.avgIvb!, maxAbs) + LABEL_DY_NAME,
    }));
    return resolveCollisions(raw);
  }, [valid, maxAbs]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 h-full flex flex-col">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-4">
        Movement Profile (Induced Break)
      </h3>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-h-full aspect-square mx-auto flex-1">
        {/* Background */}
        <rect x={PAD} y={PAD} width={PLOT} height={PLOT} fill="#0f0f12" rx={4} />

        {/* Concentric rings */}
        {rings.map((inches) => {
          const r = inchesToPx(inches, maxAbs);
          return (
            <g key={`ring-${inches}`}>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={r}
                fill="none"
                stroke="#27272a"
                strokeWidth={0.75}
                strokeDasharray="3 2"
              />
              <text
                x={CENTER + r + 2}
                y={CENTER - 3}
                className="fill-zinc-600 text-[8px] font-mono"
              >
                {inches}{"\u2033"}
              </text>
            </g>
          );
        })}

        {/* Outer edge ring — no label */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={inchesToPx(OUTER_RING, maxAbs)}
          fill="none"
          stroke="#27272a"
          strokeWidth={0.5}
          strokeDasharray="2 3"
          opacity={0.5}
        />

        {/* Subtle grid lines (very faint) */}
        {ticks.map((v) => {
          const pos = toSvg(v, maxAbs);
          return (
            <g key={`grid-${v}`}>
              <line x1={pos} y1={PAD} x2={pos} y2={PAD + PLOT} stroke="#1a1a1f" strokeWidth={0.5} />
              <line x1={PAD} y1={pos} x2={PAD + PLOT} y2={pos} stroke="#1a1a1f" strokeWidth={0.5} />
            </g>
          );
        })}

        {/* Crosshair axes */}
        <line x1={PAD} y1={CENTER} x2={PAD + PLOT} y2={CENTER} stroke="#3f3f46" strokeWidth={0.75} />
        <line x1={CENTER} y1={PAD} x2={CENTER} y2={PAD + PLOT} stroke="#3f3f46" strokeWidth={0.75} />

        {/* Axis tick labels */}
        {ticks.map((v) => (
          <text
            key={`xt-${v}`}
            x={toSvg(v, maxAbs)}
            y={PAD + PLOT + 15}
            textAnchor="middle"
            className="fill-zinc-500 text-[9px] font-mono"
          >
            {v}
          </text>
        ))}
        {ticks.map((v) => (
          <text
            key={`yt-${v}`}
            x={PAD - 6}
            y={toSvg(-v, maxAbs) + 3}
            textAnchor="end"
            className="fill-zinc-500 text-[9px] font-mono"
          >
            {v}
          </text>
        ))}

        {/* Axis titles */}
        <text x={CENTER} y={SIZE - 4} textAnchor="middle" className="fill-zinc-500 text-[10px]">
          Horizontal Break ({"\u2033"})
        </text>
        <text
          x={10}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90, 10, ${CENTER})`}
          className="fill-zinc-500 text-[10px]"
        >
          Induced Vertical Break ({"\u2033"})
        </text>

        {/* Pitch dots */}
        {valid.map((p) => {
          const x = toSvg(p.avgHb!, maxAbs);
          const y = toSvg(-p.avgIvb!, maxAbs);
          const color = pitchColor(p.pitchType);
          return (
            <g key={p.pitchType}>
              {/* Outer halo disk */}
              <circle cx={x} cy={y} r={HALO_R} fill={color} opacity={HALO_OPACITY} />
              {/* Faint outline stroke */}
              <circle
                cx={x}
                cy={y}
                r={HALO_R}
                fill="none"
                stroke={color}
                strokeWidth={0.75}
                opacity={HALO_STROKE_OPACITY}
              />
              {/* Inner solid dot */}
              <circle cx={x} cy={y} r={DOT_R} fill={color} stroke="#0f0f12" strokeWidth={0.75} />
            </g>
          );
        })}

        {/* Labels (rendered after dots so they sit on top) */}
        {labelPositions.map((lbl) => {
          const p = valid.find((v) => v.pitchType === lbl.key)!;
          return (
            <g key={`lbl-${lbl.key}`}>
              <text x={lbl.x} y={lbl.y} className="fill-zinc-300 text-[10px]">
                {p.pitchType}
              </text>
              <text
                x={lbl.x}
                y={lbl.y + LABEL_DY_METRICS - LABEL_DY_NAME}
                className="fill-zinc-500 text-[8px] font-mono"
              >
                {fmt1(p.avgIvb)} IVB / {fmt1(p.avgHb)} HB
              </text>
            </g>
          );
        })}

        {valid.length === 0 && (
          <text x={CENTER} y={CENTER} textAnchor="middle" className="fill-zinc-500 text-[11px]">
            No movement data
          </text>
        )}
      </svg>

      <p className="text-[10px] text-zinc-600 mt-2 text-center">
        Halo radius is a visual cue only. PDF exports provide averages, not per-pitch variance.
      </p>
    </div>
  );
}
