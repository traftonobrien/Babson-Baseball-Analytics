"use client";

import Link from "next/link";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useMemo, useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCanonicalName, getHand } from "@/lib/canonicalPlayers";
import { handBadgeClasses } from "@/lib/handBadge";
import type { PlayerRegistryEntry } from "@/lib/playerRegistry";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { TEAM_NAME } from "@/lib/teamConfig";

const display = Plus_Jakarta_Sans({ subsets: ["latin"] });

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

function RosterStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#F1F5F9] bg-white px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
        {label}
      </div>
      <div className={`${display.className} mt-1 text-[1.5rem] font-extrabold tracking-tight text-[#0F172A]`}>
        {value}
      </div>
      <div className="mt-1 text-[12px] text-[#64748B]">{detail}</div>
    </div>
  );
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
          ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5] shadow-[0_10px_24px_rgba(79,70,229,0.12)]"
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
        pinned ? "bg-[#EEF2FF]/45" : "bg-white",
      )}
    >
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.7fr)_7.5rem_7.5rem_7rem_minmax(0,1.1fr)] lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold",
              pinned
                ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]"
                : "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]",
            )}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`${display.className} truncate text-[15px] font-bold text-[#0F172A] transition-colors group-hover:text-[#4F46E5]`}
              >
                {displayName}
              </span>
              {pinned ? (
                <span className="rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#4F46E5]">
                  Pinned
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                {player.slug.replaceAll("_", " / ")}
              </span>
              {details[0] ? (
                <span className="rounded-full border border-[#E2E8F0] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                  {details[0]}
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
          <ChevronRight className="h-5 w-5 text-[#CBD5E1] transition-colors group-hover:text-[#4F46E5]" />
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
  const rosterInfoCount = registry.filter((player) => roster[player.slug]).length;

  return (
    <div className={`min-h-full bg-[#F8FAFC] text-[#0F172A] ${display.className}`}>
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8 sm:py-8">
        <section className="rounded-[28px] border border-[#F1F5F9] bg-white px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4F46E5]">
                <Users className="h-3.5 w-3.5" />
                Roster Hub
              </div>
              <h1 className="mt-4 text-[2.1rem] font-extrabold tracking-tight text-[#0F172A] sm:text-[2.6rem]">
                {TEAM_NAME} Team Roster
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-7 text-[#64748B]">
                Browse the {TEAM_NAME} player directory, pin a profile, and jump directly into any
                player page. The surface stays lightweight so the roster is fast to scan.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/players/faq"
                className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-[13px] font-semibold text-[#475569] transition-colors hover:border-[#CBD5E1] hover:text-[#0F172A]"
              >
                <BookOpen className="h-4 w-4" />
                Roster Guide
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <RosterStat label="Players" value={String(registry.length)} detail="total in directory" />
            <RosterStat label="Pitchers" value={String(pitcherCount)} detail="available in roster" />
            <RosterStat label="Hitters" value={String(hitterCount)} detail="available in roster" />
            <RosterStat label="With Info" value={String(rosterInfoCount)} detail="have roster metadata" />
            <RosterStat label="Visible" value={String(filtered.length)} detail="current filter result" />
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.95fr)]">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-[#F1F5F9] bg-white px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
                    <Filter className="h-3.5 w-3.5" />
                    View
                  </span>
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
                </div>

                <div className="relative w-full xl:max-w-md">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="text"
                    placeholder="Search players by name or position..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-full border border-[#E2E8F0] bg-[#F8FAFC] py-2.5 pl-11 pr-4 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none transition-colors focus:border-[#C7D2FE] focus:bg-white focus:shadow-[0_0_0_4px_rgba(129,140,248,0.10)]"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                    Hand
                  </span>
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
                          ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]"
                          : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                    Class
                  </span>
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
              <div className="rounded-[24px] border border-[#C7D2FE] bg-[#EEF2FF] px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#C7D2FE] bg-white text-[13px] font-bold text-[#4F46E5]">
                      {getLastNameInitial(featuredPlayer.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#C7D2FE] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#4F46E5]">
                        <Sparkles className="h-3.5 w-3.5" />
                        Pinned Profile
                      </div>
                      <h2 className="mt-2 truncate text-[1.4rem] font-extrabold tracking-tight text-[#0F172A]">
                        {getPlayerDisplayLabel(featuredPlayer)}
                      </h2>
                      <p className="mt-1 text-[13px] text-[#475569]">
                        {getRoleLabel(featuredPlayer)} · {roster[featuredPlayer.slug]?.class?.trim() || "Class n/a"}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/players/${featuredPlayer.slug}`}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#4F46E5] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#4338CA]"
                  >
                    Open Profile
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="rounded-[24px] border border-[#F1F5F9] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
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
                          className="flex h-8 min-w-8 items-center justify-center rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B] transition-colors hover:border-[#C7D2FE] hover:bg-[#EEF2FF] hover:text-[#4F46E5]"
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

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-[#F1F5F9] bg-white px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Directory Snapshot
              </div>
              <div className="mt-2 text-[1.35rem] font-extrabold tracking-tight text-[#0F172A]">
                Fast scan, no clutter
              </div>
              <p className="mt-2 text-[13px] leading-6 text-[#64748B]">
                Use the filters to collapse the roster to the slice you need, then open a player for deeper profile data.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                    Active View
                  </div>
                  <div className="mt-1 text-[18px] font-extrabold text-[#0F172A]">
                    {roleFilter === "all" ? "All" : roleFilter === "pitchers" ? "Pitchers" : "Hitters"}
                  </div>
                </div>
                <div className="rounded-[18px] border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                    Visible
                  </div>
                  <div className="mt-1 text-[18px] font-extrabold text-[#0F172A]">{filtered.length}</div>
                </div>
                <div className="rounded-[18px] border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                    Hand Filter
                  </div>
                  <div className="mt-1 text-[18px] font-extrabold text-[#0F172A]">
                    {handFilter === "all" ? "Any" : handFilter}
                  </div>
                </div>
                <div className="rounded-[18px] border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                    Classes
                  </div>
                  <div className="mt-1 text-[18px] font-extrabold text-[#0F172A]">{classOptions.length || 0}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#F1F5F9] bg-white px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.04)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
                Quick Notes
              </div>
              <ul className="mt-3 space-y-3 text-[13px] leading-6 text-[#64748B]">
                <li className="rounded-[18px] border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                  Pinning a player from another page keeps them at the top here for quick return.
                </li>
                <li className="rounded-[18px] border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                  The roster sorts by last name, then canonical name, so the directory stays stable.
                </li>
                <li className="rounded-[18px] border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                  Use the initial chips to jump within long lists once filters narrow the set.
                </li>
              </ul>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
