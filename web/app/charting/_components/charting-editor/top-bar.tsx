import type { ChangeEvent } from "react";

import { emptyBaserunnerState } from "@/lib/charting/live";
import type {
  ChartingBaserunnerState,
  ChartingBootstrapPitcher,
  ChartingGameSnapshot,
  ChartingMatchupSide,
} from "@/lib/charting/types";

import { COUNT_PRESET_OPTIONS, INNING_OPTIONS, OUT_OPTIONS } from "./constants";
import type { LiveABCountPreset } from "./types";
import { countPresetButtonClass } from "./ui";

interface ChartingEditorTopBarProps {
  sessionType: ChartingGameSnapshot["game"]["sessionType"];
  activeBattingSide: ChartingMatchupSide;
  activePitchingSide: ChartingMatchupSide;
  ourTeamLabel: string;
  opponentTeamLabel: string | null;
  pitcherDatalistId: string;
  datalistId: string;
  pitcherNameInput: string;
  selectedPitcherId: string;
  currentPitcherLocked: boolean;
  pitchers: ChartingBootstrapPitcher[];
  hitterName: string;
  hitterSuggestions: string[];
  overrideInning: number;
  overrideIsTopInning: boolean;
  overrideOuts: number;
  topBattingTeam: string;
  botBattingTeam: string;
  baserunnerDraft: ChartingBaserunnerState;
  needsPAClosure: boolean;
  activePitcherPitchCount: number;
  inningPitches: number;
  liveCountLabel: string;
  canEditCountPreset: boolean;
  activeCountPreset: LiveABCountPreset;
  effectiveBuntMode: boolean;
  hasGameStateOverride: boolean;
  babsonVenueSide: "home" | "away";
  onPitcherInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onHitterChange: (value: string) => void;
  onHitterBlur: () => void;
  onVenueSideChange: (side: "home" | "away") => void;
  onResetOverride: () => void;
  onOverrideChange: (
    field: "inning" | "isTopInning" | "outs",
    value: number | boolean,
  ) => void;
  onBaserunnerDraftChange: (
    field: keyof ChartingBaserunnerState,
    value: string,
  ) => void;
  onBaserunnerDraftBlur: () => void;
  onCommitBaserunnerDraft: (
    nextDraft: Partial<ChartingBaserunnerState> | null | undefined,
    successNote: string,
  ) => void;
  onCountPresetChange: (preset: LiveABCountPreset) => void;
}

