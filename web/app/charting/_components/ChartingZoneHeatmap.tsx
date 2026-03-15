import type { CSSProperties } from "react";
import {
  CHARTING_LOCATION_CELLS,
  clipPathForLocationCell,
  cornerLabelClass,
} from "@/lib/charting/locationGrid";

interface ChartingZoneHeatmapProps {
  counts: Partial<Record<number, number>>;
  emptyLabel?: string;
}

const CHARTING_LOCATION_CELL_IDS = new Set(
  CHARTING_LOCATION_CELLS.map((cell) => cell.id)
);

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function heatColor(intensity: number): string {
  // 4 stops: blue → cyan → yellow → red
  const stops = [
    [30, 58, 138],    // 0.0 - blue
    [6, 182, 212],    // 0.33 - cyan
    [251, 191, 36],   // 0.66 - yellow
    [239, 68, 68],    // 1.0 - red
  ] as const;
  const scaled = intensity * (stops.length - 1);
  const i = Math.min(Math.floor(scaled), stops.length - 2);
  const t = scaled - i;
  const [r1, g1, b1] = stops[i]!;
  const [r2, g2, b2] = stops[i + 1]!;
  return `${Math.round(lerp(r1, r2, t))},${Math.round(lerp(g1, g2, t))},${Math.round(lerp(b1, b2, t))}`;
}

function cellStyle(
  count: number,
  maxCount: number,
  tone: "core" | "outer"
): CSSProperties {
  if (maxCount === 0 || count === 0) {
    return tone === "core"
      ? {
          borderColor: "rgba(113, 113, 122, 0.22)",
          background:
            "linear-gradient(180deg, rgba(24,24,27,0.82), rgba(9,9,11,0.94))",
        }
      : {
          borderColor: "rgba(82, 82, 91, 0.22)",
          background:
            "linear-gradient(180deg, rgba(18,18,22,0.72), rgba(9,9,11,0.88))",
        };
  }

  const intensity = count / maxCount;
  const alpha = 0.15 + intensity * 0.65;
  const glowAlpha = 0.4 + intensity * 0.5;
  const rgb = heatColor(intensity);

  return {
    borderColor: `rgba(${rgb}, ${0.18 + intensity * 0.36})`,
    backgroundColor: `rgba(${rgb}, ${alpha})`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 ${8 + intensity * 20}px rgba(${rgb}, ${glowAlpha})`,
  };
}

export function ChartingZoneHeatmap({
  counts,
  emptyLabel = "No located pitches",
}: ChartingZoneHeatmapProps) {
  const numericCounts = Object.values(counts).filter(
    (count): count is number => typeof count === "number"
  );
  const visibleCounts = CHARTING_LOCATION_CELLS.map((cell) => counts[cell.id] ?? 0);
  const maxCount = Math.max(0, ...visibleCounts);
  const totalCount = numericCounts.reduce((sum, count) => sum + count, 0);
  const visibleTotal = visibleCounts.reduce((sum, count) => sum + count, 0);
  const hiddenCount = Object.entries(counts).reduce((sum, [cellId, count]) => {
    if (!count || CHARTING_LOCATION_CELL_IDS.has(Number(cellId))) {
      return sum;
    }

    return sum + count;
  }, 0);

  return (
    <div className="rounded-[1.6rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(20,20,24,0.82),rgba(9,9,11,0.96))] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Zone Coverage
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Catcher view frequency in the live charting grid
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-zinc-800 bg-zinc-950/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            {hiddenCount > 0 ? `${visibleTotal} shown` : `${totalCount} located`}
          </span>
          {hiddenCount > 0 ? (
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
              {hiddenCount} legacy
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative aspect-square rounded-[2.1rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_50%),linear-gradient(180deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.95))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="grid h-full grid-cols-5 grid-rows-5 gap-2">
          {CHARTING_LOCATION_CELLS.map((cell) => {
            const count = counts[cell.id] ?? 0;
            const tone = cell.kind === "square" ? "core" : "outer";
            const isSquare = cell.kind === "square";

            return (
              <div
                key={cell.id}
                className={`${cell.className} relative overflow-hidden border`}
                style={{
                  ...cellStyle(count, maxCount, tone),
                  clipPath: clipPathForLocationCell(cell.kind),
                  borderRadius: isSquare ? "1.1rem" : "1.5rem",
                }}
              >
                <span
                  className={`absolute text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 ${isSquare ? "inset-0 flex items-center justify-center text-base tracking-normal" : cornerLabelClass(cell.kind)}`}
                >
                  {cell.label}
                </span>
                <span
                  className={`absolute font-mono font-semibold text-zinc-100 ${isSquare ? "bottom-1.5 right-2 text-[11px]" : "bottom-3 right-3 text-sm"}`}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-4 rounded-[1.8rem] border border-white/5" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
        <span>Matches the charting editor zone layout.</span>
        <span>
          {hiddenCount > 0
            ? `${hiddenCount} legacy-cell pitches are omitted from this grid.`
            : totalCount === 0
              ? emptyLabel
              : "Corner cells track chase-space misses around the zone."}
        </span>
      </div>
    </div>
  );
}
