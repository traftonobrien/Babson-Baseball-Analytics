"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  Target,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import { players, type Outing } from "@/lib/dataIndex";
import { seasonFromDateId } from "@/lib/season";
import { handBadgeClassesCompact } from "@/lib/handBadge";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { getCanonicalPlayerId } from "@/lib/canonicalPlayers";
import {
  Button,
  leaderboardFilterButtonBaseClassName,
  leaderboardFilterButtonGhostInactiveClassName,
  leaderboardFilterButtonOrangeActiveClassName,
} from "@/components/ui/neon-button";
import { useSmoothFilterTransition } from "@/app/components/leaderboards/useSmoothFilterTransition";
import {
  LeaderboardHero,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";

type ViewMode = "outings" | "players";

function parsePitchCount(label: string): number {
  const match = label.match(/\((\d+)\s+pitches?\)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseDateFromId(outingId: string): Date | null {
  const parts = outingId.split("/");
  if (parts.length < 2) return null;
  const segments = parts[1].split("_");
  if (segments.length < 3) return null;
  const [y, m, d] = segments.map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function outingSeason(outing: Outing): number | null {
  const dateId = outing.id.split("/")[1];
  return dateId ? seasonFromDateId(dateId) : null;
}

function HubSegment<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; display: string }[];
  selected: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        {label}
      </div>
      <div className="inline-flex flex-wrap gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="ghost"
            neon
            tone="orange"
            onClick={() => onChange(option.value)}
            className={`${leaderboardFilterButtonBaseClassName} min-w-[5rem] ${selected === option.value
              ? leaderboardFilterButtonOrangeActiveClassName
              : leaderboardFilterButtonGhostInactiveClassName
              }`}
          >
            {option.display}
          </Button>
        ))}
      </div>
    </div>
  );
}

function HeroActionCard({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: typeof Target;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-zinc-800/80 bg-zinc-950/75 p-3.5 transition-all duration-300 hover:border-orange-400/25 hover:bg-zinc-900/85"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-zinc-100">{title}</div>
          <div className="text-xs leading-5 text-zinc-500">{detail}</div>
        </div>
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-2 text-orange-300">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

function RowChevron() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-950/85">
      <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
    </span>
  );
}

