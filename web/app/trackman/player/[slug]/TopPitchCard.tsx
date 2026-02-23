"use client";

import { pitchColor } from "@/lib/pitchColors";
import { getStuffPlusDisplayPitchType } from "@/lib/stuffPlusPitchOverrides";

interface StuffPlusPitch {
  pitchType: string;
  meanStuffPlus: number;
}

export default function TopPitchCard({
  arsenal,
  playerId,
}: {
  arsenal: StuffPlusPitch[];
  playerId: string;
}) {
  if (arsenal.length === 0) return null;

  const top = arsenal.reduce((a, b) =>
    b.meanStuffPlus > (a?.meanStuffPlus ?? 0) ? b : a
  );

  const displayType = getStuffPlusDisplayPitchType(playerId, top.pitchType);
  const color = pitchColor(displayType);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div
          className="w-1 h-10 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Best Pitch
          </p>
          <p className="text-lg font-semibold text-zinc-100">
            {displayType}{" "}
            <span className="font-mono text-zinc-300">
              ({top.meanStuffPlus.toFixed(1)} Stuff+)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
