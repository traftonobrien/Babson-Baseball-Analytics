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

  const [fillPct, setFillPct] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFillPct(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className="px-4 py-3 sm:px-6">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[1.9rem] border border-violet-500/20 bg-[radial-gradient(circle_at_14%_18%,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_84%_22%,rgba(56,189,248,0.08),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))] shadow-[0_24px_64px_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
        <div className="relative px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Mechanics Analysis
              </p>
              <h1 className="mb-3 text-2xl font-bold tracking-tight text-zinc-50">
                {playerName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
                <span>{sessionLabel}</span>
                <span className="hidden h-3 w-px bg-zinc-700 sm:block" />
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(notes.hand)}`}
                >
                  {notes.hand === "R" ? "RHP" : "LHP"}
                </span>
                <span className="hidden h-3 w-px bg-zinc-700 sm:block" />
                <span className="capitalize">{notes.view_mode.replace(/_/g, " ")} view</span>
                <span className="hidden h-3 w-px bg-zinc-700 sm:block" />
                {notes.model_version ? (
                  <span className="font-mono text-[10px] text-zinc-600">{notes.model_version}</span>
                ) : (
                  <span className="font-mono text-[10px] text-zinc-600">{notes.official_metric_set}</span>
                )}
              </div>
            </div>

            <div className="shrink-0 rounded-3xl border border-zinc-800/80 bg-zinc-950/72 px-5 py-4 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Efficiency Score
              </p>
              <div className="mt-2 flex items-baseline justify-end gap-2">
                <span
                  className={`font-black font-mono tabular-nums leading-none ${score < 4 ? "animate-pulse" : ""}`}
                  style={{ color, fontSize: 64 }}
                >
                  {score.toFixed(1)}
                </span>
                <span className="font-mono text-xl text-zinc-600">/10</span>
              </div>
              {aggConf !== null ? (
                <div className="mt-2 text-[10px]">
                  <span className={isLowConf ? "text-amber-500" : "text-zinc-500"}>
                    {(aggConf * 100).toFixed(0)}% avg confidence
                  </span>
                  <span className="text-zinc-600"> · {confidenceLabel(aggConf)}</span>
                </div>
              ) : null}
              {isLowConf ? (
                <div className="mt-1 text-[9px] font-medium uppercase tracking-wider text-amber-500">
                  Low confidence overall
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <div
              className="relative h-1 overflow-hidden rounded-full"
              style={{ background: SCORE_GRADIENT }}
            >
              <div
                className="absolute inset-y-0 right-0 bg-zinc-900/80"
                style={{
                  left: `${fillPct}%`,
                  transition: "left 600ms cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>

            <div className="relative mt-0.5 h-5">
              {[0, 2, 4, 6, 8, 10].map((t) => (
                <span
                  key={t}
                  className="absolute -translate-x-1/2 font-mono text-[8px] text-zinc-700"
                  style={{ left: `${t * 10}%` }}
                >
                  {t}
                </span>
              ))}
              <div
                className="absolute top-0 h-3 w-0.5 rounded-full"
                style={{
                  left: `${fillPct}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 6px 1px ${color}44`,
                  transition: "left 600ms cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>

            {aggConf !== null ? (
              <div className="mt-1.5 h-px overflow-hidden rounded-full bg-zinc-800">
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
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
