"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";

interface DeleteChartingGameButtonProps {
  gameId: string;
  opponent: string;
  gameDate: string;
  compact?: boolean;
  redirectHref?: string;
}

export function DeleteChartingGameButton({
  gameId,
  opponent,
  gameDate,
  compact = false,
  redirectHref,
}: DeleteChartingGameButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete charting session for ${opponent} on ${gameDate}?\n\nThis permanently removes the game shell, pitches, plate appearances, lineup, and pitcher segments.`
    );

    if (!confirmed) {
      return;
    }

    setPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/charting/games/${gameId}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not delete charting session.");
      }

      startTransition(() => {
        if (redirectHref) {
          router.push(redirectHref);
        }
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not delete charting session."
      );
      setPending(false);
    }
  };

  return (
    <div className={compact ? "flex items-center" : "space-y-3"}>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className={
          compact
            ? "inline-flex h-10 items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-4 text-sm font-semibold text-rose-200 transition-colors hover:border-rose-400/30 hover:bg-rose-500/15 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/70 disabled:text-zinc-500"
            : "inline-flex h-11 items-center gap-2 self-start rounded-full border border-rose-500/20 bg-rose-500/10 px-4 text-sm font-semibold text-rose-200 transition-colors hover:border-rose-400/30 hover:bg-rose-500/15 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/70 disabled:text-zinc-500"
        }
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        {pending ? "Deleting..." : compact ? "Delete" : "Delete Session"}
      </button>

      {errorMessage ? (
        <p className="text-sm text-rose-300">{errorMessage}</p>
      ) : null}
    </div>
  );
}
