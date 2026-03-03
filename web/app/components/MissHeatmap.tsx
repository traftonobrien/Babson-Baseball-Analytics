"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { Pitch } from "../types";
import { config } from "@/lib/config";
import { CatcherZoneOverlay, PAD, SIZE, INNER } from "./ZoneOverlay";
import { pitchArmSideX } from "@/lib/handedness";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  pitches: Pitch[];
  throwsHand: "R" | "L";
}

/** Resolution of the KDE grid (canvas pixels for the plot area). */
const RES = 200;

/* ------------------------------------------------------------------ */
/*  Quadrant-based hit/miss classification                             */
/* ------------------------------------------------------------------ */

const HIT_QUADRANTS = new Set(["DI", "DM", "MI", "MM"]);
const MISS_QUADRANTS = new Set(["DA", "MA", "UA"]);

/** Returns 1 for hit-spot, -1 for miss, 0 for unknown/ignored. */
function classifyPitch(p: Pitch): number {
  const q = (p.result_quadrant ?? "").trim().toUpperCase();
  if (HIT_QUADRANTS.has(q)) return 1;
  if (MISS_QUADRANTS.has(q)) return -1;
  return 0;
}

/* ------------------------------------------------------------------ */
/*  KDE helpers                                                        */
/* ------------------------------------------------------------------ */

function gaussianWeight(d2: number, sigma: number): number {
  return Math.exp(-d2 / (2 * sigma * sigma));
}

interface Fields {
  hitField: Float32Array;
  missField: Float32Array;
  densityField: Float32Array;
  maxDensity: number;
}

function buildFields(pitches: Pitch[], sigma: number, throwsHand: "R" | "L"): Fields {
  const n = RES;
  const hitField = new Float32Array(n * n);
  const missField = new Float32Array(n * n);
  const densityField = new Float32Array(n * n);

  const lo = config.plotMin;
  const range = config.plotMax - lo;
  const step = range / n;
  const radiusCells = Math.ceil((3 * sigma) / step);

  for (const p of pitches) {
    const hVal = pitchArmSideX(p, throwsHand);
    const vVal = p.v_miss_signed;
    if (hVal == null || vVal == null || isNaN(hVal) || isNaN(vVal)) continue;

    const cls = classifyPitch(p);
    if (cls === 0) continue; // unknown quadrant — skip

    const gcx = ((hVal - lo) / range) * n;
    const gcy = ((vVal - lo) / range) * n;

    const r0 = Math.max(0, Math.floor(gcy) - radiusCells);
    const r1 = Math.min(n - 1, Math.floor(gcy) + radiusCells);
    const c0 = Math.max(0, Math.floor(gcx) - radiusCells);
    const c1 = Math.min(n - 1, Math.floor(gcx) + radiusCells);

    for (let r = r0; r <= r1; r++) {
      const dy = (r + 0.5 - gcy) * step;
      for (let c = c0; c <= c1; c++) {
        const dx = (c + 0.5 - gcx) * step;
        const w = gaussianWeight(dx * dx + dy * dy, sigma);
        const idx = r * n + c;
        densityField[idx] += w;
        if (cls === 1) hitField[idx] += w;
        else missField[idx] += w;
      }
    }
  }

  let maxDensity = 0;
  for (let i = 0; i < n * n; i++) {
    if (densityField[i] > maxDensity) maxDensity = densityField[i];
  }

  return { hitField, missField, densityField, maxDensity };
}

/* ------------------------------------------------------------------ */
/*  Color mapping                                                      */
/*  value +1 (hit spot) => warm red                                    */
/*  value  0            => dark neutral                                */
/*  value -1 (miss)     => cool blue                                   */
/* ------------------------------------------------------------------ */

