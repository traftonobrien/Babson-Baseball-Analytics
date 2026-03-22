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
    indigo: "from-[#EEF2FF] to-white text-[#4F46E5] border-[#E0E7FF]",
    emerald: "from-[#ECFDF5] to-white text-[#10B981] border-[#D1FAE5]",
    sky: "from-[#EFF6FF] to-white text-[#0EA5E9] border-[#DBEAFE]",
  }[tone];

  return (
    <div className={`rounded-[24px] border bg-gradient-to-br p-4 shadow-[0_16px_36px_rgba(15,23,42,0.04)] ${toneStyles}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
        {label}
      </div>
      <div className="mt-3 text-[2rem] font-black tracking-tight text-[#0F172A]">
        {value}
      </div>
      <div className="mt-1 text-sm text-[#64748B]">{detail}</div>
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
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
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
      className={`group relative block overflow-hidden rounded-[24px] border bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)] ${
        isMe ? "border-[#C7D2FE] bg-[linear-gradient(135deg,rgba(238,242,255,0.9),white)]" : "border-[#E5E7EB]"
      }`}
    >
      <div
        className={`absolute left-0 top-5 bottom-5 w-[3px] rounded-full transition-colors ${
          isMe ? "bg-[#4F46E5]" : "bg-[#4F46E5]/0 group-hover:bg-[#4F46E5]/60"
        }`}
      />

      <div className="pl-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[15px] font-bold text-[#0F172A] transition-colors group-hover:text-[#4F46E5]">
                {getCanonicalName(player.name)}
              </h3>
              {isMe ? (
                <span className="rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4F46E5]">
                  You
                </span>
              ) : null}
              {hand ? (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${handBadgeClassesCompact(hand)}`}>
                  {hand === "L" ? "LHP" : "RHP"}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[#64748B]">
              {player.sessionCount} session{player.sessionCount !== 1 ? "s" : ""}
            </p>
          </div>

          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-[#94A3B8] transition-colors group-hover:text-[#4F46E5]" />
        </div>

        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
            Latest Session
          </div>
          <div className="mt-1 text-sm font-semibold text-[#0F172A]">{formatDate(player.latestDate)}</div>
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
    <div className="min-h-full bg-[#F8FAFC] text-[#0F172A]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[28px] border border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6366F1]">
                  <Radio className="h-3.5 w-3.5" />
                  Player roster
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-[#0F172A] sm:text-[2.85rem] sm:leading-[1.02]">
                  Trackman Hub
                </h1>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
                <ActionCard
                  href="/trackman/faq"
                  icon={BookOpen}
                  sectionTitle="Dictionary"
                  buttonLabel="Metrics glossary"
                />
                <ActionCard
                  href="/trackman/leaderboard"
                  icon={Trophy}
                  sectionTitle="Leaderboards"
                  buttonLabel="Open rankings"
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
          <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
            <div className="animate-pulse space-y-4">
              <div className="h-4 w-40 rounded-full bg-[#E2E8F0]" />
              <div className="h-12 rounded-[20px] bg-[#F1F5F9]" />
              <div className="grid gap-4 md:grid-cols-2">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-36 rounded-[24px] bg-[#F8FAFC]" />
                ))}
              </div>
            </div>
          </div>
        ) : players.length === 0 ? (
          <div className="rounded-[28px] border border-[#E5E7EB] bg-white px-6 py-20 text-center shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
            <Radio className="mx-auto mb-4 h-14 w-14 text-[#CBD5E1]" />
            <h2 className="text-xl font-bold text-[#0F172A]">No Trackman sessions imported yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[#64748B]">
              Run the import script to populate the roster, then return here to review velocity, pitch mix, and session history.
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-[#94A3B8]">
              scripts/import_trackman_pdf.py
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-[28px] border border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
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

                <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 transition-colors focus-within:border-[#C7D2FE] focus-within:bg-white">
                  <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full min-w-0 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
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
              <div className="rounded-[24px] border border-[#E5E7EB] bg-white px-6 py-14 text-center shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
                <Layers3 className="mx-auto mb-4 h-12 w-12 text-[#CBD5E1]" />
                <h2 className="text-lg font-bold text-[#0F172A]">No players match your search</h2>
                <p className="mt-2 text-sm text-[#64748B]">
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">
        {label}
      </div>
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-1">
        {items.map((item) => {
          const active = selected === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              aria-pressed={active}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-white text-[#0F172A] shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
                  : "text-[#64748B] hover:text-[#0F172A]"
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