export const ChartingEditorTopBar = ({
  sessionType,
  activeBattingSide,
  activePitchingSide,
  ourTeamLabel,
  opponentTeamLabel,
  pitcherDatalistId,
  datalistId,
  pitcherNameInput,
  selectedPitcherId,
  currentPitcherLocked,
  pitchers,
  hitterName,
  hitterSuggestions,
  overrideInning,
  overrideIsTopInning,
  overrideOuts,
  topBattingTeam,
  botBattingTeam,
  baserunnerDraft,
  needsPAClosure,
  activePitcherPitchCount,
  inningPitches,
  liveCountLabel,
  canEditCountPreset,
  activeCountPreset,
  effectiveBuntMode,
  hasGameStateOverride,
  babsonVenueSide,
  onPitcherInputChange,
  onHitterChange,
  onHitterBlur,
  onVenueSideChange,
  onResetOverride,
  onOverrideChange,
  onBaserunnerDraftChange,
  onBaserunnerDraftBlur,
  onCommitBaserunnerDraft,
  onCountPresetChange,
}: ChartingEditorTopBarProps) => {
  const battingTeamLabel = activeBattingSide === "our" ? ourTeamLabel : opponentTeamLabel;
  const pitchingTeamLabel = activePitchingSide === "our" ? ourTeamLabel : opponentTeamLabel;

  return (
    <section
      className="border-b border-[rgba(var(--babson-grey-rgb),0.18)] px-3 py-1.5 lg:px-4"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(var(--babson-grey-rgb), 0.04), transparent)",
      }}
    >
      <div className="mx-auto grid w-full max-w-[1680px] gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(0,1.9fr)_minmax(0,1.25fr)]">
        <div className="flex min-w-0 flex-col rounded-xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Current At-Bat
            </div>
            <span className="rounded-full border border-[rgba(var(--babson-grey-rgb),0.18)] bg-zinc-950/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {battingTeamLabel} batting
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {pitchingTeamLabel} pitcher
              </span>
              <input
                list={pitcherDatalistId}
                value={pitcherNameInput}
                onChange={onPitcherInputChange}
                disabled={currentPitcherLocked}
                placeholder={
                  activePitchingSide === "our" ? "Babson pitcher" : "Opponent pitcher"
                }
                className="h-9 w-full min-w-0 rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-xs font-bold text-zinc-100 outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)] focus:shadow-[0_0_0_1px_rgba(var(--babson-green-rgb),0.12)] placeholder:font-normal placeholder:text-zinc-600 disabled:opacity-50"
              />
              <datalist id={pitcherDatalistId}>
                {activePitchingSide === "our"
                  ? pitchers.map((pitcher) => (
                      <option key={pitcher.playerId} value={pitcher.name} />
                    ))
                  : null}
              </datalist>
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {battingTeamLabel} hitter
              </span>
              <input
                list={datalistId}
                value={hitterName}
                onChange={(event) => onHitterChange(event.target.value)}
                onBlur={onHitterBlur}
                placeholder={activeBattingSide === "our" ? "Babson hitter" : "Opponent hitter"}
                className="h-9 w-full min-w-0 rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-xs font-bold text-zinc-100 outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)] focus:shadow-[0_0_0_1px_rgba(var(--babson-green-rgb),0.12)] placeholder:font-normal placeholder:text-zinc-600"
              />
              <datalist id={datalistId}>
                {hitterSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
          </div>
        </div>

        <div className="flex min-w-0 flex-col rounded-xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Game State
              </div>
              {sessionType === "game" ? (
                <div className="flex items-center rounded-md border border-[rgba(var(--babson-grey-rgb),0.22)] bg-zinc-950/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => onVenueSideChange("home")}
                    className={`rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                      babsonVenueSide === "home"
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => onVenueSideChange("away")}
                    className={`rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                      babsonVenueSide === "away"
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Away
                  </button>
                </div>
              ) : null}
            </div>
            {hasGameStateOverride ? (
              <button
                onClick={onResetOverride}
                className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-amber-500 hover:text-amber-400"
              >
                Reset
              </button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={overrideInning}
              onChange={(event) => onOverrideChange("inning", Number(event.target.value))}
              className="h-9 w-full min-w-0 rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-xs font-semibold text-[rgb(212,220,218)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)] outline-none focus:border-[rgba(var(--babson-green-rgb),0.45)]"
            >
              {INNING_OPTIONS.map((inning) => (
                <option key={inning} value={inning}>
                  Inning {inning}
                </option>
              ))}
            </select>
            <select
              value={overrideIsTopInning ? "top" : "bottom"}
              onChange={(event) =>
                onOverrideChange("isTopInning", event.target.value === "top")
              }
              className="h-9 w-full min-w-0 rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-xs font-semibold text-[rgb(212,220,218)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)] outline-none focus:border-[rgba(var(--babson-green-rgb),0.45)]"
            >
              <option value="top">Top - {topBattingTeam} bat</option>
              <option value="bottom">Bot - {botBattingTeam} bat</option>
            </select>
            <select
              value={overrideOuts}
              onChange={(event) => onOverrideChange("outs", Number(event.target.value))}
              className="h-9 w-full min-w-0 rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-xs font-semibold text-[rgb(212,220,218)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)] outline-none focus:border-[rgba(var(--babson-green-rgb),0.45)]"
            >
              {OUT_OPTIONS.map((outs) => (
                <option key={outs} value={outs}>
                  {outs} Outs
                </option>
              ))}
            </select>
          </div>
        </div>

        {sessionType === "game" ? (
          <div className="flex min-w-0 flex-col rounded-xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                On Base
              </div>
              <button
                type="button"
                onClick={() => onCommitBaserunnerDraft(emptyBaserunnerState(), "Base state cleared")}
                className="text-[10px] font-semibold text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Clear
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["runnerOnFirst", "1B"],
                ["runnerOnSecond", "2B"],
                ["runnerOnThird", "3B"],
              ] as const).map(([field, label]) => (
                <label key={field} className="min-w-0">
                  <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {label}
                  </span>
                  <input
                    list={datalistId}
                    value={baserunnerDraft[field] ?? ""}
                    onChange={(event) => onBaserunnerDraftChange(field, event.target.value)}
                    onBlur={onBaserunnerDraftBlur}
                    placeholder="Name"
                    className="h-9 w-full min-w-0 rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-xs font-semibold text-zinc-100 outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)] placeholder:text-zinc-600"
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col justify-center rounded-xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Pitch Count
                </div>
                {needsPAClosure ? (
                  <span className="shrink-0 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-amber-500">
                    CLOSE PA
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1.5 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-2 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-[rgb(212,220,218)]">
                    Total
                  </span>
                  <span className="text-sm font-black text-white">
                    {activePitcherPitchCount}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-2 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-[rgb(212,220,218)]">
                    Inning
                  </span>
                  <span className="text-sm font-black text-white">{inningPitches}</span>
                </span>
              </div>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]">
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-[rgb(212,220,218)]">
                Live Count
              </span>
              <span className="shrink-0 text-[1.75rem] font-black leading-none tracking-[0.28em] tabular-nums text-[var(--babson-green)]">
                {liveCountLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {sessionType !== "game" ? (
                  <>
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Start State
                    </span>
                    <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]">
                      {COUNT_PRESET_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!canEditCountPreset}
                          onClick={() => onCountPresetChange(option.value)}
                          className={countPresetButtonClass(
                            option.value === activeCountPreset,
                            !canEditCountPreset,
                          )}
                          aria-pressed={option.value === activeCountPreset}
                          title={option.detail}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {effectiveBuntMode ? (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-300">
                    Bunt Active
                  </span>
                ) : null}
                <span>
                  {
                    COUNT_PRESET_OPTIONS.find((option) => option.value === activeCountPreset)
                      ?.detail
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
