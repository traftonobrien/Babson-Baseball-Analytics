"use client";

import { useState } from "react";

import { emptyBaserunnerState } from "@/lib/charting/live";
import type { ChartingBaserunnerState } from "@/lib/charting/types";

import {
  EDITOR_GHOST_BUTTON_CLASS,
  EDITOR_MUTED_LABEL_CLASS,
  EDITOR_PANEL_CLASS,
} from "./ui";

const BASE_FIELDS = [
  ["runnerOnFirst", "1B"],
  ["runnerOnSecond", "2B"],
  ["runnerOnThird", "3B"],
] as const;

type OutPickMode = "pickoff" | "cs" | null;

interface OnBasePanelProps {
  baserunnerDraft: ChartingBaserunnerState;
  onCommitBaserunnerDraft: (
    nextDraft: Partial<ChartingBaserunnerState> | null | undefined,
    successNote: string,
  ) => void;
  onBaserunnerOut: (field: keyof ChartingBaserunnerState, kind: "pickoff" | "cs") => void;
}

export const OnBasePanel = ({
  baserunnerDraft,
  onCommitBaserunnerDraft,
  onBaserunnerOut,
}: OnBasePanelProps) => {
  const [scoredPickMode, setScoredPickMode] = useState(false);
  const [outPickMode, setOutPickMode] = useState<OutPickMode>(null);

  const hasRunner =
    Boolean(baserunnerDraft.runnerOnFirst) ||
    Boolean(baserunnerDraft.runnerOnSecond) ||
    Boolean(baserunnerDraft.runnerOnThird);

  const occupiedBases = BASE_FIELDS.filter(([field]) => Boolean(baserunnerDraft[field]));

  const handleScoredPick = (field: keyof ChartingBaserunnerState, label: string) => {
    onCommitBaserunnerDraft({ [field]: null }, `Run scored - runner cleared from ${label}`);
    setScoredPickMode(false);
  };

  const handleOutPick = (field: keyof ChartingBaserunnerState) => {
    if (!outPickMode) return;
    onBaserunnerOut(field, outPickMode);
    setOutPickMode(null);
  };

  const cancelAllModes = () => {
    setScoredPickMode(false);
    setOutPickMode(null);
  };

  const anyPickMode = scoredPickMode || outPickMode !== null;

  const pickModeLabel =
    outPickMode === "pickoff"
      ? "Pickoff — which base?"
      : outPickMode === "cs"
        ? "CS — which base?"
        : "Which base scored?";

  const pickBaseClass =
    outPickMode !== null
      ? "h-8 flex-1 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 transition-all hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
      : "h-8 flex-1 rounded-xl border border-amber-200 bg-amber-50 text-xs font-bold text-amber-700 transition-all hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25";

  const pickLabelClass =
    outPickMode !== null
      ? "shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400"
      : "shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400";

  return (
    <div className={`${EDITOR_PANEL_CLASS} flex min-w-0 flex-col p-3`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className={EDITOR_MUTED_LABEL_CLASS}>On Base</div>
        <button
          type="button"
          onClick={() => {
            onCommitBaserunnerDraft(emptyBaserunnerState(), "Base state cleared");
            cancelAllModes();
          }}
          className="text-[10px] font-semibold text-muted transition-colors hover:text-foreground dark:hover:text-zinc-100"
        >
          Clear
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-2">
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
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-[0_18px_40px_rgba(16,185,129,0.12)] dark:border-emerald-300/40 dark:bg-emerald-500/16 dark:text-emerald-100 dark:shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
                    : "border-border bg-background text-foreground shadow-sm hover:border-emerald-200 hover:bg-emerald-50/80 hover:text-emerald-950 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300 dark:hover:border-emerald-400/25 dark:hover:bg-zinc-950 dark:hover:text-zinc-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {anyPickMode ? (
          <div className="flex items-center gap-1.5">
            <span className={pickLabelClass}>{pickModeLabel}</span>
            {occupiedBases.map(([field, label]) => (
              <button
                key={field}
                type="button"
                onClick={() =>
                  scoredPickMode ? handleScoredPick(field, label) : handleOutPick(field)
                }
                className={pickBaseClass}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={cancelAllModes}
              className={`${EDITOR_GHOST_BUTTON_CLASS} h-8 shrink-0 px-2 text-[10px]`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={!hasRunner}
              onClick={() => setScoredPickMode(true)}
              className="h-9 flex-1 rounded-xl border border-amber-200 bg-amber-50 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 transition-all hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-border disabled:bg-background disabled:text-muted dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900/40 dark:disabled:text-zinc-600"
            >
              Scored
            </button>
            <button
              type="button"
              disabled={!hasRunner}
              onClick={() => setOutPickMode("pickoff")}
              className="h-9 flex-1 rounded-xl border border-rose-200 bg-rose-50 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-700 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-border disabled:bg-background disabled:text-muted dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900/40 dark:disabled:text-zinc-600"
            >
              Pickoff
            </button>
            <button
              type="button"
              disabled={!hasRunner}
              onClick={() => setOutPickMode("cs")}
              className="h-9 flex-1 rounded-xl border border-rose-200 bg-rose-50 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-700 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-border disabled:bg-background disabled:text-muted dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900/40 dark:disabled:text-zinc-600"
            >
              CS
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
