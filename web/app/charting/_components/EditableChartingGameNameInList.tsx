"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

interface EditableChartingGameNameInListProps {
  gameId: string;
  initialOpponent: string;
  revision: number;
}

export function EditableChartingGameNameInList({
  gameId,
  initialOpponent,
  revision: initialRevision,
}: EditableChartingGameNameInListProps) {
  const router = useRouter();
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
    setInputValue(opponent);
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <div
        className="relative z-20"
        onClick={(e) => e.stopPropagation()}
      >
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
          className="min-w-[8rem] rounded-md border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-[17px] font-semibold text-white outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-60"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="group relative z-20 flex cursor-pointer items-baseline gap-1.5 text-left hover:opacity-90"
      aria-label="Edit session name"
    >
      <span className="text-[17px] font-semibold text-white">{opponent}</span>
      <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
    </button>
  );
}
