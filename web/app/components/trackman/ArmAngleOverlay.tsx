import {
  computeArmDirectionVector,
  formatDeg,
  clamp
} from "@/lib/release_viz/math";
import { RELEASE_THEME } from "@/lib/release_viz/theme";
import type { ArmAngleRay } from "@/lib/release_viz/types";
import { useMemo } from "react";

interface ArmAngleOverlayProps {
  rays: ArmAngleRay[];
  hand: "R" | "L";
  plotSize: number;
  pad: number;
  maxAbs: number;
  hoveredPitchType?: string | null;
  onHoverPitchType?: (pitchType: string | null) => void;
}

/** Short abbreviation for pill label */
function pitchAbbrev(pitchType: string): string {
  const map: Record<string, string> = {
    Fastball: "FB",
    Sinker: "SI",
    Cutter: "CT",
    Slider: "SL",
    Curveball: "CB",
    Changeup: "CH",
    Splitter: "FS",
    Sweeper: "SW",
    "Knuckle Curve": "KC",
  };
  return map[pitchType] ?? pitchType.slice(0, 2).toUpperCase();
}

export function ArmAngleOverlay({
  rays,
  hand,
  plotSize,
  pad,
  maxAbs,
  hoveredPitchType,
  onHoverPitchType,
}: ArmAngleOverlayProps) {
  const primary = useMemo(() => rays.find((r) => r.isPrimary) ?? rays[0], [rays]);
  const displayRay = useMemo(() => {
    if (hoveredPitchType) {
      return rays.find((r) => r.pitchType === hoveredPitchType) ?? primary;
    }
    return primary;
  }, [rays, hoveredPitchType, primary]);

  if (rays.length === 0 || !primary) return null;

  const scale = (plotSize / 2) / maxAbs;
  const centerX = pad + plotSize / 2;
  const centerY = pad + plotSize / 2;
  const anchorX = centerX;
  const anchorY = centerY;

  const rayLenInches = maxAbs * 0.94;

  // Beam geometry constants (thinner for multi-ray)
  const originWidth = 3.5;
  const tipWidth = 0.8;

  const hasHover = hoveredPitchType != null;

  // Arc from primary ray
  const arcAngleDeg = primary.armAngleDeg;
  const ring6in = 6 * scale;
  const arcR = ring6in;
  const arcEndRad = hand === "R"
    ? -arcAngleDeg * Math.PI / 180
    : Math.PI - (arcAngleDeg * Math.PI / 180);
  const startAngleRad = hand === "R" ? 0 : Math.PI;
  const arcX = centerX + arcR * Math.cos(arcEndRad);
  const arcY = centerY + arcR * Math.sin(arcEndRad);
  const arcStartX = centerX + arcR * Math.cos(startAngleRad);
  const arcStartY = centerY + arcR * Math.sin(startAngleRad);
  const arcPath = `M ${arcStartX},${arcStartY} A ${arcR} ${arcR} 0 0 ${hand === "R" ? 0 : 1} ${arcX},${arcY}`;
  const arcColor = primary.color;

  // Label pill positioning (from display ray)
  const pillVec = computeArmDirectionVector(displayRay.armAngleDeg, rayLenInches, hand);
  const pillX2 = anchorX + (pillVec?.dx ?? 0) * scale;
  const pillY2 = anchorY - (pillVec?.dy ?? 0) * scale;

  const dx0 = pillX2 - anchorX;
  const dy0 = pillY2 - anchorY;
  const len0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
  const nx0 = len0 > 0 ? -dy0 / len0 : 0;
  const ny0 = len0 > 0 ? dx0 / len0 : 0;

  const offsetDist = 12;
  let px = -nx0;
  let py = -ny0;
  if (py > 0) { px = -px; py = -py; }

  const labelRawX = pillX2 + px * offsetDist;
  const labelRawY = pillY2 + py * offsetDist;

  const PAD_X = 30;
  const PAD_Y = 15;
  const boundsR = plotSize / 2;
  const labelX = clamp(labelRawX, centerX - boundsR + PAD_X, centerX + boundsR - PAD_X);
  const labelY = clamp(labelRawY, centerY - boundsR + PAD_Y, centerY + boundsR - PAD_Y);

  // Pill text
  const pillAngle = formatDeg(displayRay.armAngleDeg);
  const pillAbbr = pitchAbbrev(displayRay.pitchType);
  const pillSlot = displayRay.slotClass?.label
    .replace("Over-the-top", "OTT")
    .replace("Over the Top", "OTT")
    .replace("High 3/4", "Hi 3/4") ?? "";
  // Show abbreviation when hovered or when there are multiple rays; otherwise show slot label
  const pillSubtext = (hasHover || rays.length > 1) ? pillAbbr : pillSlot;
  const pillColor = displayRay.color;

  // Pill width sizing
  const pillText = `${pillAngle} ${pillSubtext}`;
  const estimatedWidth = Math.max(56, pillText.length * 5.5 + 16);
  const pillW = estimatedWidth;
  const pillH = 26;

  return (
    <g className="arm-angle-overlay">
      <defs>
        <filter id={RELEASE_THEME.filters.beamGlow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="pillShadow-multi" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="5" floodOpacity="0.45" />
        </filter>
        {rays.map((ray) => {
          const vec = computeArmDirectionVector(ray.armAngleDeg, rayLenInches, hand);
          if (!vec) return null;
          const bx2 = anchorX + vec.dx * scale;
          const by2 = anchorY - vec.dy * scale;
          return (
            <linearGradient
              key={`grad-${ray.pitchType}`}
              id={`beamGradient-${ray.pitchType.replace(/\s+/g, "-")}`}
              gradientUnits="userSpaceOnUse"
              x1={anchorX}
              y1={anchorY}
              x2={bx2}
              y2={by2}
            >
              <stop offset="0%" stopColor={ray.color} stopOpacity="0.9" />
              <stop offset="45%" stopColor={ray.color} stopOpacity="0.65" />
              <stop offset="70%" stopColor={ray.color} stopOpacity="0.25" />
              <stop offset="82%" stopColor={ray.color} stopOpacity="0.08" />
              <stop offset="92%" stopColor={ray.color} stopOpacity="0" />
              <stop offset="100%" stopColor={ray.color} stopOpacity="0" />
            </linearGradient>
          );
        })}
        <style>
          {`
            @keyframes beamFadeMulti {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes pillFadeMulti {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .beam-group-multi {
              animation: beamFadeMulti 250ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }
            .pill-group-multi {
              animation: pillFadeMulti 200ms cubic-bezier(0.4, 0, 0.2, 1) 100ms forwards;
              opacity: 0;
            }
          `}
        </style>
      </defs>

      {/* Arc (primary ray only) */}
      <path
        d={arcPath}
        fill="none"
        stroke={arcColor}
        strokeWidth="1.5"
        strokeOpacity="0.40"
        strokeLinecap="round"
        strokeDasharray="3 6"
        pointerEvents="none"
      />

      {/* Beams (render in reverse so primary draws on top) */}
      <g className="beam-group-multi">
        {[...rays].reverse().map((ray) => {
          const vec = computeArmDirectionVector(ray.armAngleDeg, rayLenInches, hand);
          if (!vec) return null;

          const bx2 = anchorX + vec.dx * scale;
          const by2 = anchorY - vec.dy * scale;

          const bdx = bx2 - anchorX;
          const bdy = by2 - anchorY;
          const blen = Math.sqrt(bdx * bdx + bdy * bdy);
          const bnx = -bdy / blen;
          const bny = bdx / blen;

          const p1x = anchorX + bnx * originWidth;
          const p1y = anchorY + bny * originWidth;
          const p2x = bx2 + bnx * tipWidth;
          const p2y = by2 + bny * tipWidth;
          const p3x = bx2 - bnx * tipWidth;
          const p3y = by2 - bny * tipWidth;
          const p4x = anchorX - bnx * originWidth;
          const p4y = anchorY - bny * originWidth;
          const backBx = anchorX - (bdx / blen) * originWidth * 0.8;
          const backBy = anchorY - (bdy / blen) * originWidth * 0.8;

          const beamPath = `
            M ${p1x},${p1y}
            L ${p2x},${p2y}
            L ${p3x},${p3y}
            L ${p4x},${p4y}
            Q ${backBx},${backBy} ${p1x},${p1y}
            Z
          `;

          const isHovered = hoveredPitchType === ray.pitchType;
          const beamAlpha = hasHover
            ? isHovered ? 0.9 : 0.25
            : 0.55;
          const glowAlpha = hasHover
            ? isHovered ? 0.18 : 0.04
            : 0.12;

          const gradId = `beamGradient-${ray.pitchType.replace(/\s+/g, "-")}`;

          return (
            <g
              key={ray.pitchType}
              opacity={beamAlpha}
              style={{ transition: "opacity 150ms ease", cursor: "pointer" }}
              onMouseEnter={() => onHoverPitchType?.(ray.pitchType)}
              onMouseLeave={() => onHoverPitchType?.(null)}
            >
              {/* Invisible wider hit area for easier hovering */}
              <line
                x1={anchorX}
                y1={anchorY}
                x2={bx2}
                y2={by2}
                stroke="transparent"
                strokeWidth="14"
                pointerEvents="stroke"
              />
              {/* Glow */}
              <path
                d={beamPath}
                fill={ray.color}
                opacity={glowAlpha / beamAlpha}
                filter={`url(#${RELEASE_THEME.filters.beamGlow})`}
                pointerEvents="none"
              />
              {/* Core */}
              <path d={beamPath} fill={`url(#${gradId})`} pointerEvents="none" />
              {/* White center line */}
              <line
                x1={anchorX}
                y1={anchorY}
                x2={anchorX + (bx2 - anchorX) * 0.95}
                y2={anchorY + (by2 - anchorY) * 0.95}
                stroke="white"
                strokeWidth="0.75"
                opacity={0.25}
                strokeLinecap="round"
                pointerEvents="none"
              />
            </g>
          );
        })}

        {/* Anchor dot (shared) */}
        <circle cx={anchorX} cy={anchorY} r={4} fill={primary.color} opacity={0.6} pointerEvents="none" />
      </g>

      {/* Label pill */}
      {displayRay.slotClass && (
        <g className="pill-group-multi" transform={`translate(${labelX}, ${labelY + 4})`} pointerEvents="none">
          <rect
            x={-pillW / 2}
            y={-pillH / 2}
            width={pillW}
            height={pillH}
            rx={13}
            fill="rgba(0,0,0,0.88)"
            stroke={pillColor}
            strokeWidth={1.5}
            filter="url(#pillShadow-multi)"
          />
          <text
            x={0}
            y={-3}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[11px] font-bold font-mono tracking-tight"
            fill={RELEASE_THEME.colors.zinc.text}
          >
            {pillAngle}
          </text>
          <text
            x={0}
            y={7}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[6px] uppercase tracking-wide font-sans font-bold"
            fill={pillColor}
            style={{ opacity: 0.85, letterSpacing: "0.08em" }}
          >
            {pillSubtext}
          </text>
        </g>
      )}
    </g>
  );
}
