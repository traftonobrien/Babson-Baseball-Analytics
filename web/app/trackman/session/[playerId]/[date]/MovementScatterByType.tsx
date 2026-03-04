"use client";

import { useMemo, useState } from "react";
import { pitchColor } from "@/lib/pitchColors";
import type { TrackmanPitchTypeSummary } from "@/lib/trackman/metrics";
import {
  normalizePitchTypeName,
  getMlbAvg,
  type CanonPitch,
} from "@/lib/mlbPitchAverages";
import { evaluateAutoRename, type AutoRenameResult } from "@/lib/autoRenamePitch";
import { ArmAngleOverlay } from "@/app/components/trackman/ArmAngleOverlay";
import { computeReleaseRaysByPitchType } from "@/lib/release_viz/selectors";

/* ------------------------------------------------------------------ */
/*  Layout constants                                                   */
/* ------------------------------------------------------------------ */

const SIZE = 480;
const PAD = 40;
const PLOT = SIZE - 2 * PAD;
const CENTER = PAD + PLOT / 2;

const DOT_R = 7;
const HALO_R = 20;
const HALO_OPACITY = 0.12;
const HALO_STROKE_OPACITY = 0.2;

const MLB_DOT_R = 7;
const MLB_HALO_R = 18;
const MLB_OFFSET_HB = 0.6;   // inches rightward
const MLB_OFFSET_IVB = -0.6; // inches upward

/* Ring radii in inches */
const RING_INCHES = [6, 12, 18, 24];
const OUTER_RING = 27;

