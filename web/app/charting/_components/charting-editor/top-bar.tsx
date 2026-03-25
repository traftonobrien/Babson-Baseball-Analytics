import type { ChangeEvent } from "react";

import type {
  ChartingBaserunnerState,
  ChartingBootstrapPitcher,
  ChartingGameSnapshot,
  ChartingMatchupSide,
} from "@/lib/charting/types";

import { OnBasePanel } from "./on-base-panel";

import { COUNT_PRESET_OPTIONS, INNING_OPTIONS } from "./constants";
import type { LiveABCountPreset } from "./types";
import {
  countPresetButtonClass,
  EDITOR_INPUT_CLASS,
  EDITOR_MUTED_LABEL_CLASS,
  EDITOR_PANEL_CLASS,
  EDITOR_PANEL_MUTED_CLASS,
  EDITOR_PILL_CLASS,
} from "./ui";
import { TEAM_NAME } from "@/lib/teamConfig";

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
  onCommitBaserunnerDraft: (
    nextDraft: Partial<ChartingBaserunnerState> | null | undefined,
    successNote: string,
  ) => void;
  onCountPresetChange: (preset: LiveABCountPreset) => void;
  canSwitchPitcher: boolean;
  onSwitchPitcher: () => void;
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
  onCommitBaserunnerDraft,
  onCountPresetChange,
  canSwitchPitcher,
  onSwitchPitcher,
}: ChartingEditorTopBarProps) => {
  const battingTeamLabel = activeBattingSide === "our" ? ourTeamLabel : opponentTeamLabel;
  const pitchingTeamLabel = activePitchingSide === "our" ? ourTeamLabel : opponentTeamLabel;
  const venueSegmentClass = `${EDITOR_PANEL_MUTED_CLASS} flex items-center gap-0 rounded-md p-0.5`;
  const venueButtonClass = (active: boolean) =>
    `rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] transition-colors ${
      active
        ? "bg-surface text-foreground shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
        : "text-muted hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-100"
    }`;
  const inningSegmentClass = `${EDITOR_PANEL_MUTED_CLASS} flex flex-1 items-center gap-0 rounded-xl p-0.5`;
  const inningButtonClass = (active: boolean) =>
    `flex-1 rounded-[10px] py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] transition-all ${
      active
        ? "bg-surface text-foreground shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
        : "text-muted hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-100"
    }`;
  const compactMetricPillClass =
    "flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/82";

  return (
    <section
      className="border-b border-border/60 bg-background/55 px-3 py-1.5 backdrop-blur-xl lg:px-4 dark:border-zinc-800/80 dark:bg-zinc-950/35"
    >
      <div className="mx-auto grid w-full max-w-[1680px] gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1.05fr)_minmax(0,1.25fr)]">
        <div className={`${EDITOR_PANEL_CLASS} flex min-w-0 flex-col p-3`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[rgba(var(--babson-green-rgb),0.6)] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--babson-green)]" />
              </span>
              <div className={EDITOR_MUTED_LABEL_CLASS}>
                Current At-Bat
              </div>
            </div>
            <span className={EDITOR_PILL_CLASS}>
              {battingTeamLabel} batting
            </span>
          </div>
          <div className="grid gap-x-2 gap-y-1.5 sm:grid-cols-[1fr_auto_1fr]">
            <label className="min-w-0 border-l-2 border-l-[rgba(var(--brand-primary-rgb),0.35)] pl-2">
              <span className={EDITOR_MUTED_LABEL_CLASS}>
                {pitchingTeamLabel} pitcher
              </span>
              <input
                list={pitcherDatalistId}
                value={pitcherNameInput}
                onChange={onPitcherInputChange}
                disabled={currentPitcherLocked}
                placeholder={
                  activePitchingSide === "our" ? `${TEAM_NAME} pitcher` : "Opponent pitcher"
                }
                className={`${EDITOR_INPUT_CLASS} h-9 px-3 text-xs font-bold placeholder:font-normal disabled:cursor-not-allowed disabled:opacity-60`}
              />
              <datalist id={pitcherDatalistId}>
                {activePitchingSide === "our"
                  ? pitchers.map((pitcher) => (
                      <option key={pitcher.playerId} value={pitcher.name} />
                    ))
                  : null}
              </datalist>
              {sessionType === "game" ? (
                <button
                  type="button"
                  disabled={!canSwitchPitcher}
                  onClick={onSwitchPitcher}
                  className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[rgba(var(--babson-green-rgb),0.65)] transition-colors hover:text-[var(--babson-green)] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Switch Pitcher →
                </button>
              ) : null}
            </label>
            <div className="hidden items-end pb-[11px] sm:flex">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-muted">
                vs
              </span>
            </div>
            <label className="min-w-0 border-l-2 border-l-border pl-2 dark:border-l-zinc-700">
              <span className={EDITOR_MUTED_LABEL_CLASS}>
                {battingTeamLabel} hitter
              </span>
              <input
                list={datalistId}
                value={hitterName}
                onChange={(event) => onHitterChange(event.target.value)}
                onBlur={onHitterBlur}
                placeholder={activeBattingSide === "our" ? `${TEAM_NAME} hitter` : "Opponent hitter"}
                className={`${EDITOR_INPUT_CLASS} h-9 px-3 text-xs font-bold placeholder:font-normal`}
              />
              <datalist id={datalistId}>
                {hitterSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
          </div>
        </div>

        <div className={`${EDITOR_PANEL_CLASS} flex min-w-0 flex-col p-3`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={EDITOR_MUTED_LABEL_CLASS}>
                Game State
              </div>
              {sessionType === "game" ? (
                <div className={venueSegmentClass}>
                  <button
                    type="button"
                    onClick={() => onVenueSideChange("home")}
                    className={venueButtonClass(babsonVenueSide === "home")}
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => onVenueSideChange("away")}
                    className={venueButtonClass(babsonVenueSide === "away")}
                  >
                    Away
                  </button>
                </div>
              ) : null}
            </div>
            {hasGameStateOverride ? (
              <button
                type="button"
                onClick={onResetOverride}
                className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 transition-colors hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
              >
                Reset
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-3">
            <select
              value={overrideInning}
              onChange={(event) => onOverrideChange("inning", Number(event.target.value))}
              className={`${EDITOR_INPUT_CLASS} h-9 px-3 text-xs font-bold`}
            >
              {INNING_OPTIONS.map((inning) => (
                <option key={inning} value={inning}>
                  Inning {inning}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <div className={inningSegmentClass}>
                <button
                  type="button"
                  onClick={() => onOverrideChange("isTopInning", true)}
                  className={inningButtonClass(overrideIsTopInning)}
                  title={`Top: ${topBattingTeam} batting`}
                >
                  Top
                </button>
                <button
                  type="button"
                  onClick={() => onOverrideChange("isTopInning", false)}
                  className={inningButtonClass(!overrideIsTopInning)}
                  title={`Bottom: ${botBattingTeam} batting`}
                >
                  Bot
                </button>
              </div>
              <div className={`${EDITOR_PANEL_MUTED_CLASS} flex items-center gap-1 rounded-xl px-3 py-2`}>
                <span className="mr-1.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Out
                </span>
                {[0, 1].map((pipIndex) => {
                  const filled = overrideOuts > pipIndex;
                  return (
                    <button
                      key={pipIndex}
                      type="button"
                      onClick={() =>
                        onOverrideChange("outs", filled ? pipIndex : pipIndex + 1)
                      }
                      className={`h-3.5 w-3.5 rounded-full border transition-all ${
                        filled
                          ? "border-amber-400/70 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.42)]"
                          : "border-border bg-transparent hover:border-amber-300 dark:border-zinc-600 dark:hover:border-zinc-400"
                      }`}
                      title={filled ? `Click to set ${pipIndex} out(s)` : `Click to set ${pipIndex + 1} out(s)`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {sessionType === "game" ? (
          <OnBasePanel
            baserunnerDraft={baserunnerDraft}
            onCommitBaserunnerDraft={onCommitBaserunnerDraft}
          />
        ) : null}

        <div className={`${EDITOR_PANEL_CLASS} flex min-w-0 flex-col justify-center p-3`}>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className={`${EDITOR_MUTED_LABEL_CLASS} shrink-0`}>
                  Pitch Count
                </div>
                {needsPAClosure ? (
                  <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                    CLOSE PA
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={compactMetricPillClass}>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
                    Total
                  </span>
                  <span className="text-sm font-black text-foreground dark:text-zinc-50">
                    {activePitcherPitchCount}
                  </span>
                </span>
                <span className={compactMetricPillClass}>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
                    Inning
                  </span>
                  <span className="text-sm font-black text-foreground dark:text-zinc-50">
                    {inningPitches}
                  </span>
                </span>
              </div>
            </div>
            <div className={`${EDITOR_PANEL_MUTED_CLASS} flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2`}>
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-muted">
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
                    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
                      Start State
                    </span>
                    <div className={`${EDITOR_PANEL_MUTED_CLASS} inline-flex flex-wrap items-center gap-1 rounded-full p-1`}>
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
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                {effectiveBuntMode ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
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
