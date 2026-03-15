"use client";

import { SIZE, toSvg } from "@/app/components/ZoneOverlay";
import { config } from "@/lib/config";

// ---------------------------------------------------------------------------
// Cell-to-bucket mapping (17-cell -> 9-bucket)
// ---------------------------------------------------------------------------

const CELL_TO_BUCKET: Record<number, string> = {
  1: "upperLeft",
  2: "upperLeft",
  3: "upperRight",
  4: "lowerLeft",
  5: "heart",
  6: "upperRight",
  7: "lowerLeft",
  8: "lowerRight",
  9: "lowerRight",
  11: "chaseUpperLeft",
  12: "chaseUpperRight",
  13: "chaseLowerLeft",
  14: "chaseLowerRight",
};

// ---------------------------------------------------------------------------
// Bucket shapes (ellipse coords in 320×320 SVG space)
// ---------------------------------------------------------------------------

type EllipseShape = { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number };

const HEAT_BUCKET_SHAPES: Record<string, EllipseShape> = {
  chaseUpperLeft:  { kind: "ellipse", cx: 106, cy: 96,  rx: 56, ry: 64 },
  chaseUpperRight: { kind: "ellipse", cx: 214, cy: 96,  rx: 56, ry: 64 },
  chaseLowerLeft:  { kind: "ellipse", cx: 106, cy: 228, rx: 58, ry: 68 },
  chaseLowerRight: { kind: "ellipse", cx: 214, cy: 228, rx: 58, ry: 68 },
  upperLeft:       { kind: "ellipse", cx: 124, cy: 122, rx: 48, ry: 40 },
  upperRight:      { kind: "ellipse", cx: 194, cy: 128, rx: 48, ry: 42 },
  lowerLeft:       { kind: "ellipse", cx: 124, cy: 194, rx: 54, ry: 48 },
  lowerRight:      { kind: "ellipse", cx: 200, cy: 198, rx: 54, ry: 48 },
  heart:           { kind: "ellipse", cx: 160, cy: 164, rx: 30, ry: 30 },
};

const BUCKET_ORDER = [
  "chaseUpperLeft", "chaseUpperRight", "chaseLowerLeft", "chaseLowerRight",
  "upperLeft", "upperRight", "lowerLeft", "lowerRight", "heart",
];

// ---------------------------------------------------------------------------
// Palette: blue (heat=0) → grey (heat=0.5) → red (heat=1)
// ---------------------------------------------------------------------------

function interpolateChannel(start: number, end: number, t: number) {
  return Math.round(start + (end - start) * t);
}

function bucketPalette(heat: number): string {
  if (heat <= 0.5) {
    const t = heat / 0.5;
    const start: [number, number, number] = [59, 130, 246];
    const end: [number, number, number] = [226, 232, 240];
    const rgb = start.map((v, i) => interpolateChannel(v, end[i]!, t));
    return `rgb(${rgb.join(",")})`;
  }
  const t = (heat - 0.5) / 0.5;
  const start: [number, number, number] = [254, 226, 226];
  const end: [number, number, number] = [239, 68, 68];
  const rgb = start.map((v, i) => interpolateChannel(v, end[i]!, t));
  return `rgb(${rgb.join(",")})`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SimpleZoneOverlay() {
  const zx1 = toSvg(-config.zoneWidth);
  const zx2 = toSvg(config.zoneWidth);
  const zy1 = toSvg(-config.zoneHeight);
  const zy2 = toSvg(config.zoneHeight);
  const zw = zx2 - zx1;
  const zh = zy2 - zy1;
  const col1 = zx1 + zw / 3;
  const col2 = zx1 + (2 * zw) / 3;
  const row1 = zy1 + zh / 3;
  const row2 = zy1 + (2 * zh) / 3;

  return (
    <g>
      <rect
        x="20"
        y="20"
        width={SIZE - 40}
        height={SIZE - 40}
        rx="28"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
      />
      <rect
        x={zx1}
        y={zy1}
        width={zw}
        height={zh}
        rx="8"
        fill="none"
        stroke="#71717a"
        strokeWidth="1.4"
        strokeDasharray="4 3"
      />
      <line x1={col1} x2={col1} y1={zy1} y2={zy2} stroke="#3f3f46" strokeWidth="1" />
      <line x1={col2} x2={col2} y1={zy1} y2={zy2} stroke="#3f3f46" strokeWidth="1" />
      <line x1={zx1} x2={zx2} y1={row1} y2={row1} stroke="#3f3f46" strokeWidth="1" />
      <line x1={zx1} x2={zx2} y1={row2} y2={row2} stroke="#3f3f46" strokeWidth="1" />
      <path d="M144 286h32l8 18-24 8-24-8 8-18z" fill="#d4d4d8" opacity="0.18" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PitcherZoneHeatmapProps {
  counts: Partial<Record<number, number>>;
  emptyLabel?: string;
}

export function PitcherZoneHeatmap({
  counts,
  emptyLabel = "No located pitches",
}: PitcherZoneHeatmapProps) {
  // Aggregate cell counts into buckets
  const bucketCounts: Record<string, number> = {};
  for (const [cellIdStr, count] of Object.entries(counts)) {
    const cellId = Number(cellIdStr);
    const bucket = CELL_TO_BUCKET[cellId];
    if (bucket) {
      bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + (count ?? 0);
    }
  }

  const maxCount = Math.max(0, ...Object.values(bucketCounts));
  const totalCount = Object.values(counts).reduce((s: number, c) => s + (c ?? 0), 0);

  return (
    <div className="relative aspect-[0.92] overflow-hidden rounded-[2.15rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_50%_38%,rgba(37,99,235,0.10),transparent_34%),linear-gradient(180deg,rgba(17,24,39,0.98),rgba(9,9,11,0.96))] p-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)]"
      >
        <defs>
          <filter id="pitcher-zone-heat-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        {BUCKET_ORDER.map((bucketId) => {
          const shape = HEAT_BUCKET_SHAPES[bucketId];
          if (!shape) return null;
          const count = bucketCounts[bucketId] ?? 0;
          const heat = maxCount > 0 ? count / maxCount : 0;
          const empty = count === 0;
          const solid = bucketPalette(heat);
          const opacity = empty ? 0.02 : 0.12 + heat * 0.52;
          const crispOpacity = empty ? 0.02 : 0.08 + heat * 0.12;

          return (
            <g key={bucketId}>
              <ellipse
                cx={shape.cx}
                cy={shape.cy}
                rx={shape.rx}
                ry={shape.ry}
                fill={solid}
                opacity={opacity}
                filter="url(#pitcher-zone-heat-blur)"
              />
              <ellipse
                cx={shape.cx}
                cy={shape.cy}
                rx={shape.rx}
                ry={shape.ry}
                fill={solid}
                opacity={crispOpacity}
              />
            </g>
          );
        })}

        <SimpleZoneOverlay />
      </svg>

      <div className="pointer-events-none absolute inset-3 rounded-[1.9rem] border border-white/5" />

      {totalCount === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-zinc-600">{emptyLabel}</span>
        </div>
      )}
    </div>
  );
}
