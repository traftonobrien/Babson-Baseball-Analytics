"use client";

/* ------------------------------------------------------------------ */
/*  Gradient-sampled badge color — matches the track at badge position */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: RGB): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Luminance-based contrast: dark text on light badges, white on dark. */
function textColor(rgb: RGB): string {
  const [r, g, b] = rgb;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#18181b" : "#ffffff";
}

/** Lighten an RGB color for the glow effect. */
function lighten([r, g, b]: RGB, amount = 0.3): RGB {
  return [
    Math.min(255, Math.round(r + (255 - r) * amount)),
    Math.min(255, Math.round(g + (255 - g) * amount)),
    Math.min(255, Math.round(b + (255 - b) * amount)),
  ];
}

// Track gradient stops — must stay in sync with TRACK constant below.
const STOPS: { pct: number; rgb: RGB }[] = [
  { pct: 0,   rgb: hexToRgb("#1e40af") },
  { pct: 18,  rgb: hexToRgb("#3b82f6") },
  { pct: 50,  rgb: hexToRgb("#94a3b8") },
  { pct: 82,  rgb: hexToRgb("#f87171") },
  { pct: 100, rgb: hexToRgb("#dc2626") },
];

function sampleTrack(p: number): { bg: string; glow: string; text: string } {
  // Find the two stops that bracket p
  let lo = STOPS[0];
  let hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (p >= STOPS[i].pct && p <= STOPS[i + 1].pct) {
      lo = STOPS[i];
      hi = STOPS[i + 1];
      break;
    }
  }
  const t = hi.pct === lo.pct ? 0 : (p - lo.pct) / (hi.pct - lo.pct);
  const rgb = lerpRgb(lo.rgb, hi.rgb, t);
  return {
    bg: rgbToHex(rgb),
    glow: rgbToHex(lighten(rgb)),
    text: textColor(rgb),
  };
}

const TRACK =
  "linear-gradient(to right, #1e40af 0%, #3b82f6 18%, #94a3b8 50%, #f87171 82%, #dc2626 100%)";

interface Props {
  label: string;
  value: string;
  percentile: number | null;
  index: number;
}

export default function SavantPercentileBar({
  label,
  value,
  percentile,
  index,
}: Props) {
  const p =
    percentile != null && Number.isFinite(percentile)
      ? Math.min(100, Math.max(0, percentile))
      : null;

  const style = p != null ? sampleTrack(p) : null;
  const n = p != null ? Math.round(p) : null;
  const delay = index * 60;

  return (
    <div
      className="group flex items-center gap-4 py-5 opacity-0"
      style={{
        animation: `savantFadeIn 0.5s ease-out ${delay}ms forwards`,
      }}
    >
      {/* Metric */}
      <div className="w-[56px] shrink-0 text-right text-[11px] font-black uppercase tracking-[0.08em] text-zinc-500">
        {label}
      </div>

      {/* Track */}
      <div className="relative flex-1" style={{ height: 12 }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: TRACK,
            opacity: 0.18,
          }}
        />
        {/* Filled portion */}
        {n != null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${p}%`,
              background: TRACK,
              opacity: 0.45,
              animation: `savantGrow 0.7s ease-out ${delay}ms both`,
              transformOrigin: "left",
            }}
          />
        )}

        {/* Badge */}
        {n != null && style ? (
          <div
            className="absolute top-1/2 z-10 flex items-center justify-center rounded-full ring-2 ring-black/40"
            style={{
              left: `${p}%`,
              transform: "translate(-50%, -50%)",
              width: 38,
              height: 38,
              backgroundColor: style.bg,
              boxShadow: `0 0 12px ${style.glow}90, 0 0 0 3px #09090b, 0 4px 12px rgba(0,0,0,0.5)`,
            }}
          >
            <span
              className="text-[14px] font-black leading-none"
              style={{ color: style.text }}
            >
              {n}
            </span>
          </div>
        ) : (
          <div
            className="absolute right-0 top-1/2 z-10 flex items-center justify-center rounded-full bg-zinc-900"
            style={{
              transform: "translateY(-50%)",
              width: 38,
              height: 38,
              boxShadow: "0 0 0 3px #09090b",
            }}
          >
            <span className="text-[13px] font-black text-zinc-700">--</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="w-[60px] shrink-0 text-right font-mono text-[13px] font-black tabular-nums leading-none text-white">
        {value}
      </div>
    </div>
  );
}

