"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";

interface EditableChartingGameNameInListProps {
  gameId: string;
  initialOpponent: string | null;
  initialGameDate: string;
  revision: number;
}

export function EditableChartingGameNameInList({
  gameId,
  initialOpponent,
  initialGameDate,
  revision: initialRevision,
}: EditableChartingGameNameInListProps) {
  const router = useRouter();
  const [opponent, setOpponent] = useState(initialOpponent || "Unnamed Game");
  const [gameDate, setGameDate] = useState(initialGameDate);
  const [revision, setRevision] = useState(initialRevision);
  const [isEditing, setIsEditing] = useState(false);
  const [inputOpponent, setInputOpponent] = useState(initialOpponent || "Unnamed Game");
  const [inputDate, setInputDate] = useState(initialGameDate);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmedOpponent = inputOpponent.trim() || "Unnamed Game";
    if (trimmedOpponent === opponent && inputDate === gameDate) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/charting/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, opponent: trimmedOpponent, gameDate: inputDate }),
      });

      if (res.status === 409) {
        setIsEditing(false);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save");
      }

      const data = (await res.json()) as { game: { opponent: string | null; gameDate: string; revision: number } };
      const resolvedOpponent = data.game.opponent || "Unnamed Game";
      setOpponent(resolvedOpponent);
      setInputOpponent(resolvedOpponent);
      setGameDate(data.game.gameDate);
      setInputDate(data.game.gameDate);
      setRevision(data.game.revision);
      router.refresh();
    } catch {
      // Could show toast/error
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInputOpponent(opponent);
    setInputDate(gameDate);
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <div
        className="relative z-20 flex flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputOpponent}
            onChange={(e) => setInputOpponent(e.target.value)}
            placeholder="Session Name (e.g. MIT)"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setInputOpponent(opponent);
                setInputDate(gameDate);
                setIsEditing(false);
              }
            }}
            autoFocus
            disabled={isSaving}
            className="min-w-[8rem] rounded-md border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-[15px] font-semibold text-white outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-60"
          />
          <input
            type="date"
            value={inputDate}
            onChange={(e) => setInputDate(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setInputOpponent(opponent);
                setInputDate(gameDate);
                setIsEditing(false);
              }
            }}
            disabled={isSaving}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-[15px] font-semibold text-white outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-60"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={startEdit}
        className="group relative z-20 flex cursor-pointer items-baseline gap-1.5 text-left hover:opacity-90 w-fit"
        aria-label="Edit session name and date"
      >
        <span className="text-[17px] font-semibold text-white">{opponent}</span>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </button>
      <div className="flex items-center gap-2 text-[15px] text-zinc-500">
        <span>
          {format(parseISO(gameDate), "MMM d, yyyy")}
        </span>
      </div>
    </div>
  );
}
