"use client";

import Image from "next/image";
import Link from "next/link";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
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

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });
const manrope = Manrope({ subsets: ["latin"] });

export interface RosterEntry {
  height?: string;
  weight?: string;
  class?: string;
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
        "rounded-full border px-4 py-2 text-[12px] font-semibold transition-all duration-300",
        active
          ? "border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-subtle-text)] shadow-[0_10px_24px_rgba(var(--brand-primary-rgb),0.12)]"
          : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]",
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

  return (
    <Link
      href={`/players/${player.slug}`}
      className={cn(
        "group block border-t border-[#F1F5F9] transition-colors hover:bg-[#F8FAFC]",
        pinned ? "bg-[var(--brand-primary-surface)]" : "bg-white",
      )}
    >
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.7fr)_7.5rem_7.5rem_7rem_minmax(0,1.1fr)] lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold",
              pinned
                ? "border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-subtle-text)]"
                : "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]",
            )}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`${plusJakarta.className} truncate text-[15px] font-bold text-[#0F172A] transition-colors group-hover:text-[var(--brand-primary-subtle-text)]`}
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

        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0F172A] lg:block lg:text-[#64748B]">
          <span className="lg:hidden text-[11px] uppercase tracking-[0.16em] text-[#94A3B8]">
            Role
          </span>
          <span>{roleLabel}</span>
        </div>

        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0F172A] lg:block lg:text-[#64748B]">
          <span className="lg:hidden text-[11px] uppercase tracking-[0.16em] text-[#94A3B8]">
            Class
          </span>
          <span>{classLabel}</span>
        </div>

        <div className="flex items-center gap-2 lg:justify-start">
          <span className="lg:hidden text-[11px] uppercase tracking-[0.16em] text-[#94A3B8]">
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
            <span className="text-[13px] font-semibold text-[#94A3B8]">—</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <div className="text-right">
            <div className="text-[13px] font-semibold text-[#0F172A]">
              {details.slice(0, 2).join(" · ") || "Open profile"}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#94A3B8]">
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
      className={`relative min-h-full bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_30%,#f8fafc_100%)] text-[#0F172A] ${manrope.className}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background:
            "radial-gradient(circle at top center, rgba(var(--brand-primary-rgb), 0.09), transparent 60%)",
        }}
      />

      <main className="relative mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="rounded-[28px] border border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6">
              <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[22px] border border-[#E5E7EB] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
                  <Image
                    src="/babson-logo.svg"
                    alt={`${TEAM_NAME} logo`}
                    width={56}
                    height={56}
                    priority
                    className="h-auto w-auto max-h-full max-w-full"
                  />
                </div>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6366F1]">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    Roster
                  </div>
                  <h1
                    className={`${plusJakarta.className} mt-4 text-3xl font-black tracking-tight text-[#0F172A] sm:text-[2.85rem] sm:leading-[1.02]`}
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
                  buttonLabel="All boards"
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
            <div className="rounded-[28px] border border-[#E7EDF5] bg-white px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-wrap gap-2">
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

                <div className="relative w-full xl:max-w-md">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="text"
                    placeholder="Search players by name or position..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-full border border-[#E2E8F0] bg-[#F8FAFC] py-2.5 pl-11 pr-4 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-colors focus:border-[var(--brand-primary-border)] focus:bg-white focus:shadow-[0_0_0_4px_rgba(var(--brand-primary-rgb),0.10)]"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
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
                        "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
                        handFilter === option.value
                          ? "border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-subtle-text)]"
                          : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[{ value: "all", label: "All" }, ...classOptions.map((classLabel) => ({
                    value: classLabel,
                    label: classLabel,
                  }))].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setClassFilter(option.value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
                        classFilter === option.value
                          ? "border-[#BAE6FD] bg-[#E0F2FE] text-[#0369A1]"
                          : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}

                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setRoleFilter("pitchers");
                        setHandFilter("all");
                        setClassFilter("all");
                      }}
                      className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B] transition-colors hover:border-[#CBD5E1] hover:text-[#0F172A]"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {featuredPlayer ? (
              <div className="rounded-[28px] border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--brand-primary-border)] bg-white text-[13px] font-bold text-[var(--brand-primary-subtle-text)]">
                      {getLastNameInitial(featuredPlayer.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary-border)] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand-primary-subtle-text)]">
                        <Sparkles className="h-3.5 w-3.5" />
                        Pinned Profile
                      </div>
                      <h2
                        className={`${plusJakarta.className} mt-2 truncate text-[1.4rem] font-extrabold tracking-tight text-[#0F172A]`}
                      >
                        {getPlayerDisplayLabel(featuredPlayer)}
                      </h2>
                      <p className="mt-1 text-[13px] text-[#475569]">
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

            <div className="rounded-[28px] border border-[#E7EDF5] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
              <div className="hidden border-b border-[#F1F5F9] px-5 py-3 lg:grid lg:grid-cols-[minmax(0,1.7fr)_7.5rem_7.5rem_7rem_minmax(0,1.1fr)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  Player
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  Role
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  Class
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  Hand
                </div>
                <div className="text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                  Details
                </div>
              </div>

              {rosterIndexLetters.length > 1 ? (
                <div className="border-b border-[#F1F5F9] px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                      Browse by last initial
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {rosterIndexLetters.map((letter) => (
                        <a
                          key={letter}
                          href={`#players-group-${letter}`}
                          className="flex h-8 min-w-8 items-center justify-center rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B] transition-colors hover:border-[var(--brand-primary-border)] hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary-subtle-text)]"
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
                    <p className="text-[15px] font-semibold text-[#0F172A]">
                      No players match this search.
                    </p>
                    <p className="mt-2 text-[13px] text-[#64748B]">
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
