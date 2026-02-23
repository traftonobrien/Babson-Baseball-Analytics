"use client";

import { useEffect, useState } from "react";
import { scoreColor, confidenceLabel } from "@/lib/mechanics/labels";
import { handBadgeClassesCompact } from "@/lib/handBadge";
import { getAggregateConfidence } from "@/lib/mechanics/selectors";
import type { NotesJson } from "@/lib/mechanics/types";

interface MechanicsHeroProps {
  notes: NotesJson;
  playerName: string;
  sessionLabel: string;
}

const SCORE_GRADIENT =
  "linear-gradient(to right, #ef4444 0%, #ef4444 38%, #f59e0b 38%, #f59e0b 58%, #a3e635 58%, #a3e635 78%, #22c55e 78%, #22c55e 100%)";

export function MechanicsHero({ notes, playerName, sessionLabel }: MechanicsHeroProps) {
  const score = notes.efficiency_score;
  const pct = Math.min(Math.max(score / 10, 0), 1) * 100;
  const color = scoreColor(score);
  const isLowConf = notes.efficiency_low_confidence;
  const aggConf = getAggregateConfidence(notes);

  // Animate bar fill on mount
  const [fillPct, setFillPct] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFillPct(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-5">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-8 flex-wrap">
          {/* LEFT: Identity */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
              Mechanics Analysis
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50 mb-3">
              {playerName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
              <span>{sessionLabel}</span>
              <span className="w-px h-3 bg-zinc-700 hidden sm:block" />
              <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(notes.hand)}`}
            >
              {notes.hand === "R" ? "RHP" : "LHP"}
            </span>
              <span className="w-px h-3 bg-zinc-700 hidden sm:block" />
              <span className="capitalize">{notes.view_mode.replace(/_/g, " ")} view</span>
              <span className="w-px h-3 bg-zinc-700 hidden sm:block" />
              {notes.model_version ? (
                <span className="text-zinc-600 font-mono text-[10px]">{notes.model_version}</span>
              ) : (
                <span className="text-zinc-600 font-mono text-[10px]">{notes.official_metric_set}</span>
              )}
            </div>
          </div>

          {/* RIGHT: Score block */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Efficiency Score</p>
            <div className="flex items-baseline gap-2">
              <span
                className={`font-black font-mono tabular-nums leading-none ${score < 4 ? "animate-pulse" : ""}`}
                style={{ color, fontSize: 72 }}
              >
                {score.toFixed(1)}
              </span>
              <span className="text-xl text-zinc-600 font-mono">/10</span>
            </div>
            {aggConf !== null && (
              <span className="text-[10px]">
                <span className={isLowConf ? "text-amber-500" : "text-zinc-500"}>
                  {(aggConf * 100).toFixed(0)}% avg confidence
                </span>
                <span className="text-zinc-600"> · {confidenceLabel(aggConf)}</span>
              </span>
            )}
            {isLowConf && (
              <span className="text-[9px] uppercase tracking-wider text-amber-500 font-medium">
                Low confidence overall
              </span>
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-5">
          <div
            className="relative h-1 rounded-full overflow-hidden"
            style={{ background: SCORE_GRADIENT }}
          >
            {/* Dim overlay animates from right */}
            <div
              className="absolute inset-y-0 right-0 bg-zinc-900/80"
              style={{
                left: `${fillPct}%`,
                transition: "left 600ms cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>

          {/* Tick marks + marker pin */}
          <div className="relative h-5 mt-0.5">
            {[0, 2, 4, 6, 8, 10].map((t) => (
              <span
                key={t}
                className="absolute text-[8px] font-mono text-zinc-700 -translate-x-1/2"
                style={{ left: `${t * 10}%` }}
              >
                {t}
              </span>
            ))}
            <div
              className="absolute top-0 w-0.5 h-3 rounded-full"
              style={{
                left: `${fillPct}%`,
                backgroundColor: color,
                boxShadow: `0 0 6px 1px ${color}44`,
                transition: "left 600ms cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>

          {/* Confidence band — 1px strip showing aggregate confidence */}
          {aggConf !== null && (
            <div className="mt-1.5 h-px bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${aggConf * 100}%`,
                  backgroundColor:
                    aggConf >= 0.7 ? "#22c55e" : aggConf >= 0.5 ? "#f59e0b" : "#ef4444",
                  transition: "width 600ms cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
