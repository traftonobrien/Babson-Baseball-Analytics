/**
 * Shared SVG strike-zone overlay with result-quadrant labels.
 *
 * Renders inside an existing <svg> — returns a <g> fragment.
 * Catcher POV: 3×3 quadrant grid (UA/UM/UI, MA/MM/MI, DA/DM/DI).
 */

import { config } from "@/lib/config";

const PAD = 40;
const SIZE = 320;
const INNER = SIZE - PAD * 2;

export { PAD, SIZE, INNER };

export function toSvg(inches: number): number {
  const range = config.plotMax - config.plotMin;
  return PAD + ((inches - config.plotMin) / range) * INNER;
}

/**
 * Full 3×3 quadrant grid (catcher POV):
 *
 *   Top row (U):  UA | UM | UI
 *   Mid row (M):  MA | MM | MI
 *   Bot row (D):  DA | DM | DI
 *
 * Columns: Away (left) | Middle (center) | Inside (right)
 * Rows:    Up (top)     | Middle          | Down (bottom)
 */
const QUAD_LABELS: { label: string; col: number; row: number }[] = [
  // row 0 = Up
  { label: "UA", col: 0, row: 0 },
  { label: "UM", col: 1, row: 0 },
  { label: "UI", col: 2, row: 0 },
  // row 1 = Middle
  { label: "MA", col: 0, row: 1 },
  { label: "MM", col: 1, row: 1 },
  { label: "MI", col: 2, row: 1 },
  // row 2 = Down
  { label: "DA", col: 0, row: 2 },
  { label: "DM", col: 1, row: 2 },
  { label: "DI", col: 2, row: 2 },
];

export default function ZoneOverlay() {
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

  return (
    <g>
      {/* Strike zone box */}
      <rect
        x={zx1}
        y={zy1}
        width={zw}
        height={zh}
        fill="none"
        stroke="#52525b"
        strokeWidth={1}
        strokeDasharray="4 2"
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

      {/* Quadrant labels — high contrast with dark outline for heatmap legibility */}
      {QUAD_LABELS.map(({ label, col, row }) => {
        const lx = zx1 + zw * (col + 0.5) / 3;
        const ly = zy1 + zh * (row + 0.5) / 3;
        return (
          <text
            key={label}
            x={lx}
            y={ly}
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
        );
      })}

      {/* Target reference at MM center */}
      {(() => {
        const mmX = zx1 + zw * 0.5;
        const mmY = zy1 + zh * 0.5;
        return (
          <g>
            {/* Crosshair target icon */}
            <circle cx={mmX} cy={mmY} r={8} fill="none" stroke="#a1a1aa" strokeWidth={0.7} opacity={0.5} />
            <circle cx={mmX} cy={mmY} r={3} fill="none" stroke="#a1a1aa" strokeWidth={0.7} opacity={0.5} />
            <circle cx={mmX} cy={mmY} r={1} fill="#a1a1aa" opacity={0.5} />
          </g>
        );
      })()}
    </g>
  );
}
