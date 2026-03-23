"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Layers3,
  Radio,
  Search,
  Trophy,
} from "lucide-react";
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
  /** Pitch-count-weighted FB/SI family avg from session summary; may be null if no FB row. */
  avgFastballVelo: number | null;
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
    avgFastballVelo:
      raw.avgFastballVelo != null && typeof raw.avgFastballVelo === "number"
        ? raw.avgFastballVelo
        : null,
    handedness: (raw.handedness as string) ?? undefined,
    team: (raw.team as string) ?? undefined,
  };
}

function formatDate(raw: string): string {
  const parts = raw.replace(/_/g, "-").split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const shortYear = year.length === 4 ? year.slice(2) : year;
    return `${parseInt(month, 10)}/${parseInt(day, 10)}/${shortYear}`;
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
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(session);
  }

  const players: Player[] = [];
  for (const [slug, playerSessions] of map) {
    const sorted = [...playerSessions].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];

    const typeSet = new Set<string>();
    for (const session of playerSessions) {
      for (const pitchType of session.pitchTypes ?? []) {
        if (pitchType !== "Other") {
          typeSet.add(pitchType);
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
      latestAvgVelo: latest.avgFastballVelo ?? latest.weightedAvgVelo,
      pitchTypes: Array.from(typeSet).sort(),
    });
  }

  players.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  return players;
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "indigo" | "emerald" | "sky";
}) {
  const toneStyles = {
    indigo:
      "from-[#EEF2FF] to-white text-[#4F46E5] border-[#E0E7FF] dark:from-indigo-950/45 dark:to-zinc-900 dark:text-indigo-300 dark:border-indigo-800/60",
    emerald:
      "from-[#ECFDF5] to-white text-[#10B981] border-[#D1FAE5] dark:from-emerald-950/45 dark:to-zinc-900 dark:text-emerald-300 dark:border-emerald-800/60",
    sky:
      "from-[#EFF6FF] to-white text-[#0EA5E9] border-[#DBEAFE] dark:from-sky-950/45 dark:to-zinc-900 dark:text-sky-300 dark:border-sky-800/60",
  }[tone];

  return (
    <div className={`rounded-[24px] border bg-gradient-to-br p-4 shadow-[0_16px_36px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.35)] ${toneStyles}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-3 text-[2rem] font-black tracking-tight text-slate-900 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{detail}</div>
    </div>
  );
}

function ActionCard({
  href,
  icon: Icon,
  sectionTitle,
  buttonLabel,
}: {
  href: string;
  icon: typeof BookOpen;
  sectionTitle: string;
  buttonLabel: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-surface p-5 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{sectionTitle}</div>
      <div className="mt-3">
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(var(--brand-primary-rgb),0.22)] transition-smooth hover:bg-[var(--brand-primary-hover)]"
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {buttonLabel}
          <ChevronRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  isMe,
}: {
  player: Player;
  isMe: boolean;
}) {
  const hand = parseHand(player.handedness);

  return (
    <Link
      href={`/trackman/player/${player.slug}`}
      className={`group relative block overflow-hidden rounded-[24px] border bg-surface p-5 shadow-[0_16px_36px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)] ${
        isMe ? "border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)]" : "border-border"
      }`}
    >
      <div
        className={`absolute left-0 top-5 bottom-5 w-[3px] rounded-full transition-colors ${
          isMe ? "bg-[var(--brand-primary)]" : "bg-[var(--brand-primary)]/0 group-hover:bg-[var(--brand-primary)]/60"
        }`}
      />

      <div className="pl-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[15px] font-bold text-slate-900 dark:text-zinc-50 transition-colors group-hover:text-[var(--brand-primary)]">
                {getCanonicalName(player.name)}
              </h3>
              {isMe ? (
                <span className="rounded-full border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand-primary-subtle-text)]">
                  You
                </span>
              ) : null}
              {hand ? (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${handBadgeClassesCompact(hand)}`}>
                  {hand === "L" ? "LHP" : "RHP"}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              {player.sessionCount} session{player.sessionCount !== 1 ? "s" : ""}
            </p>
          </div>

          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400 dark:text-zinc-500 transition-colors group-hover:text-[var(--brand-primary)]" />
        </div>

        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
            Latest Session
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-zinc-50">{formatDate(player.latestDate)}</div>
        </div>
      </div>
    </Link>
  );
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
        if (!seen.has(key)) {
          seen.set(key, session);
        }
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
        const lastNameCompare = getSortableLastName(a.name).localeCompare(getSortableLastName(b.name));
        if (lastNameCompare !== 0) return lastNameCompare;

        const nameCompare = getCanonicalName(a.name).localeCompare(getCanonicalName(b.name));
        if (nameCompare !== 0) return nameCompare;

        return a.slug.localeCompare(b.slug);
      }

      const dateCompare = b.latestDate.localeCompare(a.latestDate);
      if (dateCompare !== 0) return dateCompare;

      return getCanonicalName(a.name).localeCompare(getCanonicalName(b.name));
    });
  }, [handFilter, players, search, sortMode]);

  const totalSessions = sessions.length;
  const totalPlayers = players.length;
  const trackedFbVelos = players
    .map((player) => player.latestAvgVelo)
    .filter((value): value is number => value != null);
  const avgFastballVelocity =
    trackedFbVelos.length > 0
      ? trackedFbVelos.reduce((sum, value) => sum + value, 0) / trackedFbVelos.length
      : null;

  return (
    <div className="min-h-full bg-background text-slate-900 dark:text-zinc-50">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-primary-subtle-text)]">
                  <Radio className="h-3.5 w-3.5" />
                  Player roster
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[2.85rem] sm:leading-[1.02]">
                  Trackman Hub
                </h1>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
                <ActionCard
                  href="/trackman/faq"
                  icon={BookOpen}
                  sectionTitle="Dictionary"
                  buttonLabel="Metrics Glossary"
                />
                <ActionCard
                  href="/trackman/leaderboard"
                  icon={Trophy}
                  sectionTitle="Leaderboards"
                  buttonLabel="Open Rankings"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Players Tracked"
                value={String(totalPlayers)}
                detail="Unique players in the imported sessions."
                tone="indigo"
              />
              <StatCard
                label="Sessions"
                value={String(totalSessions)}
                detail="All deduplicated session records."
                tone="emerald"
              />
              <StatCard
                label="Avg fastball velo"
                value={avgFastballVelocity != null ? `${avgFastballVelocity.toFixed(1)} mph` : "—"}
                detail="Latest-session Fastball/Sinker velocity averaged across players; uses overall pitch mix when no fastball row exists."
                tone="sky"
              />
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-[28px] border border-border bg-surface p-6 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
            <div className="animate-pulse space-y-4">
              <div className="h-4 w-40 rounded-full bg-slate-200 dark:bg-zinc-800" />
              <div className="h-12 rounded-[20px] bg-slate-100 dark:bg-zinc-900" />
              <div className="grid gap-4 md:grid-cols-2">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-36 rounded-[24px] bg-background" />
                ))}
              </div>
            </div>
          </div>
        ) : players.length === 0 ? (
          <div className="rounded-[28px] border border-border bg-surface px-6 py-20 text-center shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
            <Radio className="mx-auto mb-4 h-14 w-14 text-slate-300 dark:text-zinc-700" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">No Trackman sessions imported yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500 dark:text-zinc-400">
              Run the import script to populate the roster, then return here to review velocity, pitch mix, and session history.
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
              scripts/import_trackman_pdf.py
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
              <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[auto_minmax(15rem,1fr)] lg:items-end">
                <div className="grid gap-4 sm:grid-cols-2 lg:w-max lg:max-w-full">
                  <FilterGroup
                    label="Sort"
                    items={[
                      { label: "Most Recent", value: "recent" },
                      { label: "A-Z", value: "alpha" },
                    ]}
                    selected={sortMode}
                    onChange={setSortMode}
                  />

                  <FilterGroup
                    label="Hand"
                    items={[
                      { label: "All", value: "all" },
                      { label: "RHP", value: "R" },
                      { label: "LHP", value: "L" },
                    ]}
                    selected={handFilter}
                    onChange={setHandFilter}
                  />
                </div>

                <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 transition-colors focus-within:border-[var(--brand-primary-border)] focus-within:bg-surface">
                  <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full min-w-0 bg-transparent text-sm text-slate-900 dark:text-zinc-50 outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                  />
                </label>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((player) => (
                <PlayerCard key={player.slug} player={player} isMe={player.slug === selectedSlug} />
              ))}
            </section>

            {filtered.length === 0 ? (
              <div className="rounded-[24px] border border-border bg-surface px-6 py-14 text-center shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
                <Layers3 className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-zinc-700" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">No players match your search</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
                  Try clearing the query or switching the hand filter back to All.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: { label: string; value: T }[];
  selected: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
        {label}
      </div>
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-slate-100 dark:border-zinc-800 bg-background p-1">
        {items.map((item) => {
          const active = selected === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              aria-pressed={active}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-surface text-slate-900 dark:text-zinc-50 shadow-sm"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
