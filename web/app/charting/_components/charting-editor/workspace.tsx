import { ChevronDown, ChevronRight, PencilLine } from "lucide-react";

import { INNING_OPTIONS } from "./constants";
import { formatBaserunnerSummary } from "./history";
import {
  pitchResultLabel,
  pitchResultTone,
  pitchTypeTone,
} from "./pitch-utils";
import type { RecentPAGroup } from "./types";
import {
  PitchLocationGrid,
  SectionHeading,
  SelectionButton,
  SurfacePanel,
} from "./ui";
import type { PitchResult, PitchType } from "@/lib/charting/types";

interface ChartingEditorWorkspaceProps {
  selectedPitchResult: PitchResult | null;
  selectedLocation: number | null;
  showHistory: boolean;
  availablePitchTypes: readonly PitchType[];
  activePitchType: PitchType | null;
  availablePitchResults: readonly PitchResult[];
  effectiveBuntMode: boolean;
  recentPAGroups: RecentPAGroup[];
  expandedPAs: Set<string>;
  velocityDrafts: Record<string, string>;
  onLocationSelect: (cellId: number) => void;
  onShowArsenal: () => void;
  onShowHistory: () => void;
  onPitchTypeSelect: (type: PitchType) => void;
  onPitchResultChange: (result: PitchResult) => void;
  onTogglePAExpanded: (plateAppearanceId: string) => void;
  onPAHalfChange: (plateAppearanceId: string, isTopInning: boolean) => void;
  onPAInningChange: (plateAppearanceId: string, inning: number) => void;
  onOpenHistoryEdit: (group: RecentPAGroup) => void;
  onVelocityDraftChange: (pitchId: string, value: string) => void;
  onPitchVelocityCommit: (pitchId: string, rawValue: string) => void;
  onClearVelocityDraft: (pitchId: string) => void;
}

