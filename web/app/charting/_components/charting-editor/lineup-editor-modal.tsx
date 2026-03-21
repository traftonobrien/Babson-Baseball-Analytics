import { motion } from "framer-motion";
import { ChevronRight, Save } from "lucide-react";

import type { ChartingMatchupSide } from "@/lib/charting/types";

import type { LineupDrafts } from "./types";

interface ChartingEditorLineupModalProps {
  ourTeamLabel: string;
  opponentTeamLabel: string | null;
  lineupDrafts: LineupDrafts;
  onClose: () => void;
  onSave: () => void;
  onLineupDraftChange: (
    side: ChartingMatchupSide,
    slot: number,
    value: string,
  ) => void;
}

export const ChartingEditorLineupModal = ({
  ourTeamLabel,
  opponentTeamLabel,
  lineupDrafts,
  onClose,
  onSave,
  onLineupDraftChange,
}: ChartingEditorLineupModalProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lineup-editor-title"
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-5xl rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.94),rgba(9,9,11,0.98))] shadow-[0_24px_64px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(var(--babson-grey-rgb),0.18)] px-5 py-4">
          <div>
            <h2 id="lineup-editor-title" className="text-lg font-bold text-zinc-100">
              Pregame Lineups
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Enter both lineups before first pitch. Opponent names are free text
              and save into the game snapshot.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[rgba(var(--babson-grey-rgb),0.08)] text-zinc-400 transition-colors hover:border-[rgba(var(--babson-grey-rgb),0.38)] hover:text-zinc-100"
            aria-label="Close lineup editor"
          >
            <ChevronRight className="h-4 w-4 rotate-45" />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 lg:grid-cols-2">
          {([
            ["our", ourTeamLabel, "Babson hitter"],
            ["opponent", opponentTeamLabel, "Opponent hitter"],
          ] as const).map(([side, label, placeholder]) => (
            <div
              key={side}
              className="rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-zinc-950/60 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {side === "our" ? "Our lineup" : "Opponent lineup"}
                  </div>
                  <div className="mt-1 text-sm font-bold text-zinc-100">{label}</div>
                </div>
                <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  1-9 order
                </span>
              </div>

              <div className="grid gap-2">
                {Array.from({ length: 9 }, (_, index) => index + 1).map((slot) => (
                  <label
                    key={`${side}-${slot}`}
                    className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2"
                  >
                    <span className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-center text-xs font-bold text-zinc-300">
                      {slot}
                    </span>
                    <input
                      value={lineupDrafts[side][slot] ?? ""}
                      onChange={(event) =>
                        onLineupDraftChange(side, slot, event.target.value)
                      }
                      placeholder={placeholder}
                      className="h-10 w-full rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-4 text-sm font-semibold text-zinc-100 outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)] placeholder:text-zinc-600"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[rgba(var(--babson-grey-rgb),0.18)] px-5 py-4">
          <p className="text-xs text-zinc-500">
            Free-text names work for either side, so you can key the opponent order
            without a stored roster.
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
              type="submit"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--babson-green)] px-5 text-sm font-bold text-white shadow-[0_12px_26px_rgba(var(--babson-green-rgb),0.22)] transition-colors hover:bg-[#00573a]"
            >
              <Save className="h-4 w-4" />
              Save Lineups
            </button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
};
