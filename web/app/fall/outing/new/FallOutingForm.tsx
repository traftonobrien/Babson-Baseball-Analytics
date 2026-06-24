"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import type { PlayerAccountRecord } from "@/lib/accounts/repository";
import { FALL_SESSION_LABELS, type FallSessionType } from "@/lib/charting/fallSessionTypes";

const SESSION_OPTIONS: Array<{ value: FallSessionType; label: string }> = [
  { value: "fall_bullpen", label: "Bullpen" },
  { value: "fall_live_ab", label: "Live ABs" },
  { value: "fall_intersquad", label: "Intersquad" },
  { value: "fall_scrimmage", label: "Scrimmage" },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth placeholder:text-muted focus:border-[var(--brand-primary-border)] focus:ring-2 focus:ring-[rgba(var(--brand-primary-rgb),0.22)]";

export function FallOutingForm({ account }: { account: PlayerAccountRecord | null }) {
  const router = useRouter();
  const [sessionType, setSessionType] = useState<FallSessionType>("fall_bullpen");
  const [date, setDate] = useState(todayKey());
  const [pitcher, setPitcher] = useState(account?.playerName ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!pitcher.trim()) {
      setError("Pitcher name required");
      return;
    }
    setIsCreating(true);
    try {
      const response = await fetch("/api/charting/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType,
          gameDate: date,
          babsonStartingPitcher: pitcher.trim(),
          notes: notes.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        game?: { id: string };
        error?: string;
      } | null;
      if (!response.ok || !payload?.game?.id) {
        setError(payload?.error ?? "Could not create session");
        return;
      }
      router.push(`/charting/games/${payload.game.id}/edit`);
    } catch {
      setError("Unable to reach server");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Session type */}
      <div>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Session Type
        </span>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SESSION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSessionType(opt.value)}
              className={
                sessionType === opt.value
                  ? "rounded-xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] px-4 py-3 text-sm font-bold text-[var(--brand-primary-subtle-text)]"
                  : "rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-muted hover:bg-surface-muted"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`mt-2 ${inputClass}`}
          required
        />
      </div>

      {/* Pitcher */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Pitcher
        </label>
        <input
          type="text"
          value={pitcher}
          onChange={(e) => setPitcher(e.target.value)}
          placeholder="Player name"
          className={`mt-2 ${inputClass}`}
          required
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Notes{" "}
          <span className="normal-case font-normal text-muted">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Focus areas, context, etc."
          className={`mt-2 ${inputClass} resize-none`}
        />
      </div>

      {error ? (
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isCreating || !pitcher.trim()}
        className="inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-6 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_28px_rgba(var(--brand-primary-rgb),0.18)] transition-smooth hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play className="h-4 w-4" />
        {isCreating
          ? "Opening..."
          : `Start ${FALL_SESSION_LABELS[sessionType]} Session`}
      </button>
    </form>
  );
}
