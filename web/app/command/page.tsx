"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { type ComponentType, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  LineChart,
  Target,
} from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { players, type Outing } from "@/lib/dataIndex";
import { seasonFromDateId } from "@/lib/season";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { getCanonicalPlayerId } from "@/lib/canonicalPlayers";
import { getTeamAccentColor, getTeamBrandEntry, hexToRgba } from "@/lib/teamBranding";
import { useSmoothFilterTransition } from "@/app/components/leaderboards/useSmoothFilterTransition";

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

type ViewMode = "outings" | "players";
type SeriesOption = {
  value: string;
  label: string;
  accent: string;
};

const METRIC_BARS = {
  players: [0.24, 0.34, 0.26, 0.38, 0.46, 0.41, 0.52],
  outings: [0.18, 0.24, 0.3, 0.35, 0.42, 0.48, 0.56],
  pitches: [0.2, 0.28, 0.33, 0.39, 0.45, 0.5, 0.62],
  latest: [0.14, 0.22, 0.28, 0.31, 0.37, 0.43, 0.55],
} as const;

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
    neutral: "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]",
    brand: "border-[#E0E7FF] bg-[#EEF2FF] text-[#6366F1]",
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
    <span className="inline-flex min-w-0 max-w-full items-center rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0F172A] shadow-[0_1px_0_rgba(15,23,42,0.02)]">
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
    <div className="flex flex-col gap-4 border-b border-[#EEF2F7] px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">
            {eyebrow}
          </div>
          <h2 className={`${plusJakarta.className} mt-2 text-[1.55rem] font-black tracking-tight text-[#0F172A] sm:text-[1.8rem]`}>
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#64748B]">
            {description}
          </p>
        </div>
        {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  spark,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  spark: readonly number[];
  accent: "brand" | "emerald" | "sky" | "amber";
}) {
  const accentStyles = {
    brand: {
      chip: "bg-[#EEF2FF] text-[#6366F1]",
      bar: "#A5B4FC",
    },
    emerald: {
      chip: "bg-[#ECFDF5] text-[#10B981]",
      bar: "#6EE7B7",
    },
    sky: {
      chip: "bg-[#EFF6FF] text-[#0EA5E9]",
      bar: "#7DD3FC",
    },
    amber: {
      chip: "bg-[#FFF7ED] text-[#EA580C]",
      bar: "#FDBA74",
    },
  }[accent];

  return (
    <div className="rounded-[1.5rem] border border-[#E2E8F0] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#94A3B8]">
            {label}
          </div>
          <div className={`${plusJakarta.className} mt-2 text-[1.9rem] font-black tracking-tight text-[#0F172A]`}>
            {value}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${accentStyles.chip}`}>
          Live
        </span>
      </div>
      <div className="mt-4 flex h-10 items-end gap-1.5">
        {spark.map((height, index) => (
          <span
            key={`${label}-${index}`}
            className="flex-1 rounded-full"
            style={{
              height: `${Math.max(16, Math.round(height * 100))}%`,
              backgroundColor: accentStyles.bar,
            }}
          />
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-[#64748B]">{detail}</p>
    </div>
  );
}

function QuickActionCard({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-4 rounded-[1.5rem] border border-[#E2E8F0] bg-[#F8FAFC] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#C7D2FE] hover:bg-white hover:shadow-[0_18px_36px_rgba(15,23,42,0.05)]"
    >
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#94A3B8]">
          Quick link
        </div>
        <div className="mt-2 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white text-[#6366F1]">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className={`${plusJakarta.className} text-[15px] font-bold tracking-tight text-[#0F172A]`}>
              {title}
            </div>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">{detail}</p>
          </div>
        </div>
      </div>
      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#6366F1]" />
    </Link>
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
    () => [{ value: "all", label: "All opponents", accent: "#6366F1" }, ...options],
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
            className={`fixed z-[120] origin-top overflow-hidden rounded-[1.5rem] border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)] transition-all duration-220 ease-out ${
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
                      isSelected ? "text-[#0F172A]" : "text-[#475569] hover:translate-x-0.5 hover:text-[#0F172A]"
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
        className="flex w-full min-w-0 items-center justify-between gap-2.5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.03)] transition-all duration-200 hover:border-[#C7D2FE] hover:bg-white"
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
              <span className={`${plusJakarta.className} truncate text-sm font-semibold text-[#0F172A]`}>
                {selectedOption.label}
              </span>
            </>
          ) : (
            <span className={`${plusJakarta.className} text-sm font-semibold text-[#0F172A]`}>
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
      <div className="inline-flex flex-wrap gap-1.5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.03)]">
        {options.map((option) => {
          const isActive = selected === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`min-w-[5.25rem] rounded-full px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-[#EEF2FF] text-[#6366F1] shadow-[0_1px_0_rgba(99,102,241,0.06)]"
                  : "text-[#64748B] hover:bg-white hover:text-[#0F172A]"
              }`}
            >
              {option.display}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RowChevron() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
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
    <main className={`min-h-screen bg-[#F8FAFC] text-[#0F172A] ${plusJakarta.className}`}>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-[#E2E8F0] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="relative overflow-hidden px-5 py-5 sm:px-7 sm:py-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(99,102,241,0.08),transparent_26%),radial-gradient(circle_at_82%_24%,rgba(16,185,129,0.05),transparent_22%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.78fr)]">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6366F1]">
                  <Target className="h-3.5 w-3.5" />
                  Command Tracking
                </div>
                <h1 className={`${plusJakarta.className} mt-4 text-[2rem] font-black tracking-tight text-[#0F172A] sm:text-[2.6rem] sm:leading-[1.02]`}>
                  Command Hub
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#64748B] sm:text-[14px]">
                  Move between recent outings and each pitcher’s running command history without losing your current filters.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <LightPill tone="brand">{seasonLabel}</LightPill>
                  <LightPill>{stats.mostRecentDate ? `Latest ${formatDate(stats.mostRecentDate)}` : "No recent outing"}</LightPill>
                  <LightPill tone="success">{stats.totalPlayers} pitchers in view</LightPill>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <QuickActionCard
                  href="/command/leaderboard"
                  icon={LineChart}
                  title="Command Leaderboard"
                  detail="Open the ranked board for on-target rate, miss shape, and consistency."
                />
                <QuickActionCard
                  href="/command/faq"
                  icon={BookOpen}
                  title="Metrics Dictionary"
                  detail="Keep the command definitions close while you work through outings."
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-[#EEF2F7] px-5 py-5 sm:px-7 md:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Pitchers in View"
              value={String(stats.totalPlayers)}
              detail="Pitchers with at least one outing in the current filter window."
              spark={METRIC_BARS.players}
              accent="brand"
            />
            <MetricTile
              label="Command Outings"
              value={String(stats.totalOutings)}
              detail="Filtered outing rows available in the workspace."
              spark={METRIC_BARS.outings}
              accent="emerald"
            />
            <MetricTile
              label="Pitches Logged"
              value={String(stats.totalPitches)}
              detail="Pitch counts pulled from the current season and opponent filters."
              spark={METRIC_BARS.pitches}
              accent="sky"
            />
            <MetricTile
              label="Latest Outing"
              value={stats.mostRecentDate ? formatCompactDate(stats.mostRecentDate) : "—"}
              detail="Most recent day represented in the current command snapshot."
              spark={METRIC_BARS.latest}
              accent="amber"
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.78fr)]">
          <div className="overflow-hidden rounded-[28px] border border-[#E2E8F0] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
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

            <div className="grid gap-4 border-b border-[#EEF2F7] px-5 py-5 sm:px-6 lg:grid-cols-[minmax(14rem,17rem)_minmax(14rem,17rem)_minmax(0,1fr)]">
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
                  <div className="rounded-[1.5rem] border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-6 py-12 text-center text-sm text-[#64748B]">
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
                              ? "border-[#C7D2FE] bg-[#EEF2FF]"
                              : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"
                          } ${rowTransition.className}`}
                          style={rowTransition.style}
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:gap-3">
                            <OutingContextPill date={row.date} opponent={row.outing.opponent} />
                            <PlayerNamePill name={row.player.name} />
                            {isSelected ? (
                              <span className="rounded-md border border-[#C7D2FE] bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6366F1]">
                                Focused
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between gap-4 sm:justify-end">
                            <span className="text-xs font-medium tabular-nums text-[#64748B]">
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
                <div className="rounded-[1.5rem] border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-6 py-12 text-center text-sm text-[#64748B]">
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
                            ? "border-[#C7D2FE] bg-[#EEF2FF]"
                            : "border-[#E2E8F0] bg-white"
                        } ${rowTransition.className}`}
                        style={rowTransition.style}
                      >
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : item.player.id)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-all duration-300 hover:bg-[#F8FAFC]"
                        >
                          <div className="min-w-0 space-y-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                              <PlayerNamePill name={item.player.name} />
                              {isSelected ? (
                                <span className="rounded-md border border-[#C7D2FE] bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6366F1]">
                                  Focused
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
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

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
                            <ChevronDown
                              className={`h-4 w-4 text-[#94A3B8] transition-transform duration-300 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </button>

                        {isExpanded ? (
                          <div className="border-t border-[#EEF2F7] bg-[#FBFDFF] px-3 pb-3 pt-2.5">
                            <div className="space-y-1.5">
                              {item.outings.map((outing) => (
                                <Link
                                  key={outing.id}
                                  href={`/player/${item.player.id}?outingId=${outing.id}&from=command`}
                                  className="flex items-center justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-sm transition-all duration-300 hover:border-[#C7D2FE] hover:bg-[#F8FAFC]"
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <OutingContextPill date={outing.date} opponent={outing.opponent} />
                                    <span className="text-xs font-medium tabular-nums text-[#64748B]">
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

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">
                Filter state
              </div>
              <h3 className={`${plusJakarta.className} mt-2 text-[1.2rem] font-bold tracking-tight text-[#0F172A]`}>
                Current command window
              </h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F8FAFC] px-4 py-3">
                  <span className="text-sm text-[#64748B]">View mode</span>
                  <span className="text-sm font-semibold text-[#0F172A]">
                    {viewMode === "outings" ? "Latest outings" : "By player"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F8FAFC] px-4 py-3">
                  <span className="text-sm text-[#64748B]">Season</span>
                  <span className="text-sm font-semibold text-[#0F172A]">{seasonLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F8FAFC] px-4 py-3">
                  <span className="text-sm text-[#64748B]">Opponent</span>
                  <span className="text-sm font-semibold text-[#0F172A]">
                    {resolvedSeriesFilter === "all" ? "All opponents" : resolvedSeriesFilter}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F8FAFC] px-4 py-3">
                  <span className="text-sm text-[#64748B]">Focused pitcher</span>
                  <span className="text-sm font-semibold text-[#0F172A]">
                    {selectedPlayerId ? "Pinned to top" : "None selected"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">
                Shortcuts
              </div>
              <h3 className={`${plusJakarta.className} mt-2 text-[1.2rem] font-bold tracking-tight text-[#0F172A]`}>
                Open command references
              </h3>
              <div className="mt-4 space-y-3">
                <QuickActionCard
                  href="/command/leaderboard"
                  icon={Target}
                  title="Command Leaderboard"
                  detail="Review the ranked board for command metrics."
                />
                <QuickActionCard
                  href="/command/faq"
                  icon={BookOpen}
                  title="Metrics Dictionary"
                  detail="Read the metric definitions and calculation notes."
                />
              </div>
            </div>

            {selectedPlayerId ? (
              <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">
                  Focused row
                </div>
                <h3 className={`${plusJakarta.className} mt-2 text-[1.2rem] font-bold tracking-tight text-[#0F172A]`}>
                  Selected player pinned
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#64748B]">
                  The selected pitcher stays at the top of the grouped history view so you can compare recent outings without losing context.
                </p>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
