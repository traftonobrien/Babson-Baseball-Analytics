"use client";

import { useState } from "react";

import { emptyBaserunnerState } from "@/lib/charting/live";
import type { ChartingBaserunnerState } from "@/lib/charting/types";

const BASE_FIELDS = [
  ["runnerOnFirst", "1B"],
  ["runnerOnSecond", "2B"],
  ["runnerOnThird", "3B"],
] as const;

interface OnBasePanelProps {
  baserunnerDraft: ChartingBaserunnerState;
  onCommitBaserunnerDraft: (
    nextDraft: Partial<ChartingBaserunnerState> | null | undefined,
    successNote: string,
  ) => void;
}

export const OnBasePanel = ({ baserunnerDraft, onCommitBaserunnerDraft }: OnBasePanelProps) => {
  const [scoredPickMode, setScoredPickMode] = useState(false);

  const hasRunner =
    Boolean(baserunnerDraft.runnerOnFirst) ||
    Boolean(baserunnerDraft.runnerOnSecond) ||
    Boolean(baserunnerDraft.runnerOnThird);

  const occupiedBases = BASE_FIELDS.filter(([field]) => Boolean(baserunnerDraft[field]));

  const handleScoredPick = (field: keyof ChartingBaserunnerState, label: string) => {
    onCommitBaserunnerDraft({ [field]: null }, `Run scored — runner cleared from ${label}`);
    setScoredPickMode(false);
  };

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          On Base
        </div>
        <button
          type="button"
          onClick={() => {
            onCommitBaserunnerDraft(emptyBaserunnerState(), "Base state cleared");
            setScoredPickMode(false);
          }}
          className="text-[10px] font-semibold text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Clear
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {/* Base toggle buttons — each is independent, multiple can be active */}
        <div className="grid grid-cols-3 gap-1.5">
          {BASE_FIELDS.map(([field, label]) => {
            const occupied = Boolean(baserunnerDraft[field]);
            return (
              <button
                key={field}
                type="button"
                onClick={() =>
                  onCommitBaserunnerDraft(
                    { [field]: occupied ? null : "runner" },
                    occupied ? `Runner cleared from ${label}` : `Runner on ${label}`,
                  )
                }
                className={`rounded-xl border px-2 py-2 text-sm font-bold transition-all ${
                  occupied
                    ? "border-emerald-300/40 bg-emerald-500/16 text-emerald-100 shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
                    : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-emerald-400/25 hover:text-zinc-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Runner Scored button / pick mode */}
        {scoredPickMode ? (
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-400">
              Which base?
            </span>
            {occupiedBases.map(([field, label]) => (
              <button
                key={field}
                type="button"
                onClick={() => handleScoredPick(field, label)}
                className="h-8 flex-1 rounded-xl border border-amber-500/40 bg-amber-500/15 text-xs font-bold text-amber-300 transition-all hover:bg-amber-500/25"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setScoredPickMode(false)}
              className="h-8 shrink-0 rounded-xl border border-zinc-700 bg-zinc-800/60 px-2 text-[10px] font-semibold text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!hasRunner}
            onClick={() => setScoredPickMode(true)}
            className="h-8 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 text-[10px] font-bold text-amber-400 transition-all hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/40 disabled:text-zinc-600"
          >
            Runner Scored on Last Play
          </button>
        )}
      </div>
    </div>
  );
};
