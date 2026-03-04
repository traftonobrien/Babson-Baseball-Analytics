"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Radio, Search, Trophy } from "lucide-react";
import {
  Button,
  leaderboardFilterButtonBaseClassName,
  leaderboardFilterButtonBlueActiveClassName,
  leaderboardFilterButtonBlueInactiveClassName,
} from "@/components/ui/neon-button";
import Breadcrumbs from "../components/Breadcrumbs";
import {
  LeaderboardHero,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardToolbar,
} from "../components/leaderboards/LeaderboardChrome";
import { getCanonicalName } from "@/lib/canonicalPlayers";
import { handBadgeClassesCompact, parseHand } from "@/lib/handBadge";
import { useSelectedPlayer } from "@/lib/selectedPlayer";

interface Session {
  playerName: string;
  playerSlug: string;
  date: string;
  sessionType?: string;
  pitchCount: number | null;
  pitchTypes?: string[];
  weightedAvgVelo: number | null;
  handedness?: string;
  team?: string;
}

interface Player {
  name: string;
  slug: string;
  handedness?: string;
  team?: string;
  sessionCount: number;
  latestDate: string;
  latestAvgVelo: number | null;
  pitchTypes: string[];
}

type HandFilter = "all" | "R" | "L";
type SortMode = "recent" | "alpha";

function normalizeSession(raw: Record<string, unknown>): Session {
  return {
    playerName: (raw.playerName as string) ?? "Unknown",
    playerSlug: (raw.playerSlug as string) ?? "",
    date: (raw.date as string) ?? "",
    sessionType: (raw.sessionType as string) ?? undefined,
    pitchCount: (raw.pitchCount as number) ?? (raw.totalPitches as number) ?? null,
    pitchTypes: Array.isArray(raw.pitchTypes) ? raw.pitchTypes : undefined,
    weightedAvgVelo: (raw.weightedAvgVelo as number) ?? null,
    handedness: (raw.handedness as string) ?? undefined,
    team: (raw.team as string) ?? undefined,
  };
}

function formatDate(raw: string): string {
  const parts = raw.replace(/_/g, "-").split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const shortYear = y.length === 4 ? y.slice(2) : y;
    return `${parseInt(m)}/${parseInt(d)}/${shortYear}`;
  }
  return raw;
}

function getSortableLastName(name: string): string {
  const canonicalName = getCanonicalName(name).trim();
  if (!canonicalName) return "";

  const parts = canonicalName.split(/\s+/);
  return parts[parts.length - 1] ?? canonicalName;
}

function groupByPlayer(sessions: Session[]): Player[] {
  const map = new Map<string, Session[]>();
  for (const session of sessions) {
    const key = session.playerSlug;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(session);
  }

  const players: Player[] = [];
  for (const [slug, playerSessions] of map) {
    const sorted = [...playerSessions].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];

    const typeSet = new Set<string>();
    for (const session of playerSessions) {
      if (session.pitchTypes) {
        for (const pitchType of session.pitchTypes) {
          if (pitchType !== "Other") typeSet.add(pitchType);
        }
      }
    }

    players.push({
      name: latest.playerName,
      slug,
      handedness: latest.handedness,
      team: latest.team,
      sessionCount: playerSessions.length,
      latestDate: latest.date,
      latestAvgVelo: latest.weightedAvgVelo,
      pitchTypes: Array.from(typeSet).sort(),
    });
  }

  players.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  return players;
}

