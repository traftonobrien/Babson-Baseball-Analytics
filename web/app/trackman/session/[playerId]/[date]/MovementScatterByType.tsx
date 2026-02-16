"use client";

import { useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import type { TrackmanPitchTypeSummary } from "@/lib/trackman/metrics";
import {
  normalizePitchTypeName,
  getMlbAvg,
  type CanonPitch,
} from "@/lib/mlbPitchAverages";
import { evaluateAutoRename, type AutoRenameResult } from "@/lib/autoRenamePitch";

/* ------------------------------------------------------------------ */
/*  Layout constants                                                   */
/* ------------------------------------------------------------------ */

const SIZE = 480;
const PAD = 40;
const PLOT = SIZE - 2 * PAD;
const CENTER = PAD + PLOT / 2;

const DOT_R = 7;
const HALO_R = 20;
const HALO_OPACITY = 0.14;
const HALO_STROKE_OPACITY = 0.25;

const MLB_DOT_R = 7;
const MLB_HALO_R = 18;
const MLB_OFFSET_HB = 0.6;   // inches rightward
const MLB_OFFSET_IVB = -0.6; // inches upward

/* Ring radii in inches */
const RING_INCHES = [6, 12, 18, 24];
const OUTER_RING = 27;

/* Label layout */
const LABEL_DX = 10;
const LABEL_DY_NAME = -8;
const LABEL_DY_METRICS = 3;
const MIN_LABEL_GAP = 18;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toSvg(value: number, maxAbs: number): number {
  return PAD + ((value / maxAbs + 1) / 2) * PLOT;
}

const AXIS_MAX = 27;

function fmt1(v: number | null): string {
  if (v === null) return "\u2014";
  return v.toFixed(1);
}

function inchesToPx(inches: number, maxAbs: number): number {
  return (inches / maxAbs) * (PLOT / 2);
}

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

/** Generate a unique SVG pattern ID for a color. */
function hatchId(color: string): string {
  return `hatch-${color.replace("#", "")}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MovementScatterByType({
  pitchTypes,
  hand,
}: {
  pitchTypes: TrackmanPitchTypeSummary[];
  hand?: "R" | "L";
}) {
  // Filter out "Other" and require valid movement data
  const valid = useMemo(
    () =>
      pitchTypes.filter(
        (p) =>
          p.avgHb !== null &&
          p.avgIvb !== null &&
          p.pitchType !== "Other",
      ),
    [pitchTypes],
  );

  // Auto-rename evaluation for each pitch type
  const renameMap = useMemo(() => {
    if (!hand) return new Map<string, AutoRenameResult>();
    const map = new Map<string, AutoRenameResult>();
    for (const p of valid) {
      map.set(p.pitchType, evaluateAutoRename(p.pitchType, p.avgIvb, p.avgHb, hand));
    }
    return map;
  }, [valid, hand]);

  // Collect unique colors for hatch pattern definitions
  const uniqueColors = useMemo(() => {
    const colors = new Set<string>();
    for (const p of valid) {
      const rename = renameMap.get(p.pitchType);
      const displayType = rename?.wasRenamed
        ? rename.reason!.bestPitch
        : p.pitchType;
      colors.add(pitchColor(displayType));
    }
    // Include legend color for the "MLB AVG" legend swatch
    colors.add("#71717a");
    return Array.from(colors);
  }, [valid, renameMap]);

  // MLB averages to render (only for pitch types we have)
  const mlbBubbles = useMemo(() => {
    if (!hand) return [];
    const seen = new Set<string>();
    const bubbles: {
      pitchType: string;
      canonPitch: CanonPitch;
      ivb: number;
      hb: number;
      color: string;
    }[] = [];

    for (const p of valid) {
      const rename = renameMap.get(p.pitchType);
      const displayType = rename?.wasRenamed
        ? rename.reason!.bestPitch
        : p.pitchType;
      const canon = normalizePitchTypeName(displayType);
      if (!canon || seen.has(canon)) continue;
      seen.add(canon);

      const mlb = getMlbAvg(hand, canon);
      if (!mlb) continue;

      bubbles.push({
        pitchType: displayType,
        canonPitch: canon,
        ivb: mlb.ivb,
        hb: mlb.hb,
        color: pitchColor(displayType),
      });
    }
    return bubbles;
  }, [valid, hand, renameMap]);

  const maxAbs = AXIS_MAX;

  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let v = -24; v <= 24; v += 6) {
      if (v !== 0) arr.push(v);
    }
    return arr;
  }, []);

  const rings = RING_INCHES;

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
        {/* Hatch pattern definitions for MLB avg bubbles */}
        <defs>
          {uniqueColors.map((color) => (
            <pattern
              key={hatchId(color)}
              id={hatchId(color)}
              width={4}
              height={4}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1={0} y1={0} x2={0} y2={4} stroke={color} strokeWidth={1.5} opacity={0.7} />
            </pattern>
          ))}
        </defs>

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

        {/* Outer edge ring */}
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

        {/* Subtle grid lines */}
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

        {/* MLB average bubbles (rendered behind player dots) */}
        {mlbBubbles.map((mlb) => {
          const x = toSvg(mlb.hb + MLB_OFFSET_HB, maxAbs);
          const y = toSvg(-(mlb.ivb + MLB_OFFSET_IVB), maxAbs);
          return (
            <g key={`mlb-${mlb.canonPitch}`} opacity={0.3}>
              <circle
                cx={x}
                cy={y}
                r={MLB_HALO_R}
                fill={`url(#${hatchId(mlb.color)})`}
              />
              <circle
                cx={x}
                cy={y}
                r={MLB_HALO_R}
                fill="none"
                stroke={mlb.color}
                strokeWidth={0.75}
              />
              <circle
                cx={x}
                cy={y}
                r={MLB_DOT_R}
                fill={`url(#${hatchId(mlb.color)})`}
                stroke={mlb.color}
                strokeWidth={0.75}
              />
            </g>
          );
        })}

        {/* Player pitch dots */}
        {valid.map((p) => {
          const rename = renameMap.get(p.pitchType);
          const displayType = rename?.wasRenamed
            ? rename.reason!.bestPitch
            : p.pitchType;
          const x = toSvg(p.avgHb!, maxAbs);
          const y = toSvg(-p.avgIvb!, maxAbs);
          const color = pitchColor(displayType);
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
              {/* Tooltip for auto-renamed pitches */}
              {rename?.wasRenamed && (
                <title>
                  Originally tagged {rename.originalType}. Auto-labeled because movement is closer to MLB {rename.reason!.bestPitch} average.
                </title>
              )}
            </g>
          );
        })}

        {/* Labels (rendered after dots so they sit on top) */}
        {labelPositions.map((lbl) => {
          const p = valid.find((v) => v.pitchType === lbl.key)!;
          const rename = renameMap.get(p.pitchType);
          const displayLabel = rename?.wasRenamed
            ? rename.displayType
            : p.pitchType;
          return (
            <g key={`lbl-${lbl.key}`}>
              <text x={lbl.x} y={lbl.y} className="fill-zinc-300 text-[10px]">
                {displayLabel}
              </text>
              <text
                x={lbl.x}
                y={lbl.y + LABEL_DY_METRICS - LABEL_DY_NAME}
                className="fill-zinc-500 text-[8px] font-mono"
              >
                {fmt1(p.avgIvb)} IVB / {fmt1(p.avgHb)} HB
              </text>
              {rename?.wasRenamed && (
                <title>
                  Originally tagged {rename.originalType}. Auto-labeled because movement is closer to MLB {rename.reason!.bestPitch} average.
                </title>
              )}
            </g>
          );
        })}

        {/* MLB AVG legend (top-right corner) */}
        {hand && mlbBubbles.length > 0 && (
          <g>
            <circle
              cx={PAD + PLOT - 50}
              cy={PAD + 14}
              r={6}
              fill={`url(#${hatchId("#71717a")})`}
              stroke="#71717a"
              strokeWidth={0.75}
              opacity={0.7}
            />
            <text
              x={PAD + PLOT - 40}
              y={PAD + 17}
              className="fill-zinc-500 text-[9px]"
            >
              MLB AVG
            </text>
          </g>
        )}

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
