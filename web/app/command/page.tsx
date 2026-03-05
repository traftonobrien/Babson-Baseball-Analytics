"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Target,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import { players, type Outing } from "@/lib/dataIndex";
import { seasonFromDateId } from "@/lib/season";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { getCanonicalPlayerId } from "@/lib/canonicalPlayers";
import { getTeamAccentColor, getTeamBrandEntry, hexToRgba } from "@/lib/teamBranding";
import {
  Button,
  leaderboardFilterButtonBaseClassName,
  leaderboardFilterButtonGhostInactiveClassName,
  leaderboardFilterButtonOrangeActiveClassName,
} from "@/components/ui/neon-button";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { useSmoothFilterTransition } from "@/app/components/leaderboards/useSmoothFilterTransition";
import {
  LeaderboardHero,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";

type ViewMode = "outings" | "players";
type SeriesOption = {
  value: string;
  label: string;
  accent: string;
};

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

function formatCompactDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function stripTeamRanking(value: string): string {
  return value.replace(/^#\d+(?:\/\d+)?\s*/, "").trim();
}

function seriesKeyForOpponent(opponent?: string | null): string | null {
  if (!opponent) return null;
  const brand = getTeamBrandEntry(opponent);
  return brand?.name ?? stripTeamRanking(opponent);
}

function outingSeason(outing: Outing): number | null {
  const dateId = outing.id.split("/")[1];
  return dateId ? seasonFromDateId(dateId) : null;
}

function OutingContextPill({
  date,
  opponent,
}: {
  date: Date | null;
  opponent?: string | null;
}) {
  const accent = opponent ? getTeamAccentColor(opponent) : null;
  const brand = opponent ? getTeamBrandEntry(opponent) : null;
  const opponentLabel = opponent ? brand?.name ?? stripTeamRanking(opponent) : null;
  const label = date ? formatCompactDate(date) : "Unknown";
  const text = opponentLabel ? `${label} - ${opponentLabel}` : label;

  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      style={
        accent
          ? {
              borderColor: hexToRgba(accent, 0.28),
              background: `linear-gradient(135deg, ${hexToRgba(accent, 0.16)}, rgba(9,9,11,0.84))`,
              boxShadow: `0 0 16px ${hexToRgba(accent, 0.08)}`,
            }
          : undefined
      }
    >
      {text}
    </span>
  );
}

function PlayerNamePill({ name }: { name: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center rounded-full border border-zinc-700/80 bg-[linear-gradient(135deg,rgba(39,39,42,0.72),rgba(9,9,11,0.88))] px-3 py-1 text-xs font-semibold tracking-[0.01em] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <span className="truncate">{name}</span>
    </span>
  );
}

function SeriesDropdown({
  options,
  selected,
  onChange,
  className,
}: {
  options: SeriesOption[];
  selected: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [renderMenu, setRenderMenu] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuOptions: SeriesOption[] = useMemo(
    () => [{ value: "all", label: "All opponents", accent: "#f97316" }, ...options],
    [options],
  );

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    const timers: number[] = [];
    let frame = 0;

    if (open) {
      const kickoff = window.setTimeout(() => {
        setRenderMenu(true);
        setMenuVisible(false);
        setRevealedCount(0);

        frame = window.requestAnimationFrame(() => {
          setMenuVisible(true);
          menuOptions.forEach((_, index) => {
            const timer = window.setTimeout(() => {
              setRevealedCount((current) => Math.max(current, index + 1));
            }, 55 + index * 28);
            timers.push(timer);
          });
        });
      }, 0);

      return () => {
        window.clearTimeout(kickoff);
        if (frame) {
          window.cancelAnimationFrame(frame);
        }
        timers.forEach((timer) => window.clearTimeout(timer));
      };
    }

    const reset = window.setTimeout(() => {
      setMenuVisible(false);
      setRevealedCount(0);
    }, 0);
    const timeout = window.setTimeout(() => setRenderMenu(false), 180);
    return () => {
      window.clearTimeout(reset);
      window.clearTimeout(timeout);
    };
  }, [open, menuOptions]);

  useEffect(() => {
    if (!renderMenu) return;

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [renderMenu]);

  const selectedOption = options.find((option) => option.value === selected);

  const menu =
    renderMenu && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            className={`fixed z-[120] origin-top overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950 shadow-[0_18px_40px_rgba(0,0,0,0.5)] transition-all duration-220 ease-out ${
              menuVisible
                ? "pointer-events-auto translate-y-0 scale-y-100 opacity-100"
                : "pointer-events-none -translate-y-1 scale-y-95 opacity-0"
            }`}
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              maxHeight: menuVisible ? "20rem" : "0rem",
              padding: menuVisible ? "0.625rem" : "0 0.625rem",
            }}
          >
            <div className="space-y-1.5">
              {menuOptions.map((option, index) => {
                const isSelected = selected === option.value;
                const isDefault = option.value === "all";
                const isRevealed = menuVisible && index < revealedCount;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-full border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.16em] transition-all duration-200 ease-out ${
                      isSelected
                        ? "text-zinc-100"
                        : "text-zinc-300 hover:translate-x-0.5 hover:text-zinc-100"
                    }`}
                    style={{
                      borderColor: isSelected ? hexToRgba(option.accent, 0.36) : "rgba(39,39,42,0.8)",
                      background: isSelected
                        ? `linear-gradient(135deg, ${hexToRgba(option.accent, 0.18)}, rgba(9,9,11,0.88))`
                        : `linear-gradient(135deg, ${hexToRgba(option.accent, isDefault ? 0.1 : 0.08)}, rgba(9,9,11,0.9))`,
                      boxShadow: isSelected ? `0 0 14px ${hexToRgba(option.accent, 0.08)}` : undefined,
                      opacity: isRevealed ? 1 : 0,
                      transform: isRevealed ? "translateY(0)" : "translateY(-10px)",
                      transitionDuration: "260ms",
                      transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  >
                    {!isDefault ? (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: option.accent,
                          boxShadow: `0 0 10px ${hexToRgba(option.accent, 0.35)}`,
                        }}
                      />
                    ) : null}
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`w-full min-w-0 space-y-2 ${className ?? ""}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        Opponent
      </div>
      <div className="inline-flex w-full rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
        <Button
          ref={triggerRef}
          type="button"
          size="sm"
          variant="ghost"
          neon
          tone="orange"
          onClick={() => setOpen((current) => !current)}
          className={`${leaderboardFilterButtonBaseClassName} ${leaderboardFilterButtonOrangeActiveClassName} flex w-full min-w-0 items-center justify-between gap-2.5 text-left`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {selectedOption ? (
              <>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: selectedOption.accent,
                    boxShadow: `0 0 10px ${hexToRgba(selectedOption.accent, 0.35)}`,
                  }}
                />
                <span className="truncate text-sm font-semibold text-zinc-100">
                  {selectedOption.label}
                </span>
              </>
            ) : (
              <span className="text-sm font-semibold text-zinc-100">All opponents</span>
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </div>
      {menu}
    </div>
  );
}

function HubSegment<T extends string>({
  label,
  options,
  selected,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; display: string }[];
  selected: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
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
      className="group relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/75 p-3.5 transition-all duration-300 hover:border-orange-400/25 hover:bg-zinc-900/85"
    >
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
  const [seriesFilter, setSeriesFilter] = useState<string>("all");
  const { slug: selectedSlug } = useSelectedPlayer();
  const selectedPlayerId = selectedSlug ? getCanonicalPlayerId(selectedSlug) : null;
  const { getRowTransitionProps, runWithTransition, transitionKey } = useSmoothFilterTransition(450);

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

  const filterOutingsBySeason = useMemo(() => {
    return (outings: Outing[]) => {
      if (seasonFilter === "all") return outings;
      const year = Number(seasonFilter);
      return outings.filter((outing) => outingSeason(outing) === year);
    };
  }, [seasonFilter]);

  const availableSeries = useMemo(() => {
    const bySeries = new Map<string, SeriesOption>();

    for (const player of players) {
      for (const outing of filterOutingsBySeason(player.outings)) {
        const key = seriesKeyForOpponent(outing.opponent);
        if (!key || bySeries.has(key)) continue;

        bySeries.set(key, {
          value: key,
          label: key,
          accent: getTeamAccentColor(outing.opponent ?? key),
        });
      }
    }

    return Array.from(bySeries.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filterOutingsBySeason]);

  const resolvedSeriesFilter =
    seriesFilter === "all" || availableSeries.some((option) => option.value === seriesFilter)
      ? seriesFilter
      : "all";

  const filterOutings = useMemo(() => {
    return (outings: Outing[]) => {
      const seasonFiltered = filterOutingsBySeason(outings);
      if (resolvedSeriesFilter === "all") return seasonFiltered;

      return seasonFiltered.filter(
        (outing) => seriesKeyForOpponent(outing.opponent) === resolvedSeriesFilter,
      );
    };
  }, [filterOutingsBySeason, resolvedSeriesFilter]);

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
    return rows;
  }, [filterOutings]);

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

    return data;
  }, [filterOutings, selectedPlayerId]);

  const seasonLabel = seasonFilter === "all" ? "All seasons" : `${seasonFilter} season`;

  return (
    <LeaderboardPageFrame maxWidth="max-w-6xl">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Command Hub" }]} />

      <LeaderboardHero
        tone="orange"
        icon={Target}
        eyebrow="Command Tracking"
        title="Command Hub"
        description="Move between recent outings and each pitcher’s running command history."
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
              detail="Open the ranked board for Command+, on-target rate, and miss shape."
            />
            <HeroActionCard
              href="/command/faq"
              icon={BookOpen}
              title="Metrics Dictionary"
              detail="Keep the command definitions close while you work through outings."
            />
          </div>
        }
      />

      <LeaderboardToolbar className="relative z-30 overflow-visible">
        <div className="flex flex-col gap-4 md:flex-row md:flex-nowrap md:items-end">
          <HubSegment
            label="View"
            className="w-full min-w-0 md:w-[18rem] md:flex-none"
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
              className="w-full min-w-0 md:ml-4 md:w-[22rem] md:flex-none"
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
          {availableSeries.length > 0 ? (
            <SeriesDropdown
              className="w-full min-w-0 md:ml-4 md:flex-1"
              options={availableSeries}
              selected={resolvedSeriesFilter}
              onChange={(value) =>
                runWithTransition(() => {
                  setSeriesFilter(value);
                  setExpanded(null);
                })
              }
            />
          ) : null}
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
              ? "Ordered by most recent. Open any day to view that outing."
              : "One expandable row per pitcher, with the latest outing at the top."}
          </div>
          </div>
          <LeaderboardPill tone={viewMode === "outings" ? "orange" : "neutral"} className="self-start sm:self-auto">
            {viewMode === "outings" ? "Daily Reports" : "Grouped View"}
          </LeaderboardPill>
        </div>

        <div
          key={`${viewMode}-${seasonFilter}-${resolvedSeriesFilter}-${transitionKey}`}
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
                        <OutingContextPill date={row.date} opponent={row.outing.opponent} />
                        <PlayerNamePill name={row.player.name} />
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
                          <PlayerNamePill name={item.player.name} />
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
                                <OutingContextPill date={outing.date} opponent={outing.opponent} />
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