export default function TrackmanPlayersPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [handFilter, setHandFilter] = useState<HandFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const { slug: selectedSlug } = useSelectedPlayer();

  useEffect(() => {
    const legacyFetch = fetch("/stats/trackman/sessions.json")
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => []);
    const pdfFetch = fetch("/trackman/index.json")
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => []);

    Promise.all([legacyFetch, pdfFetch]).then(([legacy, pdf]) => {
      const all = [
        ...(Array.isArray(legacy) ? legacy : []),
        ...(Array.isArray(pdf) ? pdf : []),
      ].map((raw) => normalizeSession(raw));

      const seen = new Map<string, Session>();
      for (const session of all) {
        const key = `${session.playerSlug}-${session.date}`;
        if (!seen.has(key)) seen.set(key, session);
      }

      setSessions(Array.from(seen.values()));
      setLoading(false);
    });
  }, []);

  const players = useMemo(() => groupByPlayer(sessions), [sessions]);

  const filtered = useMemo(() => {
    let result = players;
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (player) =>
          getCanonicalName(player.name).toLowerCase().includes(query) ||
          player.slug.toLowerCase().includes(query),
      );
    }

    if (handFilter !== "all") {
      result = result.filter((player) => parseHand(player.handedness) === handFilter);
    }

    return [...result].sort((a, b) => {
      if (sortMode === "alpha") {
        const lastNameCompare = getSortableLastName(a.name).localeCompare(
          getSortableLastName(b.name),
        );
        if (lastNameCompare !== 0) return lastNameCompare;

        const nameCompare = getCanonicalName(a.name).localeCompare(
          getCanonicalName(b.name),
        );
        if (nameCompare !== 0) return nameCompare;

        return a.slug.localeCompare(b.slug);
      }

      const dateCompare = b.latestDate.localeCompare(a.latestDate);
      if (dateCompare !== 0) return dateCompare;

      return getCanonicalName(a.name).localeCompare(getCanonicalName(b.name));
    });
  }, [handFilter, players, search, sortMode]);

  const totalSessions = sessions.length;

  return (
    <LeaderboardPageFrame maxWidth="max-w-6xl">
      <div className="flex flex-col gap-6">
        <header className="space-y-3">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Trackman" }]} />

          <LeaderboardHero
            tone="blue"
            icon={Radio}
            eyebrow="Trackman Hub"
            title="Trackman Hub"
            description="Browse imported Trackman player profiles and jump straight into movement, velocity, and session history."
            meta={
              <>
                <LeaderboardPill tone="blue">
                  {players.length} Player{players.length !== 1 ? "s" : ""}
                </LeaderboardPill>
                <LeaderboardPill tone="neutral">
                  {totalSessions} Session{totalSessions !== 1 ? "s" : ""}
                </LeaderboardPill>
              </>
            }
            side={
              <>
                <Link href="/trackman/faq" className="block">
                  <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-blue-500/25">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          Guide
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          Metrics Dictionary
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
                <Link href="/trackman/leaderboard" className="block">
                  <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-blue-500/25">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                        <Trophy className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          Rankings
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          Leaderboards
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </>
            }
          />
        </header>

        {loading ? (
          <LeaderboardPanel className="p-6">
            <div className="text-sm text-zinc-500">Loading...</div>
          </LeaderboardPanel>
        ) : players.length === 0 ? (
          <LeaderboardPanel className="p-6">
            <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950/60 p-8 text-center">
              <Radio className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">No Trackman sessions imported yet.</p>
              <p className="mt-2 text-xs text-zinc-600">
                Run{" "}
                <code className="rounded bg-zinc-800 px-1 py-0.5">
                  scripts/import_trackman_pdf.py
                </code>{" "}
                to import a PDF export.
              </p>
            </div>
          </LeaderboardPanel>
        ) : (
          <>
            <LeaderboardToolbar>
              <div className="grid gap-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-smooth focus:border-zinc-600"
                  />
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Sort
                      </span>
                      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-1">
                        <Button
                          type="button"
                          variant="default"
                          tone="blue"
                          onClick={() => setSortMode("recent")}
                          className={`${leaderboardFilterButtonBaseClassName} ${
                            sortMode === "recent"
                              ? leaderboardFilterButtonBlueActiveClassName
                              : leaderboardFilterButtonBlueInactiveClassName
                          }`}
                          aria-pressed={sortMode === "recent"}
                        >
                          Most Recent
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          tone="blue"
                          onClick={() => setSortMode("alpha")}
                          className={`${leaderboardFilterButtonBaseClassName} ${
                            sortMode === "alpha"
                              ? leaderboardFilterButtonBlueActiveClassName
                              : leaderboardFilterButtonBlueInactiveClassName
                          }`}
                          aria-pressed={sortMode === "alpha"}
                        >
                          A-Z
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Hand
                      </span>
                      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-1">
                        {[
                          { label: "All", value: "all" as const },
                          { label: "RHP", value: "R" as const },
                          { label: "LHP", value: "L" as const },
                        ].map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant="default"
                            tone="blue"
                            onClick={() => setHandFilter(option.value)}
                            className={`${leaderboardFilterButtonBaseClassName} ${
                              handFilter === option.value
                                ? leaderboardFilterButtonBlueActiveClassName
                                : leaderboardFilterButtonBlueInactiveClassName
                            }`}
                            aria-pressed={handFilter === option.value}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <LeaderboardPill tone="neutral">
                      {filtered.length} Shown
                    </LeaderboardPill>
                  </div>
                </div>
              </div>
            </LeaderboardToolbar>

            <section className="space-y-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Trackman Roster
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Open a pitcher to review movement, velocity, and session history.
                </div>
              </div>

              <LeaderboardPanel className="overflow-hidden p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {filtered.map((player) => {
                    const hand = parseHand(player.handedness);
                    const isMe = player.slug === selectedSlug;

                    return (
                      <Link
                        key={player.slug}
                        href={`/trackman/player/${player.slug}`}
                        className={`group relative block overflow-hidden rounded-[1.7rem] border p-4 shadow-[0_20px_48px_rgba(0,0,0,0.20)] transition-smooth hover:-translate-y-0.5 hover:border-zinc-600 ${isMe ? "border-emerald-500/40 shadow-[0_26px_56px_rgba(16,185,129,0.08)] bg-[radial-gradient(circle_at_82%_16%,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,rgba(24,24,27,0.76),rgba(9,9,11,0.90))]" : "border-zinc-800 bg-[radial-gradient(circle_at_82%_16%,rgba(59,130,246,0.06),transparent_24%),linear-gradient(180deg,rgba(24,24,27,0.76),rgba(9,9,11,0.90))]"} `}
                      >
                        <div
                          className={`absolute left-0 top-5 bottom-5 w-[3px] rounded-full transition-smooth ${
                            isMe
                              ? "bg-emerald-400"
                              : "bg-blue-400/0 group-hover:bg-blue-400/70"
                          }`}
                        />
                        <div className="pointer-events-none mb-4 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

                        <div className="flex items-center justify-between gap-3 pl-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-semibold text-zinc-50">
                              {getCanonicalName(player.name)}
                            </span>
                            {isMe && (
                              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                                You
                              </span>
                            )}
                            {hand && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-normal ${handBadgeClassesCompact(hand)}`}
                              >
                                {hand === "L" ? "LHP" : "RHP"}
                              </span>
                            )}
                          </div>

                          <span className="shrink-0 text-xs font-mono text-zinc-500">
                            {player.sessionCount} session{player.sessionCount !== 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-3 pl-2 text-xs text-zinc-400">
                          <span className="text-zinc-600">
                            Last: {formatDate(player.latestDate)}
                          </span>
                        </div>

                      </Link>
                    );
                  })}

                  {filtered.length === 0 && (
                    <p className="col-span-2 py-6 text-center text-sm text-zinc-500">
                      No players match your search.
                    </p>
                  )}
                </div>
              </LeaderboardPanel>
            </section>
          </>
        )}
      </div>
    </LeaderboardPageFrame>
  );
}
