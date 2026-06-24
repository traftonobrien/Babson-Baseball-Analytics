"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Search, UserRound } from "lucide-react";
import type { ChartingBootstrapRosterPlayer } from "@/lib/charting/types";

export function AccountSetupForm({
  accountEmail,
  rosterPlayers,
}: {
  accountEmail: string;
  rosterPlayers: ChartingBootstrapRosterPlayer[];
}) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const candidates = rosterPlayers.filter((player) => player.playerId);

    if (!term) {
      return candidates;
    }

    return candidates.filter((player) => {
      const haystack = [
        player.name,
        player.playerId,
        player.positions.join(" "),
        player.academicYear ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rosterPlayers, search]);

  const selectedPlayer = rosterPlayers.find((player) => player.playerId === playerId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/account/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "Unable to save your identity");
        return;
      }

      router.push("/account");
      router.refresh();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          <UserRound className="h-4 w-4" />
          Confirmed Email
        </div>
        <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground">
          {accountEmail}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          This verified email becomes the personalization key. Select the roster
          profile that should power your portal, defaults, and future edit permissions.
        </p>

        {selectedPlayer ? (
          <div className="mt-5 rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] p-4 text-[var(--brand-primary-subtle-text)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-[var(--brand-primary-spotlight)]">
            <div className="flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="h-4 w-4" />
              {selectedPlayer.name}
            </div>
            <p className="mt-1 text-xs">
              {selectedPlayer.positions.join(" / ") || "Roster player"} · {selectedPlayer.academicYear ?? "Year pending"}
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm font-semibold text-red-600 dark:text-red-300">{error}</p> : null}

        <button
          type="submit"
          disabled={isSaving || !playerId}
          className="mt-5 inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition-smooth hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Identity"}
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          <Search className="h-4 w-4" />
          Select Yourself
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search roster"
          className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth placeholder:text-muted focus:border-[var(--brand-primary-border)] focus:ring-2 focus:ring-[rgba(var(--brand-primary-rgb),0.22)]"
        />
        <div className="mt-4 grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
          {filteredPlayers.map((player) => {
            const isSelected = player.playerId === playerId;

            return (
              <button
                key={player.playerId ?? player.slug}
                type="button"
                onClick={() => setPlayerId(player.playerId ?? "")}
                className={
                  isSelected
                    ? "flex items-center justify-between rounded-xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-4 py-3 text-left text-[var(--brand-primary-subtle-text)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-[var(--brand-primary-spotlight)]"
                    : "flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left text-foreground transition-smooth hover:border-[var(--brand-primary-border)] hover:bg-surface-muted"
                }
              >
                <span>
                  <span className="block text-sm font-bold">{player.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {player.positions.join(" / ") || "Roster"} · {player.bats ?? "?"}/{player.throws ?? "?"} · {player.academicYear ?? "Year pending"}
                  </span>
                </span>
                <span className="ml-3 shrink-0 rounded-full border border-border bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  {player.playerId}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </form>
  );
}
