import { motion } from "framer-motion";
import { ChevronRight, Save } from "lucide-react";

import {
  PA_RESULT_OPTIONS,
  detailTextForPAResult,
  type PAResultType,
} from "@/lib/charting/live";

import { COUNT_PRESET_OPTIONS } from "./constants";
import { pitchResultLabel } from "./pitch-utils";
import type {
  HistoryEditDraft,
  HistoryPitcherOption,
  LiveABCountPreset,
  RecentPAGroup,
} from "./types";

interface ChartingEditorHistoryEditModalProps {
  historyEditDraft: HistoryEditDraft;
  historyPitcherDatalistId: string;
  hitterDatalistId: string;
  historyPitcherOptions: HistoryPitcherOption[];
  editingHistoryGroup: RecentPAGroup | null;
  canSave: boolean;
  onClose: () => void;
  onSave: () => void;
  onPitcherNameChange: (value: string) => void;
  onHitterNameChange: (value: string) => void;
  onInitialCountChange: (value: LiveABCountPreset) => void;
  onResultCodeChange: (value: PAResultType | "") => void;
}

export const ChartingEditorHistoryEditModal = ({
  historyEditDraft,
  historyPitcherDatalistId,
  hitterDatalistId,
  historyPitcherOptions,
  editingHistoryGroup,
  canSave,
  onClose,
  onSave,
  onPitcherNameChange,
  onHitterNameChange,
  onInitialCountChange,
  onResultCodeChange,
}: ChartingEditorHistoryEditModalProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-edit-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-3xl rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.94),rgba(9,9,11,0.98))] shadow-[0_24px_64px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(var(--babson-grey-rgb),0.18)] px-5 py-4">
          <div>
            <h2 id="history-edit-modal-title" className="text-lg font-bold text-zinc-100">
              Edit At-Bat
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Update pitcher, hitter, starting count, and outcome for this history
              entry.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[rgba(var(--babson-grey-rgb),0.08)] text-zinc-400 transition-colors hover:border-[rgba(var(--babson-grey-rgb),0.38)] hover:text-zinc-100"
            aria-label="Close history editor"
          >
            <ChevronRight className="h-4 w-4 rotate-45" />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Pitcher
              </span>
              <input
                list={historyPitcherDatalistId}
                value={historyEditDraft.pitcherName}
                onChange={(event) => onPitcherNameChange(event.target.value)}
                className="h-11 w-full rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-4 text-sm font-semibold text-zinc-100 outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)]"
                placeholder="Pitcher name"
              />
              <datalist id={historyPitcherDatalistId}>
                {historyPitcherOptions.map((pitcher) => (
                  <option key={pitcher.playerId} value={pitcher.name} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Hitter
              </span>
              <input
                list={hitterDatalistId}
                value={historyEditDraft.hitterName}
                onChange={(event) => onHitterNameChange(event.target.value)}
                className="h-11 w-full rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-4 text-sm font-semibold text-zinc-100 outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)] placeholder:text-zinc-600"
                placeholder="Hitter name"
              />
            </label>

            <div>
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Starting Count
              </span>
              <div className="grid grid-cols-3 gap-2">
                {COUNT_PRESET_OPTIONS.map((option) => {
                  const active = historyEditDraft.initialCount === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onInitialCountChange(option.value)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        active
                          ? "border-emerald-500/45 bg-emerald-500/12 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.16)]"
                          : "border-[rgba(var(--babson-grey-rgb),0.22)] bg-zinc-950/70 text-zinc-400 hover:border-[rgba(var(--babson-grey-rgb),0.38)] hover:text-zinc-200"
                      }`}
                    >
                      <div className="text-sm font-bold">{option.label}</div>
                      <div className="mt-1 text-[11px] text-zinc-500">{option.detail}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Outcome
              </span>
              <select
                value={historyEditDraft.resultCode}
                onChange={(event) =>
                  onResultCodeChange(event.target.value as PAResultType | "")
                }
                className="h-11 w-full rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-4 text-sm font-semibold text-zinc-100 outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)]"
              >
                {editingHistoryGroup?.paResult === null ? (
                  <option value="">Open PA</option>
                ) : null}
                {PA_RESULT_OPTIONS.map((result) => (
                  <option key={result} value={result}>
                    {result} • {detailTextForPAResult(result)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-zinc-950/60 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Session Snapshot
            </div>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  At-Bat
                </div>
                <div className="mt-2 text-sm font-semibold text-zinc-100">
                  {editingHistoryGroup?.hitterName ?? historyEditDraft.hitterName}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Inning {editingHistoryGroup?.inning ?? "—"} •{" "}
                  {editingHistoryGroup?.pitches.length ?? 0} pitch
                  {(editingHistoryGroup?.pitches.length ?? 0) === 1 ? "" : "es"}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Current Trail
                </div>
                <div className="mt-2 space-y-2">
                  {editingHistoryGroup?.pitches.map((pitch, index) => (
                    <div
                      key={pitch.id}
                      className="flex items-center justify-between gap-3 text-xs text-zinc-400"
                    >
                      <span className="font-mono text-zinc-500">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-zinc-300">
                        {pitch.pitchType}
                      </span>
                      <span className="rounded bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
                        {pitch.count}
                      </span>
                      <span className="font-medium text-zinc-300">
                        {pitch.paResult ?? pitchResultLabel(pitch.pitchResult)}
                      </span>
                    </div>
                  )) ?? <div className="text-sm text-zinc-500">No pitches logged.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[rgba(var(--babson-grey-rgb),0.18)] px-5 py-4">
          <p className="text-xs text-zinc-500">
            History edits save through the same snapshot patch as live charting.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-zinc-950/70 px-5 text-sm font-semibold text-zinc-300 transition-colors hover:border-[rgba(var(--babson-grey-rgb),0.38)] hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--babson-green)] px-5 text-sm font-bold text-white shadow-[0_12px_26px_rgba(var(--babson-green-rgb),0.22)] transition-colors hover:bg-[#00573a] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
            >
              <Save className="h-4 w-4" />
              Save At-Bat
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
