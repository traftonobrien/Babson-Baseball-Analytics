"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, ClipboardPenLine } from "lucide-react";

function localDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ChartingCreateForm() {
  const router = useRouter();
  const [opponent, setOpponent] = useState("");
  const [gameDate, setGameDate] = useState(() => localDateInputValue(new Date()));
  const [charter, setCharter] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [babsonVenueSide, setBabsonVenueSide] = useState<"home" | "away">("home");
  const [babsonStartingPitcher, setBabsonStartingPitcher] = useState("");
  const [opponentStartingPitcher, setOpponentStartingPitcher] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/charting/games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          opponent,
          gameDate,
          sessionType: "game",
          babsonVenueSide,
          babsonStartingPitcher: babsonStartingPitcher.trim() || null,
          opponentStartingPitcher: opponentStartingPitcher.trim() || null,
          charter: charter.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        game?: { id: string };
      };

      if (!response.ok || !payload.game?.id) {
        throw new Error(payload.error ?? "Could not create charting game.");
      }

      startTransition(() => {
        router.push(`/charting/games/${payload.game!.id}/edit`);
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create charting game."
      );
      setPending(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-500/18 bg-zinc-950/80 shadow-[0_26px_80px_rgba(0,0,0,0.32)]">
        <div className="border-b border-zinc-800/80 px-6 py-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
            <ClipboardPenLine className="h-3.5 w-3.5" />
            New Web Charting Session
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-zinc-50 lg:text-[2.5rem]">
            Start A Game On The Portal
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
            Create the game shell here, then move directly into the live editor. This keeps the web workflow lightweight while we build toward full iPad-first parity.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6 lg:px-8">
          <div className="space-y-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-4">
            <div className="space-y-2">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Venue Side
              </span>
              <div className="inline-flex rounded-2xl border border-zinc-800 bg-zinc-950/85 p-1">
                <button
                  type="button"
                  onClick={() => setBabsonVenueSide("home")}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                    babsonVenueSide === "home"
                      ? "bg-zinc-800 text-zinc-100 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => setBabsonVenueSide("away")}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                    babsonVenueSide === "away"
                      ? "bg-zinc-800 text-zinc-100 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Away
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Our Starting Pitcher
                </span>
                <input
                  value={babsonStartingPitcher}
                  onChange={(e) => setBabsonStartingPitcher(e.target.value)}
                  placeholder="Optional"
                  className="h-10 w-full rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 text-sm font-medium text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
                />
              </label>

              <label className="block space-y-2">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Their Starting Pitcher
                </span>
                <input
                  value={opponentStartingPitcher}
                  onChange={(e) => setOpponentStartingPitcher(e.target.value)}
                  placeholder="Optional"
                  className="h-10 w-full rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 text-sm font-medium text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
                />
              </label>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Opponent
            </span>
            <input
              value={opponent}
              onChange={(event) => setOpponent(event.target.value)}
              placeholder="Enter opponent name"
              required
              className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 text-sm font-medium text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block space-y-2">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Game Date
              </span>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <input
                  type="date"
                  value={gameDate}
                  onChange={(event) => setGameDate(event.target.value)}
                  required
                  className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-950/85 pl-11 pr-4 text-sm font-medium text-zinc-100 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Charter
              </span>
              <input
                value={charter}
                onChange={(event) => setCharter(event.target.value)}
                placeholder="Optional"
                className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 text-sm font-medium text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional scouting or game-day notes"
              rows={5}
              className="w-full rounded-[1.5rem] border border-zinc-800 bg-zinc-950/85 px-4 py-3 text-sm font-medium text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
            />
          </label>

          {errorMessage ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 transition-colors hover:border-emerald-400/35 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/70 disabled:text-zinc-500"
            >
              {pending ? "Creating…" : "Create And Open Editor"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>

      <aside className="rounded-[2rem] border border-zinc-800/80 bg-zinc-950/72 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
          What Happens Next
        </div>
        <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-400">
          <p>
            The game record is created through the existing charting API, then the portal redirects straight into the editor route for live pitch entry.
          </p>
          <p>
            The editor saves full snapshots back to the same backend used by the native workflow, so the web version stays aligned with the current data model.
          </p>
        </div>
      </aside>
    </div>
  );
}