export default function CommandPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("outings");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<string>("2026");
  const [search, setSearch] = useState("");
  const { slug: selectedSlug } = useSelectedPlayer();
  const selectedPlayerId = selectedSlug ? getCanonicalPlayerId(selectedSlug) : null;
  const { getRowTransitionProps, runWithTransition, transitionKey } = useSmoothFilterTransition();
  const searchQuery = search.trim().toLowerCase();

  const allSeasons = useMemo(() => {
    const values = new Set<number>();
    for (const player of players) {
      for (const outing of player.outings) {
        const year = outingSeason(outing);
        if (year) values.add(year);
      }
    }
    return Array.from(values).sort((a, b) => a - b);
  }, []);

  const filterOutings = useMemo(() => {
    return (outings: Outing[]) => {
      if (seasonFilter === "all") return outings;
      const year = Number(seasonFilter);
      return outings.filter((outing) => outingSeason(outing) === year);
    };
  }, [seasonFilter]);

  const stats = useMemo(() => {
    const filteredPlayers = players.filter((player) => filterOutings(player.outings).length > 0);
    const totalOutings = filteredPlayers.reduce(
      (sum, player) => sum + filterOutings(player.outings).length,
      0,
    );
    const totalPitches = filteredPlayers.reduce(
      (sum, player) =>
        sum + filterOutings(player.outings).reduce((total, outing) => total + parsePitchCount(outing.label), 0),
      0,
    );
    let mostRecentDate: Date | null = null;
    for (const player of filteredPlayers) {
      for (const outing of filterOutings(player.outings)) {
        const parsed = parseDateFromId(outing.id);
        if (parsed && (!mostRecentDate || parsed > mostRecentDate)) {
          mostRecentDate = parsed;
        }
      }
    }

    return {
      totalPlayers: filteredPlayers.length,
      totalOutings,
      totalPitches,
      mostRecentDate,
    };
  }, [filterOutings]);

  const outingRows = useMemo(() => {
    const rows: { player: (typeof players)[number]; outing: Outing; date: Date | null; pitchCount: number }[] = [];

    for (const player of players) {
      for (const outing of filterOutings(player.outings)) {
        rows.push({
          player,
          outing,
          date: parseDateFromId(outing.id),
          pitchCount: parsePitchCount(outing.label),
        });
      }
    }

    rows.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
    if (!searchQuery) return rows;
    return rows.filter((row) =>
      row.player.name.toLowerCase().includes(searchQuery) ||
      row.player.id.toLowerCase().includes(searchQuery),
    );
  }, [filterOutings, searchQuery]);

  const pitcherData = useMemo(() => {
    const data = players
      .map((player) => {
        const filtered = filterOutings(player.outings);
        const outings = [...filtered]
          .map((outing) => ({
            ...outing,
            date: parseDateFromId(outing.id),
          }))
          .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

        return {
          player,
          outings,
          totalPitches: filtered.reduce((sum, outing) => sum + parsePitchCount(outing.label), 0),
          latestDate: outings[0]?.date ?? null,
        };
      })
      .filter((entry) => entry.outings.length > 0)
      .sort((a, b) => (b.latestDate?.getTime() ?? 0) - (a.latestDate?.getTime() ?? 0));

    if (selectedPlayerId) {
      const selectedIndex = data.findIndex((entry) => entry.player.id === selectedPlayerId);
      if (selectedIndex > 0) {
        const [selected] = data.splice(selectedIndex, 1);
        data.unshift(selected);
      }
    }

    if (!searchQuery) return data;
    return data.filter((entry) =>
      entry.player.name.toLowerCase().includes(searchQuery) ||
      entry.player.id.toLowerCase().includes(searchQuery),
    );
  }, [filterOutings, searchQuery, selectedPlayerId]);

  const seasonLabel = seasonFilter === "all" ? "All seasons" : `${seasonFilter} season`;

  return (
    <LeaderboardPageFrame maxWidth="max-w-6xl">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Command Hub" }]} />

      <LeaderboardHero
        tone="orange"
        icon={Target}
        eyebrow="Command Tracking"
        title="Command Hub"
        description="Jump between live command days and each pitcher’s running history in the same command view."
        meta={
          <>
            <LeaderboardPill tone="orange">{seasonLabel}</LeaderboardPill>
            <LeaderboardPill>{stats.mostRecentDate ? `Latest ${formatDate(stats.mostRecentDate)}` : "No recent outing"}</LeaderboardPill>
          </>
        }
        side={
          <div className="grid gap-3">
            <HeroActionCard
              href="/command/leaderboard"
              icon={Target}
              title="Command Leaderboard"
              detail="Open the ranked board for command plus, on-target rate, and miss shape."
            />
            <HeroActionCard
              href="/command/faq"
              icon={BookOpen}
              title="Metrics Dictionary"
              detail="Keep the command grading language nearby while you move through outings."
            />
          </div>
        }
      />

      <LeaderboardToolbar>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-4">
            <HubSegment
              label="View"
              options={[
                { value: "outings", display: "Latest Outings" },
                { value: "players", display: "By Player" },
              ]}
              selected={viewMode}
              onChange={(value) =>
                runWithTransition(() => {
                  setViewMode(value);
                  setExpanded(null);
                })
              }
            />
            {allSeasons.length > 1 ? (
              <HubSegment
                label="Season"
                options={[
                  ...allSeasons.map((year) => ({ value: String(year), display: String(year) })),
                  { value: "all", display: "All" },
                ]}
                selected={seasonFilter}
                onChange={(value) =>
                  runWithTransition(() => {
                    setSeasonFilter(value);
                    setExpanded(null);
                  })
                }
              />
            ) : null}
          </div>

          <div className="w-full xl:max-w-sm">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Search
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setExpanded(null);
                }}
                placeholder="Player or player ID"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all duration-300 focus:border-orange-400/35"
              />
            </div>
          </div>
        </div>
      </LeaderboardToolbar>

      <LeaderboardPanel className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-800/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              {viewMode === "outings" ? "Command Outings" : "Pitcher History"}
            </div>
          <div className="mt-1 text-sm text-zinc-400">
            {viewMode === "outings"
              ? "Ordered by most recent. Open any day to jump straight into that report."
              : "One expandable row per pitcher, with the latest outing first."}
          </div>
          </div>
          <LeaderboardPill tone={viewMode === "outings" ? "orange" : "neutral"} className="self-start sm:self-auto">
            {viewMode === "outings" ? "Daily Reports" : "Grouped View"}
          </LeaderboardPill>
        </div>

        <div
          key={`${viewMode}-${seasonFilter}-${transitionKey}`}
          className="p-4 sm:p-5"
        >
          {viewMode === "outings" ? (
            outingRows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-800 px-6 py-12 text-center text-sm text-zinc-500">
                No command outings for this season.
              </div>
            ) : (
              <div className="space-y-2.5">
                {outingRows.map((row, index) => {
                  const isMe = row.player.id === selectedPlayerId;
                  const rowTransition = getRowTransitionProps(index);

                  return (
                    <Link
                      key={row.outing.id}
                      href={`/player/${row.player.id}?outingId=${row.outing.id}&from=command`}
                      className={`flex flex-col gap-3 rounded-[1.35rem] border px-4 py-3 transition-all duration-300 hover:bg-zinc-900/80 sm:flex-row sm:items-center sm:justify-between ${isMe
                        ? "border-emerald-500/35 bg-zinc-900/85"
                        : "border-zinc-800/80 bg-zinc-950/75 hover:border-orange-400/20"
                        } ${rowTransition.className}`}
                      style={rowTransition.style}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:gap-3">
                        <span className="inline-flex min-w-[7.5rem] items-center rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                          {row.date ? formatDate(row.date) : "Unknown"}
                        </span>
                        <span className="truncate text-sm font-semibold text-zinc-100">
                          {row.player.name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(
                            row.player.throws === "L" ? "L" : "R",
                          )}`}
                        >
                          {row.player.throws === "L" ? "LHP" : "RHP"}
                        </span>
                        {isMe ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider rounded-md border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                            You
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <span className="text-xs font-mono text-zinc-500">
                          {row.pitchCount} pitches
                        </span>
                        <RowChevron />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )
          ) : pitcherData.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-800 px-6 py-12 text-center text-sm text-zinc-500">
              No pitchers for this season.
            </div>
          ) : (
            <div className="space-y-3">
              {pitcherData.map((item, index) => {
                const isExpanded = expanded === item.player.id;
                const isMe = item.player.id === selectedPlayerId;
                const rowTransition = getRowTransitionProps(index);

                return (
                  <div
                    key={item.player.id}
                    className={`overflow-hidden rounded-[1.45rem] border ${isMe
                      ? "border-emerald-500/35 bg-zinc-900/85"
                      : "border-zinc-800/80 bg-zinc-950/75"
                      } ${rowTransition.className}`}
                    style={rowTransition.style}
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : item.player.id)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-all duration-300 hover:bg-zinc-900/80"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                          <span className="truncate text-sm font-semibold text-zinc-100">
                            {item.player.name}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(
                              item.player.throws === "L" ? "L" : "R",
                            )}`}
                          >
                            {item.player.throws === "L" ? "LHP" : "RHP"}
                          </span>
                          {isMe ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wider rounded-md border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                              You
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span>{item.outings.length} outing{item.outings.length !== 1 ? "s" : ""}</span>
                          <span className="text-zinc-700">•</span>
                          <span className="font-mono">{item.totalPitches} pitches</span>
                          {item.latestDate ? (
                            <>
                              <span className="text-zinc-700">•</span>
                              <span>Latest {formatDate(item.latestDate)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80">
                        <ChevronDown
                          className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""
                            }`}
                        />
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-zinc-800/70 bg-zinc-950/55 px-3 pb-3 pt-2.5">
                        <div className="space-y-1.5">
                          {item.outings.map((outing) => (
                            <Link
                              key={outing.id}
                              href={`/player/${item.player.id}?outingId=${outing.id}&from=command`}
                              className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800/70 bg-zinc-950/70 px-3.5 py-2.5 text-sm transition-all duration-300 hover:border-orange-400/20 hover:bg-zinc-900/80"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="text-zinc-200">
                                  {outing.date ? formatDate(outing.date) : outing.label}
                                </span>
                                <span className="text-xs font-mono text-zinc-500">
                                  {parsePitchCount(outing.label)} pitches
                                </span>
                              </div>
                              <RowChevron />
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </LeaderboardPanel>
    </LeaderboardPageFrame>
  );
}
