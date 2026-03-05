"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Search, Sparkles, Users } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import {
  LeaderboardHero,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardStatBlock,
  LeaderboardToolbar,
} from "../components/leaderboards/LeaderboardChrome";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { getCanonicalName, getHand } from "@/lib/canonicalPlayers";
import { handBadgeClasses } from "@/lib/handBadge";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { cn } from "@/lib/utils";

export interface PlayerRegistryEntry {
  slug: string;
  name: string;
  team: string;
  role: string;
  d3_player_id: string | null;
}

export interface RosterEntry {
  height?: string;
  weight?: string;
  class?: string;
}

type HandFilter = "all" | "R" | "L";

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

function PlayerCard({
  player,
  rosterInfo,
  pinned = false,
}: {
  player: PlayerRegistryEntry;
  rosterInfo?: RosterEntry;
  pinned?: boolean;
}) {
  const hand = getHand(player.slug);
  const canonicalName = getCanonicalName(player.name);
  const details = formatRosterDetails(rosterInfo);
  const accentClasses =
    hand === "L"
      ? "border-blue-500/20 hover:border-blue-400/35 hover:shadow-[0_28px_70px_rgba(59,130,246,0.10)]"
      : "border-emerald-500/16 hover:border-emerald-400/30 hover:shadow-[0_28px_70px_rgba(16,185,129,0.10)]";

  return (
    <Link href={`/players/${player.slug}`} className="block">
      <div
        className={cn(
          "group relative h-full overflow-hidden rounded-[1.9rem] border bg-zinc-950/78 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.26)] transition-smooth hover:-translate-y-0.5",
          pinned ? "border-emerald-500/28" : accentClasses,
        )}
      >
        <GlowingEffect
          glow
          disabled={false}
          proximity={72}
          inactiveZone={0.18}
          spread={30}
          movementDuration={0.85}
          borderWidth={2}
          className="opacity-90"
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-100",
            hand === "L"
              ? "bg-[radial-gradient(circle_at_82%_16%,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,rgba(24,24,27,0.32),rgba(9,9,11,0.08))]"
              : "bg-[radial-gradient(circle_at_82%_16%,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,rgba(24,24,27,0.32),rgba(9,9,11,0.08))]",
          )}
        />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {pinned ? (
                  <LeaderboardPill tone="emerald" className="px-2.5 py-1 text-[10px]">
                    Pinned
                  </LeaderboardPill>
                ) : null}
                {player.role ? (
                  <span className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    {player.role}
                  </span>
                ) : null}
              </div>

              <h2 className="mt-3 text-xl font-black tracking-tight text-zinc-100">
                {canonicalName}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {player.team || "Babson Baseball"}
              </p>
            </div>

            {hand ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]",
                  handBadgeClasses(hand),
                )}
              >
                {hand === "R" ? "RHP" : "LHP"}
              </span>
            ) : null}
          </div>

          {details.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {details.map((detail) => (
                <span
                  key={detail}
                  className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400"
                >
                  {detail}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Open Profile
            </span>
            <span className="text-xs text-zinc-600">
              {player.slug.replaceAll("_", " / ")}
            </span>
          </div>
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

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (player) =>
          getCanonicalName(player.name).toLowerCase().includes(q) ||
          player.slug.toLowerCase().includes(q),
      );
    }

    if (handFilter !== "all") {
      result = result.filter((player) => getHand(player.slug) === handFilter);
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
  }, [classFilter, handFilter, registry, roster, search]);

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
    search.trim().length > 0 || handFilter !== "all" || classFilter !== "all";

  return (
    <LeaderboardPageFrame maxWidth="max-w-6xl">
      <div className="flex flex-col gap-6">
        <header className="space-y-3">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Players" }]} />

          <LeaderboardHero
            tone="emerald"
            icon={Users}
            eyebrow="Pitching Hub"
            title="Player Profiles"
            description="Start with the roster. Every card opens a full player page with season production, Trackman movement, command, and development context."
            meta={
              <>
                <LeaderboardPill tone="emerald">
                  {registry.length} Pitcher{registry.length !== 1 ? "s" : ""}
                </LeaderboardPill>
                <LeaderboardPill tone="neutral">Full Data Stack</LeaderboardPill>
              </>
            }
            summary={
              <LeaderboardStatBlock
                label="Roster"
                value={String(registry.length)}
                detail="pitchers currently in the directory"
                emphasisClassName="text-emerald-300"
              />
            }
            side={
              <Link href="/players/faq" className="block">
                <div className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-emerald-500/30">
                  <GlowingEffect
                    glow
                    disabled={false}
                    proximity={56}
                    inactiveZone={0.22}
                    spread={24}
                    movementDuration={0.8}
                    borderWidth={2}
                    className="opacity-80"
                  />
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
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
            }
          />
        </header>

        <LeaderboardToolbar>
          <div className="grid gap-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by player name or slug"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 py-3 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-smooth focus:border-zinc-600"
              />
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Hand
                  </span>
                  {([
                    { value: "all", label: "All" },
                    { value: "R", label: "RHP" },
                    { value: "L", label: "LHP" },
                  ] as const).map((option) => {
                    const active = handFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setHandFilter(option.value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-smooth",
                          active
                            ? "border-emerald-400/45 bg-emerald-500/14 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(52,211,153,0.12),0_0_18px_rgba(16,185,129,0.10)]"
                            : "border-zinc-800 bg-zinc-950/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Class
                  </span>
                  {[{ value: "all", label: "All" }, ...classOptions.map((classLabel) => ({
                    value: classLabel,
                    label: classLabel,
                  }))].map((option) => {
                    const active = classFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setClassFilter(option.value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-smooth",
                          active
                            ? "border-sky-400/40 bg-sky-500/12 text-sky-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(125,211,252,0.10),0_0_18px_rgba(14,165,233,0.10)]"
                            : "border-zinc-800 bg-zinc-950/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setHandFilter("all");
                      setClassFilter("all");
                    }}
                    className="rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
                  >
                    Reset
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <LeaderboardPill tone="neutral">
                  {filtered.length} Visible
                </LeaderboardPill>
                {classFilter !== "all" ? (
                  <LeaderboardPill tone="neutral">{classFilter}</LeaderboardPill>
                ) : null}
                {featuredPlayer ? (
                  <LeaderboardPill tone="emerald">
                    <Sparkles className="h-3.5 w-3.5" />
                    {getCanonicalName(featuredPlayer.name)}
                  </LeaderboardPill>
                ) : null}
              </div>
            </div>
          </div>
        </LeaderboardToolbar>

        {featuredPlayer ? (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Pinned Player
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Your active selection stays highlighted here for quick return.
                </div>
              </div>
            </div>
            <PlayerCard
              player={featuredPlayer}
              rosterInfo={roster[featuredPlayer.slug]}
              pinned
            />
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Roster
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Grouped by last name so players can find their spot faster.
              </div>
            </div>
          </div>

          {rosterIndexLetters.length > 1 ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Browse By Last Initial
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rosterIndexLetters.map((letter) => (
                    <a
                      key={letter}
                      href={`#players-group-${letter}`}
                      className="flex h-8 min-w-8 items-center justify-center rounded-xl border border-transparent px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 transition-smooth hover:border-emerald-500/20 hover:bg-emerald-500/8 hover:text-emerald-200"
                    >
                      {letter}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <LeaderboardPanel className="overflow-hidden p-4 sm:p-5">
            {rosterPlayers.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
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
                      <PlayerCard
                        player={player}
                        rosterInfo={roster[player.slug]}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-40 items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
                <p className="text-sm text-zinc-500">
                  No players match this search yet.
                </p>
              </div>
            )}
          </LeaderboardPanel>
        </section>
      </div>
    </LeaderboardPageFrame>
  );
}