function valueToRgb(value: number): [number, number, number] {
  // value in [-1, +1]
  // -1 → blue (60, 110, 220)
  //  0 → dark neutral (50, 50, 58)
  // +1 → red  (220, 50, 35)
  if (value <= 0) {
    const t = value + 1; // 0..1 where 0=full blue, 1=neutral
    return [
      Math.round(60 + (50 - 60) * t),
      Math.round(110 + (50 - 110) * t),
      Math.round(220 + (58 - 220) * t),
    ];
  }
  // value > 0
  return [
    Math.round(50 + (220 - 50) * value),
    Math.round(50 + (50 - 50) * value),
    Math.round(58 + (35 - 58) * value),
  ];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MissHeatmap({ pitches, throwsHand }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldsRef = useRef<Fields | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    value: number;
    hitPct: number;
  } | null>(null);

  const sigma = 1.8;
  const gamma = 0.55;

  /* ---- Draw ---- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fields = buildFields(pitches, sigma, throwsHand);
    fieldsRef.current = fields;
    const { hitField, missField, densityField, maxDensity } = fields;
    const n = RES;
    const eps = 1e-6;

    const imgData = ctx.createImageData(n, n);
    const d = imgData.data;

    for (let i = 0; i < n * n; i++) {
      const density = densityField[i];
      if (density < eps) {
        d[i * 4 + 3] = 0;
        continue;
      }

      const hitW = hitField[i];
      const missW = missField[i];
      const value = (hitW - missW) / (hitW + missW + eps); // -1..+1

      const intensity = Math.min(density / Math.max(maxDensity, eps), 1);
      const alpha = Math.pow(intensity, gamma) * 0.9;

      const [r, g, b] = valueToRgb(value);
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = Math.round(alpha * 255);
    }

    ctx.clearRect(0, 0, n, n);
    ctx.putImageData(imgData, 0, 0);
  }, [pitches, throwsHand]);

  useEffect(() => {
    draw();
  }, [draw]);

  /* ---- Tooltip ---- */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const wrapper = e.currentTarget;
      const rect = wrapper.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const vbX = (mx / rect.width) * SIZE;
      const vbY = (my / rect.height) * SIZE;

      if (vbX < PAD || vbX > SIZE - PAD || vbY < PAD || vbY > SIZE - PAD) {
        setTooltip(null);
        return;
      }

      const col = Math.floor(((vbX - PAD) / INNER) * RES);
      const row = Math.floor(((vbY - PAD) / INNER) * RES);
      if (col < 0 || col >= RES || row < 0 || row >= RES) {
        setTooltip(null);
        return;
      }

      const fields = fieldsRef.current;
      if (!fields) { setTooltip(null); return; }
      const idx = row * RES + col;
      const density = fields.densityField[idx];
      if (density < 0.01) { setTooltip(null); return; }

      const hitW = fields.hitField[idx];
      const missW = fields.missField[idx];
      const total = hitW + missW + 1e-6;
      const value = (hitW - missW) / total;
      const hitPct = (hitW / total) * 100;
      setTooltip({ x: mx, y: my, value, hitPct });
    },
    [],
  );

  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-zinc-800/80 bg-zinc-950/80 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Target Heatmap
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Zones represent where the catcher set up.
          </p>
        </div>
        <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Catcher View
        </span>
      </div>

      <p className="mb-3 text-xs text-zinc-500">
        Zones represent where the catcher set up &mdash; not where the pitch crossed the plate.
      </p>

      <div
        className="relative mx-auto w-full max-w-xs"
        style={{ aspectRatio: "1 / 1" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Canvas layer — heatmap pixels */}
        <canvas
          ref={canvasRef}
          width={RES}
          height={RES}
          className="absolute"
          style={{
            left: `${(PAD / SIZE) * 100}%`,
            top: `${(PAD / SIZE) * 100}%`,
            width: `${(INNER / SIZE) * 100}%`,
            height: `${(INNER / SIZE) * 100}%`,
            borderRadius: 4,
            imageRendering: "auto",
          }}
        />

        {/* SVG overlay — zone box, crosshair, quadrant labels */}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <CatcherZoneOverlay />
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-xl border border-zinc-700 bg-zinc-800/95 px-2 py-1 text-xs text-zinc-200"
            style={{ left: tooltip.x + 12, top: tooltip.y - 32 }}
          >
            Hit spot {Math.round(tooltip.hitPct)}%
          </div>
        )}
      </div>

      {/* Perspective caption */}
      <p className="mt-2 text-center text-xs text-zinc-500">
        Perspective: catcher view (looking at pitcher)
      </p>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-300">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: `rgb(${valueToRgb(1).join(",")})` }}
          />
          On target (DI / DM / MI / MM)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: `rgb(${valueToRgb(-1).join(",")})` }}
          />
          Missed target (DA / MA / UA)
        </span>
      </div>
      <p className="mt-2 text-center text-xs text-zinc-500">
        Color shows how often pitches hit the catcher&apos;s intended target zone.
      </p>
    </div>
  );
}
