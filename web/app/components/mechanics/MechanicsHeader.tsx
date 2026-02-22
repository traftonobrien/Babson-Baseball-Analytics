"use client";

import { scoreColor } from "@/lib/mechanics/labels";
import type { NotesJson } from "@/lib/mechanics/types";

interface MechanicsHeaderProps {
  notes: NotesJson;
  playerName: string;
  sessionLabel: string;
}

const SCORE_GRADIENT = "linear-gradient(to right, #ef4444 0%, #ef4444 38%, #f59e0b 38%, #f59e0b 58%, #a3e635 58%, #a3e635 78%, #22c55e 78%, #22c55e 100%)";

export function MechanicsHeader({ notes, playerName, sessionLabel }: MechanicsHeaderProps) {
  const score = notes.efficiency_score;
  const pct = Math.min(Math.max(score / 10, 0), 1) * 100;
  const color = scoreColor(score);
  const isLowConf = notes.efficiency_low_confidence;

  return (
    <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-5">
      <div className="max-w-5xl mx-auto">
        {/* Top row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Mechanics Analysis</p>
            <h1 className="text-xl font-bold tracking-tight text-zinc-50">{playerName}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
              <span>{sessionLabel}</span>
              <span className="w-px h-3 bg-zinc-700" />
              <span>{notes.hand === "R" ? "RHP" : "LHP"}</span>
              <span className="w-px h-3 bg-zinc-700" />
              <span className="capitalize">{notes.view_mode.replace(/_/g, " ")} view</span>
              <span className="w-px h-3 bg-zinc-700" />
              <span className="text-zinc-600">{notes.official_metric_set}</span>
            </div>
          </div>

          {/* Efficiency score badge */}
          <div className="flex flex-col items-end gap-1">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Efficiency Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black font-mono tabular-nums" style={{ color }}>
                {score.toFixed(2)}
              </span>
              <span className="text-lg text-zinc-600 font-mono">/10</span>
            </div>
            {isLowConf && (
              <span className="text-[9px] uppercase tracking-wider text-amber-500 font-medium">
                Low confidence
              </span>
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-5">
          <div className="relative h-2 rounded-full overflow-hidden" style={{ background: SCORE_GRADIENT }}>
            {/* Dark overlay from score to right */}
            <div
              className="absolute top-0 right-0 bottom-0 bg-zinc-900/75"
              style={{ left: `${pct}%` }}
            />
          </div>
          {/* Tick marks */}
          <div className="relative h-4 mt-0.5">
            {[0, 2, 4, 6, 8, 10].map((t) => (
              <span
                key={t}
                className="absolute text-[8px] font-mono text-zinc-600 -translate-x-1/2"
                style={{ left: `${t * 10}%` }}
              >
                {t}
              </span>
            ))}
            {/* Score marker */}
            <div
              className="absolute w-0.5 h-3 top-0 rounded"
              style={{ left: `${pct}%`, backgroundColor: color }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
