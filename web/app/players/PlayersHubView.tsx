"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronRight,
  Search,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCanonicalName, getHand } from "@/lib/canonicalPlayers";
import { handBadgeClasses } from "@/lib/handBadge";
import type { PlayerRegistryEntry } from "@/lib/playerRegistry";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { TEAM_NAME } from "@/lib/teamConfig";
import { HubActionCard, HubStatCard } from "@/app/components/hub/HubHeader";

export interface RosterEntry {
  height?: string;
  weight?: string;
  class?: string;
  photo?: string;
}

type HandFilter = "all" | "R" | "L";
type RoleFilter = "all" | "pitchers" | "hitters";

const CLASS_SORT_ORDER: Record<string, number> = {
  GR: 0,
  GRAD: 0,
  SR: 1,
  SENIOR: 1,
  JR: 2,
  JUNIOR: 2,
  SO: 3,
  SOPHOMORE: 3,
  FR: 4,
  FRESHMAN: 4,
};

function normalizeClassKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function classSortValue(value: string): number {
  const normalized = normalizeClassKey(value);
  return CLASS_SORT_ORDER[normalized] ?? 99;
}

function formatRosterDetails(rosterInfo?: RosterEntry): string[] {
  if (!rosterInfo) return [];

  const details: string[] = [];
  if (rosterInfo.height) details.push(rosterInfo.height);
  if (rosterInfo.weight) details.push(`${rosterInfo.weight} lbs`);
  if (rosterInfo.class) details.push(rosterInfo.class);
  return details;
}

function getSortableLastName(name: string): string {
  const canonicalName = getCanonicalName(name).trim();
  if (!canonicalName) return "";

  const parts = canonicalName.split(/\s+/);
  return parts[parts.length - 1] ?? canonicalName;
}

function getLastNameInitial(name: string): string {
  const lastName = getSortableLastName(name).replace(/[^A-Za-z0-9]/g, "");
  const initial = lastName.charAt(0).toUpperCase();
  return initial || "#";
}

function getThrowHand(player: PlayerRegistryEntry): "R" | "L" | null {
  const canonical = getHand(player.slug);
  if (canonical) return canonical;
  return player.throws === "R" || player.throws === "L" ? player.throws : null;
}

function getRoleLabel(player: PlayerRegistryEntry): string {
  if (player.role?.trim()) {
    return player.role.trim();
  }
  if (player.isPitcher && player.isHitter) return "Two-way";
  if (player.isPitcher) return "Pitcher";
  if (player.isHitter) return "Hitter";
  return "Player";
}

function getHandLabel(player: PlayerRegistryEntry): string | null {
  if (player.bats && player.throws) {
    return `${player.bats}/${player.throws}`;
  }

  const throwHand = getThrowHand(player);
  if (throwHand && player.isPitcher && !player.isHitter) {
    return throwHand === "R" ? "RHP" : "LHP";
  }
  if (throwHand) {
    return `T ${throwHand}`;
  }

  return null;
}

function getPlayerDisplayLabel(player: PlayerRegistryEntry): string {
  return getCanonicalName(player.name);
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-surface text-slate-900 dark:text-zinc-50 shadow-sm"
          : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-50",
      )}
    >
      {children}
    </button>
  );
}

