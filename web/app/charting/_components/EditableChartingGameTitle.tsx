"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

interface EditableChartingGameTitleProps {
  gameId: string;
  initialOpponent: string;
  revision: number;
  statusBadge: React.ReactNode;
}

export function EditableChartingGameTitle({
  gameId,
  initialOpponent,
  revision: initialRevision,
  statusBadge,
}: EditableChartingGameTitleProps) {
  const [opponent, setOpponent] = useState(initialOpponent);
  const [revision, setRevision] = useState(initialRevision);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(initialOpponent);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || trimmed === opponent) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/charting/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, opponent: trimmed }),
      });

      if (res.status === 409) {
        // Stale revision - would need to refetch
        setIsEditing(false);
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save");
      }

      const data = (await res.json()) as { game: { opponent: string; revision: number } };
      setOpponent(data.game.opponent);
      setInputValue(data.game.opponent);
      setRevision(data.game.revision);
    } catch {
      // Could show toast/error
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setInputValue(opponent);
              setIsEditing(false);
            }
          }}
          autoFocus
          disabled={isSaving}
          className="min-w-[12rem] rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-2xl font-black tracking-tight text-white outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-60"
        />
        {statusBadge}
      </div>
    );
  }

  return (
    <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white">
      <button
        type="button"
        onClick={() => {
          setInputValue(opponent);
          setIsEditing(true);
        }}
        className="flex cursor-pointer items-center gap-2 text-left transition-opacity hover:opacity-90 group rounded-lg -ml-1 pl-1 pr-2 -mr-2 py-1 hover:bg-zinc-800/40"
        aria-label="Edit game name"
      >
        {opponent}
        <Pencil className="h-4 w-4 shrink-0 text-zinc-500 opacity-60 group-hover:opacity-100" aria-hidden />
      </button>
      {statusBadge}
    </h1>
  );
}
