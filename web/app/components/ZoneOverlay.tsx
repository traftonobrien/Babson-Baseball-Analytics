/**
 * SVG strike-zone overlays for the two chart modes.
 *
 * ScatterOverlay     — axis labels (High/Low/Glove/Arm), no quadrant grid.
 * CatcherZoneOverlay — 3×3 quadrant grid (UA…DI), target reticle, no axis labels.
 *
 * Both share layout constants and the toSvg() helper.
 */

import { config } from "@/lib/config";
import { laneDisplayName } from "@/lib/handedness";

const PAD = 40;
const SIZE = 320;
const INNER = SIZE - PAD * 2;

export { PAD, SIZE, INNER };

export function toSvg(inches: number): number {
  const range = config.plotMax - config.plotMin;
  return PAD + ((inches - config.plotMin) / range) * INNER;
}

/* ------------------------------------------------------------------ */
/*  ScatterOverlay — for StrikeZoneScatter                             */
/* ------------------------------------------------------------------ */

export function ScatterOverlay({ throwsHand = "R" }: { throwsHand?: "R" | "L" } = {}) {
  const zx1 = toSvg(-config.zoneWidth);
  const zx2 = toSvg(config.zoneWidth);
  const zy1 = toSvg(-config.zoneHeight);
  const zy2 = toSvg(config.zoneHeight);
  const cx = toSvg(0);
  const cy = toSvg(0);

  // Positive arm-side-X plots right. For RHP arm-side is 1B (right);
  // for LHP arm-side is 3B (left) — so labels swap.
  const rightLabel = laneDisplayName("Arm", throwsHand);
  const leftLabel = laneDisplayName("Glove", throwsHand);

  return (
    <g>
      {/* Strike zone box */}
      <rect
        x={zx1} y={zy1}
        width={zx2 - zx1} height={zy2 - zy1}
        fill="none" stroke="#3f3f46" strokeWidth={1} strokeDasharray="4 2"
      />

      {/* Crosshair */}
      <line x1={PAD} x2={SIZE - PAD} y1={cy} y2={cy} stroke="#27272a" strokeWidth={0.5} />
      <line x1={cx} x2={cx} y1={PAD} y2={SIZE - PAD} stroke="#27272a" strokeWidth={0.5} />

      {/* Axis labels */}
      <text x={SIZE - PAD + 4} y={cy + 3} fill="#71717a" fontSize={8}>{rightLabel}</text>
      <text x={PAD - 4} y={cy + 3} fill="#71717a" fontSize={8} textAnchor="end">{leftLabel}</text>
      <text x={cx} y={PAD - 6} fill="#71717a" fontSize={8} textAnchor="middle">High</text>
      <text x={cx} y={SIZE - PAD + 12} fill="#71717a" fontSize={8} textAnchor="middle">Low</text>

      {/* Origin dot */}
      <circle cx={cx} cy={cy} r={3} fill="#3f3f46" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  CatcherZoneOverlay — for MissHeatmap                               */
/* ------------------------------------------------------------------ */

const QUAD_LABELS: { label: string; col: number; row: number }[] = [
  { label: "UA", col: 0, row: 0 },
  { label: "UM", col: 1, row: 0 },
  { label: "UI", col: 2, row: 0 },
  { label: "MA", col: 0, row: 1 },
  { label: "MM", col: 1, row: 1 },
  { label: "MI", col: 2, row: 1 },
  { label: "DA", col: 0, row: 2 },
  { label: "DM", col: 1, row: 2 },
  { label: "DI", col: 2, row: 2 },
];

export function CatcherZoneOverlay() {
  const zx1 = toSvg(-config.zoneWidth);
  const zx2 = toSvg(config.zoneWidth);
  const zy1 = toSvg(-config.zoneHeight);
  const zy2 = toSvg(config.zoneHeight);
  const zw = zx2 - zx1;
  const zh = zy2 - zy1;
  const cx = toSvg(0);
  const cy = toSvg(0);

  const col1 = zx1 + zw / 3;
  const col2 = zx1 + (2 * zw) / 3;
  const row1 = zy1 + zh / 3;
  const row2 = zy1 + (2 * zh) / 3;

  const mmX = zx1 + zw * 0.5;
  const mmY = zy1 + zh * 0.5;

  return (
    <g>
      {/* Strike zone box */}
      <rect
        x={zx1} y={zy1}
        width={zw} height={zh}
        fill="none" stroke="#52525b" strokeWidth={1} strokeDasharray="4 2"
      />

      {/* Internal grid lines */}
      <line x1={col1} x2={col1} y1={zy1} y2={zy2} stroke="#3f3f46" strokeWidth={0.5} strokeDasharray="2 3" />
      <line x1={col2} x2={col2} y1={zy1} y2={zy2} stroke="#3f3f46" strokeWidth={0.5} strokeDasharray="2 3" />
      <line x1={zx1} x2={zx2} y1={row1} y2={row1} stroke="#3f3f46" strokeWidth={0.5} strokeDasharray="2 3" />
      <line x1={zx1} x2={zx2} y1={row2} y2={row2} stroke="#3f3f46" strokeWidth={0.5} strokeDasharray="2 3" />

      {/* Crosshair */}
      <line x1={PAD} x2={SIZE - PAD} y1={cy} y2={cy} stroke="#27272a" strokeWidth={0.5} />
      <line x1={cx} x2={cx} y1={PAD} y2={SIZE - PAD} stroke="#27272a" strokeWidth={0.5} />

      {/* Origin dot */}
      <circle cx={cx} cy={cy} r={2.5} fill="#3f3f46" />

      {/* Quadrant labels */}
      {QUAD_LABELS.map(({ label, col, row }) => (
        <text
          key={label}
          x={zx1 + zw * (col + 0.5) / 3}
          y={zy1 + zh * (row + 0.5) / 3}
          fill="#d4d4d8"
          stroke="#0a0a0a"
          strokeWidth={3}
          paintOrder="stroke"
          fontSize={13}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      ))}

      {/* Target reticle at MM center */}
      <circle cx={mmX} cy={mmY} r={8} fill="none" stroke="#a1a1aa" strokeWidth={0.7} opacity={0.5} />
      <circle cx={mmX} cy={mmY} r={3} fill="none" stroke="#a1a1aa" strokeWidth={0.7} opacity={0.5} />
      <circle cx={mmX} cy={mmY} r={1} fill="#a1a1aa" opacity={0.5} />
    </g>
  );
}

/** @deprecated Use ScatterOverlay or CatcherZoneOverlay instead. */
export default CatcherZoneOverlay;