/* Label layout */
const LABEL_SIDE_GAP = HALO_R + 12;
const LABEL_CARD_HEIGHT = 30;
const LABEL_CARD_MIN_WIDTH = 72;

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

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rectsOverlap(a: Rect, b: Rect, padding = 0): boolean {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

function rectIntersectsCircle(
  rect: Rect,
  cx: number,
  cy: number,
  r: number,
  padding = 0,
): boolean {
  const closestX = clamp(cx, rect.x, rect.x + rect.width);
  const closestY = clamp(cy, rect.y, rect.y + rect.height);
  const dx = cx - closestX;
  const dy = cy - closestY;
  const radius = r + padding;
  return dx * dx + dy * dy < radius * radius;
}

/** Generate a unique SVG pattern ID for a color. */
function hatchId(color: string): string {
  return `hatch-${color.replace("#", "")}`;
}

function labelGradientId(color: string): string {
  return `label-grad-${color.replace("#", "")}`;
}

function hexToRgbChannels(value: string): string {
  const normalized = value.trim();
  const fullHex =
    normalized.startsWith("#") && normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;

  const match = /^#([0-9a-f]{6})$/i.exec(fullHex);
  if (!match) return "113, 113, 122";

  const hex = match[1];
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
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
  const [hoveredPitchType, setHoveredPitchType] = useState<string | null>(null);
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

  const labelCards = useMemo(() => {
    const plotLeft = PAD + 8;
    const plotTop = PAD + 8;
    const plotRight = PAD + PLOT - 8;
    const plotBottom = PAD + PLOT - 8;
    const occupied: Rect[] = [];
    const legendRect: Rect | null =
      hand && mlbBubbles.length > 0
        ? {
            x: PAD + PLOT - 92,
            y: PAD + 4,
            width: 92,
            height: 24,
          }
        : null;

    const pitchCircles = valid.map((p) => ({
      x: toSvg(p.avgHb!, maxAbs),
      y: toSvg(-p.avgIvb!, maxAbs),
      r: HALO_R + 4,
      key: p.pitchType,
    }));

    const mlbCircles = mlbBubbles.map((mlb) => ({
      x: toSvg(mlb.hb + MLB_OFFSET_HB, maxAbs),
      y: toSvg(-(mlb.ivb + MLB_OFFSET_IVB), maxAbs),
      r: MLB_HALO_R + 3,
    }));

    return [...valid]
      .sort((a, b) => toSvg(-a.avgIvb!, maxAbs) - toSvg(-b.avgIvb!, maxAbs))
      .map((p) => {
        const rename = renameMap.get(p.pitchType);
        const displayLabel = rename?.wasRenamed
          ? rename.displayType
          : p.pitchType;
        const metrics = `${fmt1(p.avgIvb)} IVB • ${fmt1(p.avgHb)} HB`;
        const color = pitchColor(displayLabel);
        const pointX = toSvg(p.avgHb!, maxAbs);
        const pointY = toSvg(-p.avgIvb!, maxAbs);
        const cardWidth = Math.max(
          LABEL_CARD_MIN_WIDTH,
          displayLabel.length * 5.9 + 22,
          metrics.length * 4.15 + 22,
        );

        const rightX = pointX + LABEL_SIDE_GAP;
        const leftX = pointX - LABEL_SIDE_GAP - cardWidth;
        const rightFits = rightX + cardWidth <= plotRight;
        const leftFits = leftX >= plotLeft;
        const rightSpace = plotRight - (pointX + LABEL_SIDE_GAP + cardWidth);
        const leftSpace = pointX - LABEL_SIDE_GAP - cardWidth - plotLeft;

        const preferRight = (() => {
          if (pointY < CENTER - 28 && pointX > CENTER + 20) return false;
          if (pointY < CENTER - 28 && pointX < CENTER - 20) return true;
          return rightSpace >= leftSpace;
        })();

        const sideOrder = preferRight ? ["right", "left"] : ["left", "right"];
        const yOffsets = [0, -20, 20, -38, 38, -56, 56];

        let bestRect: Rect | null = null;
        let bestSide: "left" | "right" = sideOrder[0] as "left" | "right";
        let bestScore = Number.POSITIVE_INFINITY;

        for (const side of sideOrder) {
          const baseX = side === "right" ? rightX : leftX;
          if ((side === "right" && !rightFits) || (side === "left" && !leftFits)) {
            continue;
          }

          for (const offset of yOffsets) {
            const candidate: Rect = {
              x: baseX,
              y: clamp(
                pointY - LABEL_CARD_HEIGHT / 2 + offset,
                plotTop,
                plotBottom - LABEL_CARD_HEIGHT,
              ),
              width: cardWidth,
              height: LABEL_CARD_HEIGHT,
            };

            let score = Math.abs(offset);
            if (side !== sideOrder[0]) score += 18;

            for (const rect of occupied) {
              if (rectsOverlap(candidate, rect, 6)) {
                score += 1000;
              }
            }

            if (legendRect && rectsOverlap(candidate, legendRect, 4)) {
              score += 1000;
            }

            for (const circle of pitchCircles) {
              if (circle.key === p.pitchType) continue;
              if (rectIntersectsCircle(candidate, circle.x, circle.y, circle.r, 3)) {
                score += 140;
              }
            }

            for (const circle of mlbCircles) {
              if (rectIntersectsCircle(candidate, circle.x, circle.y, circle.r, 3)) {
                score += 90;
              }
            }

            if (score < bestScore) {
              bestScore = score;
              bestRect = candidate;
              bestSide = side as "left" | "right";
            }
          }
        }

        if (!bestRect) {
          const fallbackSide = rightFits ? "right" : "left";
          const fallbackX = fallbackSide === "right"
            ? clamp(rightX, plotLeft, plotRight - cardWidth)
            : clamp(leftX, plotLeft, plotRight - cardWidth);
          bestRect = {
            x: fallbackX,
            y: clamp(pointY - LABEL_CARD_HEIGHT / 2, plotTop, plotBottom - LABEL_CARD_HEIGHT),
            width: cardWidth,
            height: LABEL_CARD_HEIGHT,
          };
          bestSide = fallbackSide as "left" | "right";
        }

        occupied.push(bestRect);

        return {
          key: p.pitchType,
          displayLabel,
          metrics,
          color,
          rect: bestRect,
          textAlign: bestSide === "right" ? "start" : "start",
          rename,
        };
      });
  }, [hand, maxAbs, mlbBubbles, renameMap, valid]);

  const armAngleRays = useMemo(() => {
    if (!hand) return [];
    return computeReleaseRaysByPitchType(pitchTypes, hand);
  }, [pitchTypes, hand]);

  return (
    <div className="h-full overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/65 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.28)] flex flex-col">
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        Movement Profile (Induced Break)
      </h3>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-h-full aspect-square mx-auto flex-1">
        {/* Hatch pattern definitions for MLB avg bubbles */}
        <defs>
          {uniqueColors.map((color) => (
            <g key={color}>
              <pattern
                id={hatchId(color)}
                width={4}
                height={4}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1={0} y1={0} x2={0} y2={4} stroke={color} strokeWidth={1.5} opacity={0.7} />
              </pattern>
              <linearGradient id={labelGradientId(color)} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.14" />
                <stop offset="28%" stopColor={color} stopOpacity="0.06" />
                <stop offset="100%" stopColor="#09090b" stopOpacity="0.95" />
              </linearGradient>
            </g>
          ))}
        </defs>

        {/* Background */}
        <rect x={PAD} y={PAD} width={PLOT} height={PLOT} fill="#101116" rx={8} />

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
                strokeWidth={0.7}
                strokeDasharray="3 2"
                opacity={0.6}
              />
              <text
                x={CENTER + r + 2}
                y={CENTER - 3}
                className="fill-zinc-600 text-[8px] font-mono"
                opacity={0.75}
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
          opacity={0.35}
        />

        {/* Subtle grid lines */}
        {ticks.map((v) => {
          const pos = toSvg(v, maxAbs);
          return (
            <g key={`grid-${v}`}>
              <line x1={pos} y1={PAD} x2={pos} y2={PAD + PLOT} stroke="#1a1a1f" strokeWidth={0.5} opacity={0.45} />
              <line x1={PAD} y1={pos} x2={PAD + PLOT} y2={pos} stroke="#1a1a1f" strokeWidth={0.5} opacity={0.45} />
            </g>
          );
        })}

        {/* Crosshair axes */}
        <line x1={PAD} y1={CENTER} x2={PAD + PLOT} y2={CENTER} stroke="#3f3f46" strokeWidth={0.75} opacity={0.8} />
        <line x1={CENTER} y1={PAD} x2={CENTER} y2={PAD + PLOT} stroke="#3f3f46" strokeWidth={0.75} opacity={0.8} />

        {/* Axis tick labels */}
        {ticks.map((v) => (
          <text
            key={`xt-${v}`}
            x={toSvg(v, maxAbs)}
            y={PAD + PLOT + 15}
            textAnchor="middle"
            className="fill-zinc-600 text-[8px] font-mono"
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
            className="fill-zinc-600 text-[8px] font-mono"
          >
            {v}
          </text>
        ))}

        {/* Axis titles */}
        <text x={CENTER} y={SIZE - 4} textAnchor="middle" className="fill-zinc-600 text-[9px]">
          Horizontal Break ({"\u2033"})
        </text>
        <text
          x={10}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90, 10, ${CENTER})`}
          className="fill-zinc-600 text-[9px]"
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

        {/* Arm Angle Overlay */}
        {armAngleRays.length > 0 && hand && (
          <ArmAngleOverlay
            rays={armAngleRays}
            hand={hand}
            plotSize={PLOT}
            pad={PAD}
            maxAbs={maxAbs}
            hoveredPitchType={hoveredPitchType}
            onHoverPitchType={setHoveredPitchType}
          />
        )}

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
            <g
              key={p.pitchType}
              onMouseEnter={() => setHoveredPitchType(p.pitchType)}
              onMouseLeave={() => setHoveredPitchType(null)}
              style={{ cursor: "pointer" }}
            >
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
        {labelCards.map((label) => {
          return (
            <g key={`lbl-${label.key}`}>
              <rect
                x={label.rect.x}
                y={label.rect.y}
                width={label.rect.width}
                height={LABEL_CARD_HEIGHT}
                rx={8}
                fill={`url(#${labelGradientId(label.color)})`}
                stroke={`rgba(${hexToRgbChannels(label.color)}, 0.28)`}
                strokeWidth={0.85}
              />
              <line
                x1={label.rect.x + 10}
                y1={label.rect.y + 5.25}
                x2={label.rect.x + label.rect.width - 10}
                y2={label.rect.y + 5.25}
                stroke={label.color}
                strokeWidth={1}
                opacity={0.24}
                strokeLinecap="round"
              />
              <circle
                cx={label.rect.x + 10}
                cy={label.rect.y + 14.5}
                r={2.4}
                fill={label.color}
              />
              <text
                x={label.rect.x + 17}
                y={label.rect.y + 16}
                className="fill-zinc-200 text-[8px] font-semibold"
              >
                {label.displayLabel}
              </text>
              <text
                x={label.rect.x + 9}
                y={label.rect.y + 24.75}
                className="fill-zinc-500 text-[7px] font-mono"
              >
                {label.metrics}
              </text>
              {label.rename?.wasRenamed && (
                <title>
                  Originally tagged {label.rename.originalType}. Auto-labeled because movement is closer to MLB {label.rename.reason!.bestPitch} average.
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
              opacity={0.55}
            />
            <text
              x={PAD + PLOT - 40}
              y={PAD + 17}
              className="fill-zinc-600 text-[8px] uppercase tracking-[0.14em]"
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

      <p className="mt-1.5 text-center text-[9px] text-zinc-600">
        Halo radius is a visual cue only. PDF exports provide averages, not per-pitch variance.
      </p>
    </div>
  );
}