function PlayerRow({
  player,
  rosterInfo,
  pinned = false,
}: {
  player: PlayerRegistryEntry;
  rosterInfo?: RosterEntry;
  pinned?: boolean;
}) {
  const displayName = getPlayerDisplayLabel(player);
  const hand = getThrowHand(player);
  const handLabel = getHandLabel(player);
  const roleLabel = getRoleLabel(player);
  const details = formatRosterDetails(rosterInfo);
  const initials = getLastNameInitial(player.name);
  const classLabel = rosterInfo?.class?.trim() || "—";
  const photoPath = rosterInfo?.photo?.trim() || null;

  return (
    <Link
      href={`/players/${player.slug}`}
      className={cn(
        "group block border-t border-slate-100 dark:border-zinc-800 transition-colors hover:bg-background",
        pinned ? "bg-[var(--brand-primary-surface)]" : "bg-surface",
      )}
    >
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.7fr)_7.5rem_7.5rem_7rem_minmax(0,1.1fr)] lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className={cn(
              "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[12px] font-bold",
              pinned
                ? "border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-subtle-text)]"
                : "border-slate-200 dark:border-zinc-700 bg-background text-slate-500 dark:text-zinc-400",
            )}
          >
            {photoPath ? (
              <Image
                src={photoPath}
                alt={`${displayName} headshot`}
                fill
                sizes="44px"
                className="object-cover object-[center_15%]"
                unoptimized
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="font-display truncate text-[15px] font-bold text-slate-900 dark:text-zinc-50 transition-colors group-hover:text-[var(--brand-primary-subtle-text)]"
              >
                {displayName}
              </span>
              {pinned ? (
                <span className="rounded-full border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand-primary-subtle-text)]">
                  Pinned
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-zinc-50 lg:block lg:text-slate-500 dark:lg:text-zinc-400">
          <span className="lg:hidden text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
            Role
          </span>
          <span>{roleLabel}</span>
        </div>

        <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-zinc-50 lg:block lg:text-slate-500 dark:lg:text-zinc-400">
          <span className="lg:hidden text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
            Class
          </span>
          <span>{classLabel}</span>
        </div>

        <div className="flex items-center gap-2 lg:justify-start">
          <span className="lg:hidden text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
            Hand
          </span>
          {handLabel ? (
            <span
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]",
                handBadgeClasses(hand ?? "R"),
              )}
            >
              {handLabel}
            </span>
          ) : (
            <span className="text-[13px] font-semibold text-slate-400 dark:text-zinc-500">—</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <div className="text-right">
            <div className="text-[13px] font-semibold text-slate-900 dark:text-zinc-50">
              {details.slice(0, 2).join(" · ") || "Open profile"}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
              Player details
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-[#CBD5E1] transition-colors group-hover:text-[var(--brand-primary-subtle-text)]" />
        </div>
      </div>
    </Link>
  );
}

export default function PlayersHubView({
  registry,
  roster = {},
}: {
  registry: PlayerRegistryEntry[];
  roster?: Record<string, RosterEntry>;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("pitchers");
  const [handFilter, setHandFilter] = useState<HandFilter>("all");
  const [classFilter, setClassFilter] = useState("all");
  const { slug: selectedSlug } = useSelectedPlayer();

  const classOptions = useMemo(() => {
    const values = new Set<string>();

    registry.forEach((player) => {
      const rosterClass = roster[player.slug]?.class?.trim();
      if (rosterClass) values.add(rosterClass);
    });

    return [...values].sort((a, b) => {
      const classDiff = classSortValue(a) - classSortValue(b);
      if (classDiff !== 0) return classDiff;
      return a.localeCompare(b);
    });
  }, [registry, roster]);

  const filtered = useMemo(() => {
    let result = registry;

    if (roleFilter === "pitchers") {
      result = result.filter((player) => player.isPitcher);
    } else if (roleFilter === "hitters") {
      result = result.filter((player) => player.isHitter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (player) =>
          getCanonicalName(player.name).toLowerCase().includes(q) ||
          player.slug.toLowerCase().includes(q),
      );
    }

    if (handFilter !== "all") {
      result = result.filter((player) => getThrowHand(player) === handFilter);
    }

    if (classFilter !== "all") {
      result = result.filter(
        (player) => (roster[player.slug]?.class?.trim() ?? "") === classFilter,
      );
    }

    return [...result].sort((a, b) => {
      const lastNameCompare = getSortableLastName(a.name).localeCompare(
        getSortableLastName(b.name),
      );
      if (lastNameCompare !== 0) return lastNameCompare;

      const nameCompare = getCanonicalName(a.name).localeCompare(
        getCanonicalName(b.name),
      );
      if (nameCompare !== 0) return nameCompare;

      return a.slug.localeCompare(b.slug);
    });
  }, [classFilter, handFilter, registry, roleFilter, roster, search]);

  const featuredPlayer = selectedSlug
    ? filtered.find((player) => player.slug === selectedSlug) ?? null
    : null;
  const featuredPhotoPath = (() => {
    if (!featuredPlayer) return null;
    const photo = roster[featuredPlayer.slug]?.photo;
    return photo ? photo.trim() : null;
  })();
  const rosterPlayers = featuredPlayer
    ? filtered.filter((player) => player.slug !== featuredPlayer.slug)
    : filtered;
  const rosterIndexLetters = useMemo(() => {
    const letters: string[] = [];
    const seen = new Set<string>();

    rosterPlayers.forEach((player) => {
      const letter = getLastNameInitial(player.name);
      if (!seen.has(letter)) {
        seen.add(letter);
        letters.push(letter);
      }
    });

    return letters;
  }, [rosterPlayers]);
  const hasActiveFilters =
    search.trim().length > 0 || handFilter !== "all" || classFilter !== "all" || roleFilter !== "pitchers";

  const pitcherCount = registry.filter((player) => player.isPitcher).length;
  const hitterCount = registry.filter((player) => player.isHitter).length;

  return (
    <div
      className="font-sans relative min-h-full bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_30%,#f8fafc_100%)] text-slate-900 dark:bg-[linear-gradient(180deg,#09090b_0%,#18181b_38%,#09090b_100%)] dark:text-zinc-50"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-100 dark:opacity-55"
        style={{
          background:
            "radial-gradient(circle at top center, rgba(var(--brand-primary-rgb), 0.09), transparent 60%)",
        }}
      />

      <main className="relative mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6">
              <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6366F1]">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    Roster
                  </div>
                  <h1
                    className="font-display mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[2.85rem] sm:leading-[1.02]"
                  >
                    {TEAM_NAME} Team Roster
                  </h1>
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
                <HubActionCard
                  href="/leaderboards-hub"
                  icon={Trophy}
                  sectionTitle="Leaderboards"
                  buttonLabel="All Boards"
                />
                <HubActionCard
                  href="/players/faq"
                  icon={BookOpen}
                  sectionTitle="Guide"
                  buttonLabel="Roster FAQ"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <HubStatCard
                label="Directory"
                value={String(registry.length)}
                detail="Players in the registry with profiles."
                tone="indigo"
              />
              <HubStatCard
                label="Pitchers"
                value={String(pitcherCount)}
                detail="Pitchers on the roster."
                tone="emerald"
              />
              <HubStatCard
                label="Hitters"
                value={String(hitterCount)}
                detail="Hitters on the roster."
                tone="sky"
              />
            </div>
          </div>
        </header>

        <section className="mt-8">
          <div className="space-y-4">
            <section className="rounded-[28px] border border-border bg-surface p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] sm:p-5">
              <div className="grid gap-5">
                <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1.2fr)_auto] xl:items-end">
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
                      Roster view
                    </div>
                    <div className="inline-flex flex-wrap gap-1 rounded-full border border-slate-100 dark:border-zinc-800 bg-background p-1">
                      <FilterChip active={roleFilter === "pitchers"} onClick={() => setRoleFilter("pitchers")}>
                        Pitchers
                      </FilterChip>
                      <FilterChip active={roleFilter === "hitters"} onClick={() => setRoleFilter("hitters")}>
                        Hitters
                      </FilterChip>
                      <FilterChip active={roleFilter === "all"} onClick={() => setRoleFilter("all")}>
                        All Players
                      </FilterChip>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
                      Player search
                    </div>
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-background px-4 py-3 transition-colors focus-within:border-[var(--brand-primary-border)] focus-within:bg-surface focus-within:shadow-[0_0_0_4px_rgba(var(--brand-primary-rgb),0.10)]">
                      <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search players by name or position..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="w-full min-w-0 bg-transparent text-sm text-slate-900 dark:text-zinc-50 outline-none placeholder:text-slate-400 dark:text-zinc-500"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setRoleFilter("pitchers");
                          setHandFilter("all");
                          setClassFilter("all");
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary-subtle-text)] transition-smooth hover:opacity-90"
                      >
                        Reset filters
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
                      Hand
                    </div>
                    <div className="inline-flex flex-wrap gap-1 rounded-full border border-slate-100 dark:border-zinc-800 bg-background p-1">
                      {[
                        { value: "all", label: "All" },
                        { value: "R", label: "R" },
                        { value: "L", label: "L" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setHandFilter(option.value as HandFilter)}
                          className={cn(
                            "rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] transition-colors",
                            handFilter === option.value
                              ? "bg-surface text-slate-900 dark:text-zinc-50 shadow-sm"
                              : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-50",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
                      Class
                    </div>
                    <div className="inline-flex flex-wrap gap-1 rounded-full border border-slate-100 dark:border-zinc-800 bg-background p-1">
                      {[{ value: "all", label: "All" }, ...classOptions.map((classLabel) => ({
                        value: classLabel,
                        label: classLabel,
                      }))].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setClassFilter(option.value)}
                          className={cn(
                            "rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.14em] transition-colors",
                            classFilter === option.value
                              ? "bg-surface text-slate-900 dark:text-zinc-50 shadow-sm"
                              : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-50",
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {featuredPlayer ? (
              <div className="rounded-[28px] border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                  {featuredPhotoPath ? (
                    <div className="relative h-12 w-12 overflow-hidden rounded-full border border-[var(--brand-primary-border)] bg-surface">
                      <Image
                        src={featuredPhotoPath}
                        alt={`${getPlayerDisplayLabel(featuredPlayer)} headshot`}
                        fill
                        sizes="48px"
                        className="object-cover object-[center_15%]"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--brand-primary-border)] bg-surface text-[13px] font-bold text-[var(--brand-primary-subtle-text)]">
                      {getLastNameInitial(featuredPlayer.name)}
                    </div>
                  )}
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary-border)] bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand-primary-subtle-text)]">
                        <Sparkles className="h-3.5 w-3.5" />
                        Pinned Profile
                      </div>
                      <h2
                        className="font-display mt-2 truncate text-[1.4rem] font-extrabold tracking-tight text-slate-900 dark:text-zinc-50"
                      >
                        {getPlayerDisplayLabel(featuredPlayer)}
                      </h2>
                      <p className="mt-1 text-[13px] text-slate-500 dark:text-zinc-400">
                        {getRoleLabel(featuredPlayer)} · {roster[featuredPlayer.slug]?.class?.trim() || "Class n/a"}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/players/${featuredPlayer.slug}`}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--brand-primary-hover)]"
                  >
                    Open Profile
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
              <div className="hidden border-b border-slate-100 dark:border-zinc-800 px-5 py-3 lg:grid lg:grid-cols-[minmax(0,1.7fr)_7.5rem_7.5rem_7rem_minmax(0,1.1fr)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                  Player
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                  Role
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                  Class
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                  Hand
                </div>
                <div className="text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                  Details
                </div>
              </div>

              {rosterIndexLetters.length > 1 ? (
                <div className="border-b border-slate-100 dark:border-zinc-800 px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                      Browse by last initial
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {rosterIndexLetters.map((letter) => (
                        <a
                          key={letter}
                          href={`#players-group-${letter}`}
                          className="flex h-8 min-w-8 items-center justify-center rounded-full border border-slate-200 dark:border-zinc-700 bg-background px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400 transition-colors hover:border-[var(--brand-primary-border)] hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary-subtle-text)]"
                        >
                          {letter}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {rosterPlayers.length ? (
                <div>
                  {rosterPlayers.map((player, index) => {
                    const letter = getLastNameInitial(player.name);
                    const previousLetter =
                      index > 0 ? getLastNameInitial(rosterPlayers[index - 1].name) : null;
                    const isFirstForLetter = index === 0 || previousLetter !== letter;

                    return (
                      <div
                        key={player.slug}
                        id={isFirstForLetter ? `players-group-${letter}` : undefined}
                        className={isFirstForLetter ? "scroll-mt-28" : undefined}
                      >
                        <PlayerRow
                          player={player}
                          rosterInfo={roster[player.slug]}
                          pinned={player.slug === selectedSlug}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-40 items-center justify-center px-6 py-14 text-center">
                  <div>
                    <p className="text-[15px] font-semibold text-slate-900 dark:text-zinc-50">
                      No players match this search.
                    </p>
                    <p className="mt-2 text-[13px] text-slate-500 dark:text-zinc-400">
                      Clear filters or widen the search to bring the roster back.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
