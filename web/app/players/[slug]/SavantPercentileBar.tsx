"use client";

function badgeColor(p: number): string {
  if (p >= 90) return "#dc2626";
  if (p >= 80) return "#ef4444";
  if (p >= 70) return "#fb923c";
  if (p >= 60) return "#a1a1aa";
  if (p >= 40) return "#a1a1aa";
  if (p >= 30) return "#60a5fa";
  if (p >= 20) return "#3b82f6";
  if (p >= 10) return "#2563eb";
  return "#1d4ed8";
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

  const bg = p != null ? badgeColor(p) : "#3f3f46";
  const n = p != null ? Math.round(p) : null;
  const delay = index * 60;

  return (
    <div
      className="group flex items-center gap-4 py-[10px] opacity-0"
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
        {n != null ? (
          <div
            className="absolute top-1/2 z-10 flex items-center justify-center rounded-full"
            style={{
              left: `${p}%`,
              transform: "translate(-50%, -50%)",
              width: 38,
              height: 38,
              backgroundColor: bg,
              boxShadow: `0 0 0 3px #09090b, 0 0 16px ${bg}40, 0 4px 12px rgba(0,0,0,0.5)`,
            }}
          >
            <span className="text-[14px] font-black leading-none text-white">
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
      <div className="w-[60px] shrink-0 text-right">
        <div className="font-mono text-[15px] font-black tabular-nums leading-none text-white">
          {value}
        </div>
        {n != null && (
          <div className="mt-1 text-[9px] tabular-nums text-zinc-600">
            {n}{ordinal(n)} pctl
          </div>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const mod = n % 100;
  if (mod >= 11 && mod <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}
