import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import type { PAResultType } from "@/lib/charting/live";
import type { PitchResult, PitchType } from "@/lib/charting/types";

import { buildPendingPitchSummary } from "./pitch-utils";

interface ChartingEditorBottomBarProps {
  showPitchRecordedFlash: boolean;
  needsPAClosure: boolean;
  closureState: string;
  closureTitle: string;
  guidanceText: string;
  closeoutGroups: ReadonlyArray<{ results: readonly PAResultType[] }>;
  activePitchType: PitchType | null;
  selectedLocation: number | null;
  selectedPitchResult: PitchResult | null;
  pendingVelocity: string;
  effectiveBuntMode: boolean;
  canConfirmPitch: boolean;
  pitchCount: number;
  onPendingVelocityChange: (value: string) => void;
  onClearPitchDraft: () => void;
  onUndo: () => void;
  onRecordPitch: () => void;
  onClosePlateAppearance: (result: PAResultType) => void;
  paResultOutsRecorded: (result: PAResultType) => number;
}

export const ChartingEditorBottomBar = ({
  showPitchRecordedFlash,
  needsPAClosure,
  closureState,
  closureTitle,
  guidanceText,
  closeoutGroups,
  activePitchType,
  selectedLocation,
  selectedPitchResult,
  pendingVelocity,
  effectiveBuntMode,
  canConfirmPitch,
  pitchCount,
  onPendingVelocityChange,
  onClearPitchDraft,
  onUndo,
  onRecordPitch,
  onClosePlateAppearance,
  paResultOutsRecorded,
}: ChartingEditorBottomBarProps) => {
  return (
    <section className="relative flex-shrink-0 border-t border-[rgba(var(--babson-grey-rgb),0.18)] bg-zinc-950/95 p-4 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:px-8 lg:py-4">
      <AnimatePresence>
        {showPitchRecordedFlash ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <span className="rounded-xl bg-[var(--babson-green)]/90 px-6 py-2.5 text-sm font-bold text-white shadow-lg">
              Pitch recorded
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mx-auto max-w-7xl">
        {needsPAClosure && closureState === "in_play" ? (
          <div className="flex items-center justify-center py-4">
            <p className="text-sm font-medium text-amber-200/80">
              Ball in play — select the result in the popup above
            </p>
          </div>
        ) : needsPAClosure ? (
          <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div>
              <h3 className="text-xl font-bold text-amber-500">{closureTitle}</h3>
              <p className="mt-1 text-sm font-medium text-amber-200/60">
                {guidanceText}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {closeoutGroups.map((group) =>
                group.results.map((result) => (
                  <button
                    key={result}
                    type="button"
                    onClick={() => onClosePlateAppearance(result)}
                    className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-3.5 text-left transition-colors hover:bg-amber-500/20"
                  >
                    <span className="text-sm font-bold text-amber-100">{result}</span>
                    {paResultOutsRecorded(result) > 0 ? (
                      <span className="rounded bg-amber-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-400">
                        {paResultOutsRecorded(result)} out
                      </span>
                    ) : null}
                  </button>
                )),
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 items-center rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.12)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-5 text-sm font-medium text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
                <span className="mr-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Pending
                </span>
                <span className="text-white">
                  {buildPendingPitchSummary({
                    selectedPitchType: activePitchType,
                    selectedLocation,
                    selectedPitchResult,
                    pendingVelocity,
                    buntMode: effectiveBuntMode,
                  })}
                </span>
              </div>
              <input
                value={pendingVelocity}
                onChange={(event) => onPendingVelocityChange(event.target.value)}
                placeholder="Velo (mph)"
                className="h-12 w-32 rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-center text-sm font-bold text-white outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)] focus:shadow-[0_0_0_1px_rgba(var(--babson-green-rgb),0.12)]"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClearPitchDraft}
                className="h-12 rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-6 text-sm font-semibold text-[rgb(212,220,218)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)] transition-all hover:border-[rgba(var(--babson-grey-rgb),0.38)] hover:text-zinc-200"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onUndo}
                disabled={pitchCount === 0}
                className="h-12 rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-6 text-sm font-semibold text-[rgb(212,220,218)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)] transition-all hover:border-[rgba(var(--babson-grey-rgb),0.38)] hover:text-zinc-200 disabled:opacity-50"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={onRecordPitch}
                disabled={!canConfirmPitch}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-transparent bg-[var(--babson-green)] px-10 font-bold text-white shadow-[0_12px_26px_rgba(var(--babson-green-rgb),0.22)] transition-colors hover:bg-[#00573a] disabled:border-[rgba(var(--babson-grey-rgb),0.22)] disabled:bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] disabled:text-zinc-500 disabled:shadow-none"
              >
                <ArrowRight className="h-5 w-5" /> Record Pitch
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
