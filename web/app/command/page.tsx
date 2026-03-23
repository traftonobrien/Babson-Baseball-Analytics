"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Target,
  Trophy,
} from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { players, type Outing } from "@/lib/dataIndex";
import { seasonFromDateId } from "@/lib/season";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { getCanonicalPlayerId } from "@/lib/canonicalPlayers";
import { getTeamAccentColor, getTeamBrandEntry, hexToRgba } from "@/lib/teamBranding";
import { TEAM_THEME } from "@/lib/teamConfig";
import { useSmoothFilterTransition } from "@/app/components/leaderboards/useSmoothFilterTransition";
import { HubActionCard } from "@/app/components/hub/HubHeader";

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

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

function LightPill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "amber";
  className?: string;
}) {
  const toneClassName = {
    neutral: "border-[#E2E8F0] bg-background text-slate-500 dark:text-zinc-400",
    brand:
      "border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-subtle-text)]",
    success: "border-[#D1FAE5] bg-[#ECFDF5] text-[#10B981]",
    amber: "border-[#FED7AA] bg-[#FFF7ED] text-[#EA580C]",
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClassName} ${className}`}
    >
      {children}
    </span>
  );
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
  const text = opponentLabel ? `${label} • ${opponentLabel}` : label;

  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#475569]"
      style={
        accent
          ? {
              borderColor: hexToRgba(accent, 0.24),
              background: `linear-gradient(135deg, ${hexToRgba(accent, 0.08)}, rgba(248,250,252,0.96))`,
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
    <span className="inline-flex min-w-0 max-w-full items-center rounded-full border border-[#E2E8F0] bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-900 dark:text-zinc-50 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
      <span className="truncate">{name}</span>
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">
            {eyebrow}
          </div>
          <h2 className={`${plusJakarta.className} mt-2 text-[1.55rem] font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[1.8rem]`}>
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
        {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
      </div>
    </div>
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
    () => [{ value: "all", label: "All opponents", accent: TEAM_THEME.primary }, ...options],
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
            }, 45 + index * 24);
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

  const selectedOption = menuOptions.find((option) => option.value === selected);

  const menu =
    renderMenu && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            className={`fixed z-[120] origin-top overflow-hidden rounded-[1.5rem] border border-[#E2E8F0] bg-surface shadow-[0_20px_50px_rgba(15,23,42,0.12)] transition-all duration-220 ease-out ${
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
                      isSelected ? "text-slate-900 dark:text-zinc-50" : "text-[#475569] hover:translate-x-0.5 hover:text-slate-900 dark:hover:text-zinc-50"
                    }`}
                    style={{
                      borderColor: isSelected ? hexToRgba(option.accent, 0.3) : "rgba(226,232,240,0.9)",
                      background: isSelected
                        ? `linear-gradient(135deg, ${hexToRgba(option.accent, 0.12)}, rgba(255,255,255,0.96))`
                        : `linear-gradient(135deg, ${hexToRgba(option.accent, isDefault ? 0.08 : 0.06)}, rgba(248,250,252,0.96))`,
                      boxShadow: isSelected ? `0 0 0 1px ${hexToRgba(option.accent, 0.05)}` : undefined,
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
                          boxShadow: `0 0 10px ${hexToRgba(option.accent, 0.32)}`,
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#94A3B8]">
        Opponent
      </div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 min-h-[2.75rem] w-full min-w-0 items-center justify-between gap-2.5 rounded-2xl border border-[#E2E8F0] bg-background px-4 py-0 text-left shadow-[0_10px_24px_rgba(15,23,42,0.03)] transition-all duration-200 hover:border-[var(--brand-primary-border)] hover:bg-surface"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selectedOption ? (
            <>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: selectedOption.accent,
                  boxShadow: `0 0 10px ${hexToRgba(selectedOption.accent, 0.32)}`,
                }}
              />
              <span className={`${plusJakarta.className} truncate text-sm font-semibold text-slate-900 dark:text-zinc-50`}>
                {selectedOption.label}
              </span>
            </>
          ) : (
            <span className={`${plusJakarta.className} text-sm font-semibold text-slate-900 dark:text-zinc-50`}>
              All opponents
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#94A3B8] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#94A3B8]">
        {label}
      </div>
      <div className="flex h-11 min-h-[2.75rem] flex-nowrap items-center gap-1 rounded-2xl border border-[#E2E8F0] bg-background p-1 shadow-[0_10px_24px_rgba(15,23,42,0.03)]">
        {options.map((option) => {
          const isActive = selected === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`inline-flex h-9 min-h-0 min-w-0 flex-1 basis-0 items-center justify-center rounded-full px-2 text-sm font-semibold transition-all duration-200 sm:px-3 ${
                isActive
                  ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary-subtle-text)] shadow-[0_1px_0_rgba(var(--brand-primary-rgb),0.18)]"
                  : "text-slate-500 dark:text-zinc-400 hover:bg-surface hover:text-slate-900 dark:hover:text-zinc-50"
              }`}
            >
              <span className="truncate">{option.display}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RowChevron() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-background">
      <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8]" />
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

  return (
    <main className={`min-h-screen bg-background text-slate-900 dark:text-zinc-50 ${plusJakarta.className}`}>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-6 sm:p-7">
            <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-primary-subtle-text)]">
                  <Target className="h-3.5 w-3.5" aria-hidden />
                  Command
                </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[2.85rem] sm:leading-[1.02]">
                Command Hub
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Browse command outings, filter by season and opponent, and open the full outing report from any row.
                Use the leaderboard and dictionary for definitions and rankings.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:max-w-[46rem] sm:shrink-0">
              <HubActionCard
                href="/command/faq"
                icon={BookOpen}
                sectionTitle="Dictionary"
                buttonLabel="Metrics glossary"
              />
              <HubActionCard
                href="/command/leaderboard"
                icon={Trophy}
                sectionTitle="Leaderboards"
                buttonLabel="Open rankings"
              />
            </div>
          </div>
        </header>

        <section
          className={
            selectedPlayerId
              ? "grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.78fr)]"
              : "grid gap-6"
          }
        >
          <div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
            <SectionHeader
              eyebrow={viewMode === "outings" ? "Command Outings" : "Pitcher History"}
              title={viewMode === "outings" ? "Recent outing feed" : "Grouped pitcher history"}
              description={
                viewMode === "outings"
                  ? "Ordered by most recent. Open any day to jump to the underlying outing view."
                  : "One expandable row per pitcher, with the latest outing at the top."
              }
              meta={
                <>
                  <LightPill tone={viewMode === "outings" ? "brand" : "neutral"}>
                    {viewMode === "outings" ? "Daily reports" : "Grouped view"}
                  </LightPill>
                  <LightPill tone="neutral">{outingRows.length} outings</LightPill>
                </>
              }
            />

            <div className="grid gap-4 border-b border-slate-100 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(14rem,17rem)_minmax(14rem,17rem)_minmax(0,1fr)]">
              <HubSegment
                label="View"
                className="w-full min-w-0"
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
                  className="w-full min-w-0"
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
                  className="w-full min-w-0"
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

            <div key={`${viewMode}-${seasonFilter}-${resolvedSeriesFilter}-${transitionKey}`} className="p-4 sm:p-5">
              {viewMode === "outings" ? (
                outingRows.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-background px-6 py-12 text-center text-sm text-slate-600">
                    No command outings for this season.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {outingRows.map((row, index) => {
                      const isSelected = row.player.id === selectedPlayerId;
                      const rowTransition = getRowTransitionProps(index);

                      return (
                        <Link
                          key={row.outing.id}
                          href={`/player/${row.player.id}?outingId=${row.outing.id}&from=command`}
                          className={`flex flex-col gap-3 rounded-[1.35rem] border px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between ${
                            isSelected
                              ? "border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)]"
                              : "border-[#E2E8F0] bg-surface hover:border-[#CBD5E1]"
                          } ${rowTransition.className}`}
                          style={rowTransition.style}
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:gap-3">
                            <OutingContextPill date={row.date} opponent={row.outing.opponent} />
                            <PlayerNamePill name={row.player.name} />
                            {isSelected ? (
                              <span className="rounded-md border border-[var(--brand-primary-border)] bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary-subtle-text)]">
                                Focused
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between gap-4 sm:justify-end">
                            <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-zinc-400">
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
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-background px-6 py-12 text-center text-sm text-slate-600">
                  No pitchers for this season.
                </div>
              ) : (
                <div className="space-y-3">
                  {pitcherData.map((item, index) => {
                    const isExpanded = expanded === item.player.id;
                    const isSelected = item.player.id === selectedPlayerId;
                    const rowTransition = getRowTransitionProps(index);

                    return (
                      <div
                        key={item.player.id}
                        className={`overflow-hidden rounded-[1.45rem] border ${
                          isSelected
                            ? "border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)]"
                            : "border-[#E2E8F0] bg-surface"
                        } ${rowTransition.className}`}
                        style={rowTransition.style}
                      >
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : item.player.id)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-all duration-300 hover:bg-background"
                        >
                          <div className="min-w-0 space-y-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                              <PlayerNamePill name={item.player.name} />
                              {isSelected ? (
                                <span className="rounded-md border border-[var(--brand-primary-border)] bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary-subtle-text)]">
                                  Focused
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                              <span>
                                {item.outings.length} outing{item.outings.length !== 1 ? "s" : ""}
                              </span>
                              <span className="text-[#CBD5E1]">•</span>
                              <span className="font-medium tabular-nums">{item.totalPitches} pitches</span>
                              {item.latestDate ? (
                                <>
                                  <span className="text-[#CBD5E1]">•</span>
                                  <span>Latest {formatDate(item.latestDate)}</span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-background">
                            <ChevronDown
                              className={`h-4 w-4 text-[#94A3B8] transition-transform duration-300 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </button>

                        {isExpanded ? (
                          <div className="border-t border-slate-100 bg-background px-3 pb-3 pt-2.5">
                            <div className="space-y-1.5">
                              {item.outings.map((outing) => (
                                <Link
                                  key={outing.id}
                                  href={`/player/${item.player.id}?outingId=${outing.id}&from=command`}
                                  className="flex items-center justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-surface px-3.5 py-2.5 text-sm transition-all duration-300 hover:border-[var(--brand-primary-border)] hover:bg-background"
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <OutingContextPill date={outing.date} opponent={outing.opponent} />
                                    <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-zinc-400">
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
          </div>

          {selectedPlayerId ? (
            <aside className="space-y-6">
              <div className="rounded-[28px] border border-border bg-surface p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Focused row
                </div>
                <h3 className={`${plusJakarta.className} mt-2 text-[1.2rem] font-bold tracking-tight text-slate-900 dark:text-zinc-50`}>
                  Selected player pinned
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-zinc-400">
                  The selected pitcher stays at the top of the grouped history view so you can compare recent outings without losing context.
                </p>
              </div>
            </aside>
          ) : null}
        </section>
      </div>
    </main>
  );
}
