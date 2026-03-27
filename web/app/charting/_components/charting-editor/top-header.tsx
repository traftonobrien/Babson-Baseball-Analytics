import Link from "next/link";

import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  LoaderCircle,
  LogIn,
  Save,
  ShieldAlert,
  Timer,
  WandSparkles,
} from "lucide-react";

import type { ChartingGameStatus } from "./types";
import { StatusBadge } from "./ui";
import type { SaveState } from "./types";

interface ChartingEditorTopHeaderProps {
  gameId: string;
  opponent: string;
  liveSummary: string;
  status: ChartingGameStatus;
  sessionType: "game" | "bullpen" | "live_ab";
  hasGameStateOverride: boolean;
  isTopBarOpen: boolean;
  saveState: SaveState;
  saveStatusLabel: string;
  showManualSave: boolean;
  showReauthenticate: boolean;
  onOpenLineupEditor: () => void;
  onManualSave: () => void;
  onToggleTopBar: () => void;
  onStatusChange: (status: ChartingGameStatus) => void;
}

export const ChartingEditorTopHeader = ({
  gameId,
  opponent,
  liveSummary,
  status,
  sessionType,
  hasGameStateOverride,
  isTopBarOpen,
  saveState,
  saveStatusLabel,
  showManualSave,
  showReauthenticate,
  onOpenLineupEditor,
  onManualSave,
  onToggleTopBar,
  onStatusChange,
}: ChartingEditorTopHeaderProps) => {
  const toolbarButtonClass =
    "flex items-center gap-2 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-3 py-1.5 text-xs font-bold text-[rgb(212,220,218)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)] transition-colors hover:border-[rgba(var(--babson-grey-rgb),0.32)]";
  const reauthenticateHref = `/login?returnTo=${encodeURIComponent(
    `/charting/games/${gameId}/edit`,
  )}`;
  return (
    <>
      <header className="flex items-center justify-between border-b border-[rgba(var(--babson-grey-rgb),0.18)] bg-zinc-950/90 px-6 py-4 lg:px-8">
        <div className="flex items-center gap-4">
          <Link
            href={`/charting/games/${gameId}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] text-zinc-400 transition-colors hover:border-[rgba(var(--babson-grey-rgb),0.32)] hover:text-zinc-100"
            aria-label="Back to game view"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-white">{opponent}</h1>
              <StatusBadge status={status} />
              {sessionType === "game" ? (
                <span className="inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                  Game
                </span>
              ) : null}
              {hasGameStateOverride ? (
                <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                  <WandSparkles className="h-3 w-3" />
                  Override
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">{liveSummary}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {sessionType === "game" ? (
            <button
              onClick={onOpenLineupEditor}
              className="flex items-center gap-2 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-3 py-1.5 text-xs font-bold text-[rgb(212,220,218)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)] transition-colors hover:border-[rgba(var(--babson-grey-rgb),0.32)]"
            >
              <Timer className="h-4 w-4" />
              <span>Lineups</span>
            </button>
          ) : null}
          <button
            onClick={onToggleTopBar}
            className="flex items-center gap-2 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-3 py-1.5 text-xs font-bold text-[rgb(212,220,218)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)] transition-colors hover:border-[rgba(var(--babson-grey-rgb),0.32)]"
          >
            <span>{isTopBarOpen ? "Hide Bar" : "Show Bar"}</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                isTopBarOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          <div className="hidden items-center gap-1.5 text-xs text-zinc-500 sm:flex">
            {saveState === "saving" ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : saveState === "saved" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : saveState === "error" ? (
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>{saveStatusLabel}</span>
          </div>
          {showReauthenticate ? (
            <Link
              href={reauthenticateHref}
              target="_blank"
              rel="noreferrer"
              className={toolbarButtonClass}
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </Link>
          ) : null}
          {showManualSave ? (
            <button
              type="button"
              onClick={onManualSave}
              disabled={saveState === "saving"}
              className={`${toolbarButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Save className="h-4 w-4" />
              <span>Save Now</span>
            </button>
          ) : null}

          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value as ChartingGameStatus)}
            className="h-9 cursor-pointer rounded-lg border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-xs font-medium text-zinc-300 outline-none hover:border-[rgba(var(--babson-grey-rgb),0.32)] focus:border-[rgba(var(--babson-green-rgb),0.45)]"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="final">Final</option>
          </select>
        </div>
      </header>

      {status === "final" ? (
        <div className="flex items-center justify-between border-b border-sky-500/20 bg-sky-500/8 px-6 py-2 text-xs">
          <div className="flex items-center gap-2 text-sky-300">
            <CheckCircle2 className="h-3.5 w-3.5 flex-none" />
            <span className="font-semibold uppercase tracking-wider">Game Finalized</span>
            <span className="hidden text-sky-400/60 sm:inline">
              - viewing complete record
            </span>
          </div>
          <button
            type="button"
            onClick={() => onStatusChange("active")}
            className="text-xs text-sky-400 underline underline-offset-2 transition-colors hover:text-sky-200"
          >
            Reopen for editing
          </button>
        </div>
      ) : null}
    </>
  );
};
