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
    <div className="bg-zinc-900 rounded-lg p-3">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
        Miss Scatter (inches from target)
      </h3>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-xs mx-auto">
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
