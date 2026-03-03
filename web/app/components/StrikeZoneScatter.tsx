"use client";

import type { Pitch } from "../types";
import { pitchColor } from "../utils";
import { ScatterOverlay, PAD, SIZE, toSvg } from "./ZoneOverlay";
import { isOutlier as isOutlierPitch } from "@/lib/reportModel";
import { pitchPhysicalX } from "@/lib/handedness";

interface Props {
  pitches: Pitch[];
  selected: Pitch | null;
  onSelect: (p: Pitch) => void;
  throwsHand: "R" | "L";
}

export default function StrikeZoneScatter({
  pitches,
  selected,
  onSelect,
  throwsHand,
}: Props) {
  return (
    <div className="overflow-hidden rounded-[1.6rem] border border-zinc-800/80 bg-zinc-950/80 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Miss Scatter
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Inches from the catcher’s target.
          </p>
        </div>
        <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Catcher View
        </span>
      </div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-xs">
        <ScatterOverlay throwsHand={throwsHand} />

        {/* Pitch dots */}
        {pitches.filter((p) => Number.isFinite(p.total_miss_inches)).map((p) => {
          const px = toSvg(pitchPhysicalX(p));
          const py = toSvg(p.v_miss_signed);
          const isSel = selected?.pitch_number === p.pitch_number;
          const isOutlier = isOutlierPitch(p);
          return (
            <circle
              key={p.pitch_number}
              cx={px}
              cy={py}
              r={isSel ? 6 : 4}
              fill={isOutlier && !isSel ? "#71717a" : pitchColor(p.pitch_type)}
              fillOpacity={isOutlier && !isSel ? 0.35 : isSel ? 1 : 0.7}
              stroke={isSel ? "#fff" : "none"}
              strokeWidth={isSel ? 1.5 : 0}
              className="cursor-pointer transition-all"
              onClick={() => onSelect(p)}
            >
              <title>
                #{p.pitch_number} {p.pitch_type} —{" "}
                {p.total_miss_inches.toFixed(1)}&quot;
              </title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