export const ChartingEditorWorkspace = ({
  selectedPitchResult,
  selectedLocation,
  showHistory,
  availablePitchTypes,
  activePitchType,
  availablePitchResults,
  effectiveBuntMode,
  recentPAGroups,
  expandedPAs,
  velocityDrafts,
  onLocationSelect,
  onShowArsenal,
  onShowHistory,
  onPitchTypeSelect,
  onPitchResultChange,
  onTogglePAExpanded,
  onPAHalfChange,
  onPAInningChange,
  onOpenHistoryEdit,
  onVelocityDraftChange,
  onPitchVelocityCommit,
  onClearVelocityDraft,
}: ChartingEditorWorkspaceProps) => {
  return (
    <section className="mx-auto flex w-full max-w-[1680px] flex-1 flex-col lg:flex-row gap-6 overflow-y-auto lg:overflow-hidden p-4 min-h-0">
      <div className="flex w-full lg:w-[38rem] min-h-0 shrink-0 flex-col items-center rounded-[2rem] border border-[rgba(var(--babson-grey-rgb),0.12)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
        <div className="mb-3 flex w-full items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col">
            <div className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Zone Workspace
            </div>
            <div className="text-[10px] text-zinc-500">Catcher view</div>
          </div>
          <div className="inline-flex rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
            Selected:
            <span className="ml-1 font-bold text-white">
              {selectedPitchResult === "hit_by_pitch"
                ? "HBP"
                : selectedLocation
                  ? `Cell ${selectedLocation}`
                  : "None"}
            </span>
          </div>
        </div>

        <div className="flex min-h-0 w-full max-w-[34rem] flex-1 items-center justify-center">
          <PitchLocationGrid
            selectedLocation={selectedLocation}
            disabled={selectedPitchResult === "hit_by_pitch"}
            onSelect={onLocationSelect}
          />
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex shrink-0 items-center rounded-xl border border-[rgba(var(--babson-grey-rgb),0.12)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.06),rgba(var(--babson-grey-rgb),0.04)_58%,rgba(9,9,11,0.92)_100%)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
          <button
            type="button"
            onClick={onShowArsenal}
            className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all ${
              !showHistory
                ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/10"
                : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
            }`}
          >
            Arsenal & Action
          </button>
          <button
            type="button"
            onClick={onShowHistory}
            className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all ${
              showHistory
                ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/10"
                : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
            }`}
          >
            Pitch History
          </button>
        </div>

        {!showHistory ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <SurfacePanel className="flex h-0 min-h-0 flex-1 flex-col p-3">
              <SectionHeading eyebrow="Arsenal" title="Pitch Family" body="" />
              <div className="mt-2 grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-2 overflow-y-auto pr-1">
                {availablePitchTypes.map((type) => (
                  <SelectionButton
                    key={type}
                    title={type}
                    subtitle=""
                    active={activePitchType === type}
                    tone={pitchTypeTone(type)}
                    onClick={() => onPitchTypeSelect(type)}
                  />
                ))}
              </div>
            </SurfacePanel>

            <SurfacePanel className="flex h-0 min-h-0 flex-1 flex-col p-3">
              <SectionHeading eyebrow="Action" title="Pitch Result" body="" />
              <div className="mt-2 grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-2 overflow-y-auto pr-1">
                {availablePitchResults.map((result) => (
                  <SelectionButton
                    key={result}
                    title={pitchResultLabel(result, effectiveBuntMode)}
                    subtitle=""
                    active={selectedPitchResult === result}
                    tone={pitchResultTone(result)}
                    onClick={() => onPitchResultChange(result)}
                  />
                ))}
              </div>
            </SurfacePanel>
          </div>
        ) : (
          <SurfacePanel className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
            <SectionHeading eyebrow="History" title="Recent Pitches" body="" />
            <div className="mt-4 flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain pr-2 pb-2">
              {recentPAGroups.length === 0 ? (
                <div className="py-4 text-center text-sm text-zinc-500">
                  No pitches charted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPAGroups.map((group) => {
                    const isExpanded = expandedPAs.has(group.paId);

                    return (
                      <div
                        key={group.paId}
                        className="shrink-0 overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-900/60"
                      >
                        <div className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-zinc-800/40">
                          <button
                            type="button"
                            onClick={() => onTogglePAExpanded(group.paId)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100"
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${group.hitterName} at-bat`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>

                          <div className="flex shrink-0 items-center gap-2">
                            <select
                              value={group.isTopInning ? "top" : "bottom"}
                              onChange={(event) =>
                                onPAHalfChange(group.paId, event.target.value === "top")
                              }
                              className="h-8 min-w-[4.9rem] rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs font-semibold text-zinc-200 outline-none focus:border-emerald-500/50"
                              aria-label={`Half inning for ${group.hitterName}`}
                            >
                              <option value="top">Top</option>
                              <option value="bottom">Bottom</option>
                            </select>
                            <select
                              value={group.inning}
                              onChange={(event) =>
                                onPAInningChange(group.paId, Number(event.target.value))
                              }
                              className="h-8 min-w-[3.2rem] rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs font-semibold text-zinc-200 outline-none focus:border-emerald-500/50"
                              aria-label={`Inning for ${group.hitterName}`}
                            >
                              {INNING_OPTIONS.map((inning) => (
                                <option key={inning} value={inning}>
                                  {inning}
                                </option>
                              ))}
                            </select>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              inning
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onTogglePAExpanded(group.paId)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-lg font-medium leading-none text-zinc-200">
                                {group.hitterName}
                              </div>
                              <div className="mt-1 truncate text-[11px] text-zinc-500">
                                {formatBaserunnerSummary(group.baserunners)}
                              </div>
                            </div>
                            <div className="hidden min-w-0 items-center gap-2 lg:flex">
                              <span className="max-w-[11rem] truncate rounded-full border border-zinc-700/70 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold normal-case tracking-normal text-zinc-300">
                                {group.pitcherName}
                              </span>
                              <span className="rounded-full border border-zinc-700/70 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                                Start {group.initialCount}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {group.paResult ? (
                                <span className="text-xl font-bold leading-none text-emerald-400">
                                  {group.paResult}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/80">
                                  Open
                                </span>
                              )}
                              <span className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-500">
                                {group.pitches.length} pitch
                                {group.pitches.length !== 1 ? "es" : ""}
                              </span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenHistoryEdit(group)}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[rgba(var(--babson-grey-rgb),0.08)] text-zinc-400 transition-colors hover:border-[rgba(var(--babson-green-rgb),0.35)] hover:text-zinc-100"
                            aria-label={`Edit ${group.hitterName} at-bat`}
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                        </div>
                        {isExpanded ? (
                          <div className="border-t border-zinc-800/70 bg-zinc-950/45 px-4 py-3">
                            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                              <span>Pitch Trail</span>
                              <span className="h-px flex-1 bg-zinc-800/70" />
                            </div>
                            <div className="space-y-2">
                              {group.pitches.map((pitch, index) => (
                                <div
                                  key={pitch.id}
                                  className="rounded-xl border border-zinc-800/70 bg-zinc-950/80 px-3 py-3"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-mono text-zinc-500">
                                          #{index + 1}
                                        </span>
                                        <span className="text-sm font-semibold text-zinc-200">
                                          {pitch.pitchType}
                                        </span>
                                      </div>
                                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                        <span className="rounded-full border border-zinc-700/70 bg-zinc-900 px-2.5 py-1 text-zinc-400">
                                          Count {pitch.count}
                                        </span>
                                        <span
                                          className={
                                            pitch.paResult
                                              ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
                                              : "rounded-full border border-zinc-700/70 bg-zinc-900 px-2.5 py-1 text-zinc-400"
                                          }
                                        >
                                          {pitch.paResult ?? pitchResultLabel(pitch.pitchResult)}
                                        </span>
                                      </div>
                                    </div>
                                    <label className="flex items-center gap-2 rounded-full border border-zinc-700/70 bg-zinc-900/80 px-2.5 py-1.5">
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                        Velo
                                      </span>
                                      <input
                                        value={
                                          velocityDrafts[pitch.id] ??
                                          (pitch.velocity?.toString() ?? "")
                                        }
                                        onChange={(event) =>
                                          onVelocityDraftChange(pitch.id, event.target.value)
                                        }
                                        onBlur={(event) =>
                                          onPitchVelocityCommit(
                                            pitch.id,
                                            event.target.value,
                                          )
                                        }
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") {
                                            event.currentTarget.blur();
                                          } else if (event.key === "Escape") {
                                            onClearVelocityDraft(pitch.id);
                                            event.currentTarget.blur();
                                          }
                                        }}
                                        inputMode="numeric"
                                        placeholder="mph"
                                        aria-label={`Velocity for pitch ${index + 1}`}
                                        className="h-8 w-16 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-center text-xs font-semibold text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500/50 focus:bg-zinc-950"
                                      />
                                    </label>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SurfacePanel>
        )}
      </div>
    </section>
  );
};
