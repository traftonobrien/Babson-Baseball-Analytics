import Link from "next/link";

import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  LoaderCircle,
  Save,
  ShieldAlert,
  Timer,
  WandSparkles,
} from "lucide-react";

import type { ChartingGameStatus } from "./types";
import {
  EDITOR_GHOST_BUTTON_CLASS,
  EDITOR_ICON_BUTTON_CLASS,
  EDITOR_INPUT_CLASS,
  StatusBadge,
} from "./ui";
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
  onOpenLineupEditor: () => void;
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
  onOpenLineupEditor,
  onToggleTopBar,
  onStatusChange,
}: ChartingEditorTopHeaderProps) => {
  const toolbarButtonClass = `${EDITOR_GHOST_BUTTON_CLASS} h-9 rounded-full px-3 py-1.5 text-xs font-bold`;

  return (
    <>
      <header className="flex items-center justify-between border-b border-border/70 bg-background/88 px-6 py-4 backdrop-blur-xl lg:px-8 dark:border-zinc-800/80 dark:bg-zinc-950/82">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href={`/charting/games/${gameId}`}
            className={`${EDITOR_ICON_BUTTON_CLASS} h-9 w-9`}
            aria-label="Back to game view"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground dark:text-zinc-50">
                {opponent}
              </h1>
              <StatusBadge status={status} />
              {sessionType === "game" ? (
                <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
                  Game
                </span>
              ) : null}
              {hasGameStateOverride ? (
                <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                  <WandSparkles className="h-3 w-3" />
                  Override
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-xs text-muted">{liveSummary}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {sessionType === "game" ? (
            <button
              type="button"
              onClick={onOpenLineupEditor}
              className={toolbarButtonClass}
            >
              <Timer className="h-4 w-4" />
              <span>Lineups</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleTopBar}
            className={toolbarButtonClass}
          >
            <span>{isTopBarOpen ? "Hide Bar" : "Show Bar"}</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                isTopBarOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          <div className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
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

          <select
            value={status}
            onChange={(event) => onStatusChange(event.target.value as ChartingGameStatus)}
            className={`${EDITOR_INPUT_CLASS} h-9 cursor-pointer rounded-lg px-3 text-xs font-medium`}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="final">Final</option>
          </select>
        </div>
      </header>

      {status === "final" ? (
        <div className="flex items-center justify-between border-b border-sky-200 bg-sky-50/85 px-6 py-2 text-xs dark:border-sky-500/20 dark:bg-sky-500/10">
          <div className="flex items-center gap-2 text-sky-700 dark:text-sky-200">
            <CheckCircle2 className="h-3.5 w-3.5 flex-none" />
            <span className="font-semibold uppercase tracking-wider">Game Finalized</span>
            <span className="hidden text-sky-600/70 sm:inline dark:text-sky-300/70">
              - viewing complete record
            </span>
          </div>
          <button
            type="button"
            onClick={() => onStatusChange("active")}
            className="text-left text-xs font-semibold text-sky-700 underline underline-offset-2 transition-colors hover:text-sky-900 dark:text-sky-200 dark:hover:text-sky-100"
          >
            Reopen for editing
          </button>
        </div>
      ) : null}
    </>
  );
};
