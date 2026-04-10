import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";

import type { ChartingMatchupSide } from "@/lib/charting/types";
import { TEAM_NAME } from "@/lib/teamConfig";

interface SwitchPitcherModalProps {
  activePitchingSide: ChartingMatchupSide;
  ourTeamLabel: string;
  opponentTeamLabel: string | null;
  opponentTeams: string[];
  selectedOpponentTeam: string | null;
  pitcherSuggestions: string[];
  initialPitcherHand: "R" | "L" | null;
  onOpponentTeamChange: (value: string) => void;
  onConfirm: (selection: { name: string; pitcherHand: "R" | "L" | null }) => void;
  onClose: () => void;
}

export const SwitchPitcherModal = ({
  activePitchingSide,
  ourTeamLabel,
  opponentTeamLabel,
  opponentTeams,
  selectedOpponentTeam,
  pitcherSuggestions,
  initialPitcherHand,
  onOpponentTeamChange,
  onConfirm,
  onClose,
}: SwitchPitcherModalProps) => {
  const [name, setName] = useState("");
  const [pitcherHand, setPitcherHand] = useState<"R" | "L" | null>(
    initialPitcherHand,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const datalistId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm({ name: trimmed, pitcherHand });
  };

  const pitchingTeamLabel =
    activePitchingSide === "our" ? ourTeamLabel : (opponentTeamLabel ?? "Opponent");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-pitcher-title"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-sm rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.94),rgba(9,9,11,0.98))] shadow-[0_24px_64px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]"
        onSubmit={handleSubmit}
      >
        <div className="border-b border-[rgba(var(--babson-grey-rgb),0.18)] px-5 py-4">
          <h2 id="switch-pitcher-title" className="text-base font-bold text-zinc-100">
            Switch Pitcher
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {pitchingTeamLabel} — new pitcher entering now
          </p>
        </div>

        <div className="px-5 py-4">
          {activePitchingSide === "opponent" ? (
            <label className="mb-3 block">
              <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-[rgba(var(--babson-green-rgb),0.7)]">
                Opponent Roster Source
              </span>
              <input
                list={`${datalistId}-teams`}
                value={selectedOpponentTeam ?? ""}
                onChange={(e) => onOpponentTeamChange(e.target.value)}
                placeholder="Select opponent roster"
                className="h-10 w-full min-w-0 rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-sm font-bold text-zinc-100 outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)] focus:shadow-[0_0_0_1px_rgba(var(--babson-green-rgb),0.12)] placeholder:font-normal placeholder:text-zinc-600"
              />
              <datalist id={`${datalistId}-teams`}>
                {opponentTeams.map((team) => (
                  <option key={team} value={team} />
                ))}
              </datalist>
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-[rgba(var(--babson-green-rgb),0.7)]">
              {activePitchingSide === "our" ? `${TEAM_NAME} pitcher` : "Opponent pitcher"}
            </span>
            <input
              ref={inputRef}
              list={datalistId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                activePitchingSide === "our" ? "Start typing a name…" : "Pitcher last name"
              }
              className="h-10 w-full min-w-0 rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-sm font-bold text-zinc-100 outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)] focus:shadow-[0_0_0_1px_rgba(var(--babson-green-rgb),0.12)] placeholder:font-normal placeholder:text-zinc-600"
            />
            <datalist id={datalistId}>
              {pitcherSuggestions.map((pitcherName) => (
                <option key={pitcherName} value={pitcherName} />
              ))}
            </datalist>
          </label>
          <div className="mt-3">
            <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.18em] text-[rgba(var(--babson-green-rgb),0.7)]">
              Throws
            </span>
            <div className="inline-flex rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-black/15 p-0.5">
              {(["R", "L"] as const).map((hand) => (
                <button
                  key={hand}
                  type="button"
                  onClick={() => setPitcherHand(hand)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                    pitcherHand === hand
                      ? "bg-[rgba(var(--babson-green-rgb),0.16)] text-[var(--babson-green)]"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {hand}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[rgba(var(--babson-grey-rgb),0.18)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-xl border border-[rgba(var(--babson-green-rgb),0.35)] bg-[rgba(var(--babson-green-rgb),0.12)] px-4 py-2 text-xs font-bold text-[var(--babson-green)] transition-colors hover:bg-[rgba(var(--babson-green-rgb),0.2)] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Switch Pitcher
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};
