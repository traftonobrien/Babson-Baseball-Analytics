"use client";

import type { Pitch } from "../types";
import { pitchColor } from "../utils";
import { ScatterOverlay, PAD, SIZE, toSvg } from "./ZoneOverlay";

interface Props {
  pitches: Pitch[];
  selected: Pitch | null;
  onSelect: (p: Pitch) => void;
}

export default function StrikeZoneScatter({
  pitches,
  selected,
  onSelect,
}: Props) {
  return (
    <div className="bg-zinc-900 rounded-lg p-3">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
        Miss Scatter (inches from target)
      </h3>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-xs mx-auto">
        <ScatterOverlay />

        {/* Pitch dots */}
        {pitches.map((p) => {
          const px = toSvg(-p.h_miss_signed);
          const py = toSvg(p.v_miss_signed);
          const isSel = selected?.pitch_number === p.pitch_number;
          return (
            <circle
              key={p.pitch_number}
              cx={px}
              cy={py}
              r={isSel ? 6 : 4}
              fill={pitchColor(p.pitch_type)}
              fillOpacity={isSel ? 1 : 0.7}
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
