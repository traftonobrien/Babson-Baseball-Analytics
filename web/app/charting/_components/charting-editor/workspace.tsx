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
  EDITOR_ICON_BUTTON_CLASS,
  EDITOR_INPUT_CLASS,
  EDITOR_MUTED_LABEL_CLASS,
  EDITOR_PANEL_CLASS,
  EDITOR_PANEL_MUTED_CLASS,
  EDITOR_PILL_CLASS,
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
  const toggleShellClass = `${EDITOR_PANEL_MUTED_CLASS} flex shrink-0 items-center p-1`;
  const toggleButtonClass = (active: boolean) =>
    `flex-1 rounded-[1rem] py-2.5 text-xs font-bold uppercase tracking-[0.16em] transition-all ${
      active
        ? "bg-surface text-foreground shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
        : "text-muted hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-100"
    }`;

  return (
    <section className="mx-auto flex w-full max-w-[1680px] min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
      <div className={`${EDITOR_PANEL_CLASS} flex w-full min-h-0 shrink-0 flex-col items-center p-4 lg:w-[38rem]`}>
        <div className="mb-3 flex w-full items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col">
            <div className={`${EDITOR_MUTED_LABEL_CLASS} whitespace-nowrap`}>
              Zone Workspace
            </div>
            <div className="text-[10px] text-muted">Catcher view</div>
          </div>
          <div className={EDITOR_PILL_CLASS}>
            Selected:
            <span className="ml-1 font-bold text-foreground dark:text-zinc-50">
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
        <div className={toggleShellClass}>
          <button
            type="button"
            onClick={onShowArsenal}
            className={toggleButtonClass(!showHistory)}
          >
            Arsenal & Action
          </button>
          <button
            type="button"
            onClick={onShowHistory}
            className={toggleButtonClass(showHistory)}
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
                <div className="py-4 text-center text-sm text-muted">
                  No pitches charted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPAGroups.map((group) => {
                    const isExpanded = expandedPAs.has(group.paId);

                    return (
                      <div
                        key={group.paId}
                        className={`${EDITOR_PANEL_MUTED_CLASS} shrink-0 overflow-hidden`}
                      >
                        <div className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-surface/80 dark:hover:bg-zinc-900/80">
                          <button
                            type="button"
                            onClick={() => onTogglePAExpanded(group.paId)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
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
                              className={`${EDITOR_INPUT_CLASS} h-8 min-w-[4.9rem] rounded-lg px-2 text-xs font-semibold`}
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
                              className={`${EDITOR_INPUT_CLASS} h-8 min-w-[3.2rem] rounded-lg px-2 text-xs font-semibold`}
                              aria-label={`Inning for ${group.hitterName}`}
                            >
                              {INNING_OPTIONS.map((inning) => (
                                <option key={inning} value={inning}>
                                  {inning}
                                </option>
                              ))}
                            </select>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                              inning
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => onTogglePAExpanded(group.paId)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-lg font-medium leading-none text-foreground dark:text-zinc-100">
                                {group.hitterName}
                              </div>
                              <div className="mt-1 truncate text-[11px] text-muted">
                                {formatBaserunnerSummary(group.baserunners)}
                              </div>
                            </div>
                            <div className="hidden min-w-0 items-center gap-2 lg:flex">
                              <span className="max-w-[11rem] truncate rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold normal-case tracking-normal text-foreground dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-300">
                                {group.pitcherName}
                              </span>
                              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-400">
                                Start {group.initialCount}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {group.paResult ? (
                                <span className="text-xl font-bold leading-none text-emerald-700 dark:text-emerald-300">
                                  {group.paResult}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300/80">
                                  Open
                                </span>
                              )}
                              <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] font-semibold text-muted dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400">
                                {group.pitches.length} pitch
                                {group.pitches.length !== 1 ? "es" : ""}
                              </span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenHistoryEdit(group)}
                            className={`${EDITOR_ICON_BUTTON_CLASS} h-10 w-10 shrink-0`}
                            aria-label={`Edit ${group.hitterName} at-bat`}
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                        </div>
                        {isExpanded ? (
                          <div className="border-t border-border/70 bg-background/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                              <span>Pitch Trail</span>
                              <span className="h-px flex-1 bg-border dark:bg-zinc-800" />
                            </div>
                            <div className="space-y-2">
                              {group.pitches.map((pitch, index) => (
                                <div
                                  key={pitch.id}
                                  className={`${EDITOR_PANEL_MUTED_CLASS} px-3 py-3`}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-mono text-muted">
                                          #{index + 1}
                                        </span>
                                        <span className="text-sm font-semibold text-foreground dark:text-zinc-100">
                                          {pitch.pitchType}
                                        </span>
                                      </div>
                                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                                        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-muted dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                                          Count {pitch.count}
                                        </span>
                                        <span
                                          className={
                                            pitch.paResult
                                              ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                                              : "rounded-full border border-border bg-background px-2.5 py-1 text-muted dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400"
                                          }
                                        >
                                          {pitch.paResult ?? pitchResultLabel(pitch.pitchResult)}
                                        </span>
                                      </div>
                                    </div>
                                    <label className="flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-950/80">
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
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
                                        className={`${EDITOR_INPUT_CLASS} h-8 w-16 rounded-md px-2 text-center text-xs font-semibold`}
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
