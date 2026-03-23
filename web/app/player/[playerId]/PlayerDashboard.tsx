"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { ArrowLeft, Pencil, Target } from "lucide-react";
import { usePitchData } from "../../hooks/usePitchData";
import { applyFilters } from "../../utils";
import type { Pitch, Filters } from "../../types";
import type { Lane } from "@/lib/handedness";
import type { Player, Outing } from "@/lib/dataIndex";
import { laneOf } from "@/lib/reportModel";
import FilterPanel from "../../components/FilterPanel";
import PitchTable from "../../components/PitchTable";
import VideoPlayer from "../../components/VideoPlayer";
import StrikeZoneScatter from "../../components/StrikeZoneScatter";
import LaneReport from "../../components/LaneReport";
import PitchTypeSummaryCards from "../../components/PitchTypeSummaryCards";
import CommandPlusSection from "../../components/CommandPlusSection";
import GameStatsSection from "@/lib/stats/GameStatsSection";
import { seasonFromDateId } from "@/lib/season";
import { pitchDisplayName } from "@/lib/pitchNames";
import {
  loadOutingMeta,
  loadPlayerGameStats,
  type OutingMeta,
  type PlayerGameStats,
} from "@/lib/stats";
import { sortPitchTypes } from "@/lib/pitchTypeOrder";
import {
  brandHighlightCardClasses,
  brandSoftEyebrowTextClasses,
  brandSoftPillClasses,
} from "@/lib/brandSurfaces";
import { LeaderboardPill } from "@/app/components/leaderboards/LeaderboardChrome";
import { cn } from "@/lib/utils";

const EMPTY_FILTERS: Filters = {
  pitchTypes: new Set(),
  maxMiss: null,
};

/* ------------------------------------------------------------------ */
/*  Pitch-type override helpers (localStorage)                         */
/* ------------------------------------------------------------------ */

type Overrides = Record<number, string>; // pitch_number → new pitch_type

function storageKey(outingId: string): string {
  return `pitchTypeOverrides:${outingId}`;
}

function loadOverrides(outingId: string): Overrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(outingId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(outingId: string, overrides: Overrides): void {
  if (typeof window === "undefined") return;
  if (Object.keys(overrides).length === 0) {
    localStorage.removeItem(storageKey(outingId));
  } else {
    localStorage.setItem(storageKey(outingId), JSON.stringify(overrides));
  }
}

function outingLabelKey(outingId: string): string {
  return `outingLabel:${outingId}`;
}

function loadOutingLabel(outingId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(outingLabelKey(outingId));
  } catch {
    return null;
  }
}

function saveOutingLabel(outingId: string, label: string): void {
  if (typeof window === "undefined") return;
  if (label.trim() === "") {
    localStorage.removeItem(outingLabelKey(outingId));
  } else {
    localStorage.setItem(outingLabelKey(outingId), label.trim());
  }
}

function applyOverrides(pitches: Pitch[], overrides: Overrides): Pitch[] {
  if (Object.keys(overrides).length === 0) return pitches;
  return pitches.map((p) => {
    const newType = overrides[p.pitch_number];
    if (newType && newType !== p.pitch_type) {
      return { ...p, pitch_type: newType };
    }
    return p;
  });
}

function HeaderActionLink({
  href,
  label,
  emphasis = false,
}: {
  href: string;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-smooth",
        emphasis
          ? cn(brandSoftPillClasses, brandSoftEyebrowTextClasses, "hover:opacity-90")
          : "border-slate-200 dark:border-zinc-700 bg-surface text-slate-500 hover:border-slate-300 dark:hover:border-zinc-600 hover:text-slate-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50",
      )}
    >
      {label}
    </Link>
  );
}

function SidebarPanel({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
      <div className="border-b border-slate-100 dark:border-zinc-800 px-4 py-3 dark:border-zinc-800">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500 dark:text-zinc-500">
          {title}
        </div>
        {detail ? <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{detail}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PlayerDashboard({
  player,
  outing,
  backTo,
  backLabel,
  profileSlug,
}: {
  player: Player;
  outing: Outing;
  backTo?: string;
  backLabel?: string;
  profileSlug?: string;
}) {
  const { pitches: rawPitches, pitcherHand, loading, error } = usePitchData(outing.csvPath, player.id);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [selected, setSelected] = useState<Pitch | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [activeLane, setActiveLane] = useState<Lane | null>(null);
  const [outingMeta, setOutingMeta] = useState<OutingMeta | null>(null);
  const [statsByGame, setStatsByGame] = useState<Record<string, PlayerGameStats | null>>({});
  const [outingLabelOverride, setOutingLabelOverride] = useState<string | null>(null);
  const [isEditingOutingLabel, setIsEditingOutingLabel] = useState(false);
  const [outingLabelInput, setOutingLabelInput] = useState("");

  const displayOutingLabel = outingLabelOverride ?? outing.label;

  // Load overrides and label from localStorage on mount / outing change
  useEffect(() => {
    setOverrides(loadOverrides(outing.id));
    setOutingLabelOverride(loadOutingLabel(outing.id));
    setIsEditingOutingLabel(false);
  }, [outing.id]);

  useEffect(() => {
    let active = true;
    setOutingMeta(null);
    setStatsByGame({});
    const [outingPlayerId, dateId] = outing.id.split("/");
    if (!outingPlayerId || !dateId) {
      return () => {
        active = false;
      };
    }
    const loadStats = async () => {
      const meta = await loadOutingMeta(outingPlayerId, dateId);
      if (!active || !meta) {
        if (active) setOutingMeta(null);
        return;
      }
      setOutingMeta(meta);
      const initialMap: Record<string, PlayerGameStats | null> = {};
      for (const game of meta.linkedGames) {
        initialMap[game.gameId] = null;
      }
      const entries = await Promise.all(
        meta.linkedGames.map(async (game) => [
          game.gameId,
          await loadPlayerGameStats(outingPlayerId, game.season, game.gameId),
        ] as const),
      );
      if (!active) return;
      const map: Record<string, PlayerGameStats | null> = { ...initialMap };
      for (const [gameId, stats] of entries) {
        map[gameId] = stats;
      }
      setStatsByGame(map);
    };
    void loadStats();
    return () => {
      active = false;
    };
  }, [outing.id]);

  // Pitches with overrides applied — used everywhere downstream
  const pitches = useMemo(
    () => applyOverrides(rawPitches, overrides),
    [rawPitches, overrides],
  );

  // Set of edited pitch numbers (for UI badge)
  const editedPitches = useMemo(
    () => new Set(Object.keys(overrides).map(Number)),
    [overrides],
  );

  // Available pitch type options: union of original types + any override values
  const pitchTypeOptions = useMemo(() => {
    const types = new Set<string>();
    for (const p of rawPitches) {
      if (p.pitch_type) types.add(p.pitch_type);
    }
    for (const v of Object.values(overrides)) {
      if (v) types.add(v);
    }
    return sortPitchTypes(Array.from(types), (type) => type);
  }, [rawPitches, overrides]);

  const handleEditPitchType = useCallback(
    (pitchNumber: number, newType: string) => {
      setOverrides((prev) => {
        // Find original type — if the edit returns it to original, remove the override
        const original = rawPitches.find((p) => p.pitch_number === pitchNumber);
        const next = { ...prev };
        if (original && original.pitch_type === newType) {
          delete next[pitchNumber];
        } else {
          next[pitchNumber] = newType;
        }
        saveOverrides(outing.id, next);
        return next;
      });
    },
    [outing, rawPitches],
  );

  const handleResetEdits = useCallback(() => {
    setOverrides({});
    saveOverrides(outing.id, {});
  }, [outing]);

  const filtered = applyFilters(pitches, filters);
  // Exclude no-read pitches (NaN measurements) from visualizations and calculations
  const measurable = filtered.filter((p) => Number.isFinite(p.total_miss_inches));
  const laneFiltered = activeLane
    ? measurable.filter((p) => laneOf(p, pitcherHand) === (activeLane as string))
    : measurable;

  // Keep selected pitch valid when the visible list changes
  useEffect(() => {
    if (selected && !laneFiltered.some((p) => p.pitch_number === selected.pitch_number)) {
      setSelected(laneFiltered.length > 0 ? laneFiltered[0] : null);
    }
  }, [laneFiltered, selected]);

  const toggleLane = (lane: Lane) => {
    setActiveLane((prev) => (prev === lane ? null : lane));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f8fafc_100%)] text-slate-500 dark:bg-[linear-gradient(180deg,#09090b_0%,#18181b_45%,#09090b_100%)] dark:text-zinc-400">
        Loading command report...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f8fafc_100%)] text-red-600 dark:bg-[linear-gradient(180deg,#09090b_0%,#18181b_45%,#09090b_100%)] dark:text-red-400">
        Error: {error}
      </div>
    );
  }

  const hasEdits = editedPitches.size > 0;
  const outingDateId = outing.id.split("/")[1] ?? "";
  const currentSeason = seasonFromDateId(outingDateId);
  const profileHref = profileSlug ? `/players/${profileSlug}?tab=Command` : null;
  const profileContextQuery = profileSlug
    ? `&from=profile&slug=${encodeURIComponent(profileSlug)}`
    : "";
  const compareHref =
    player.outings.length >= 2
      ? `/player/${player.id}/compare?outingA=${outing.id}&outingB=${
          player.outings.find((o) => o.id !== outing.id)?.id ?? player.outings[1].id
        }${profileContextQuery}`
      : `/player/${player.id}/compare?outingA=${outing.id}${profileContextQuery}`;

  return (
    <div className="relative min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_35%,#f8fafc_100%)] text-slate-900 dark:bg-[linear-gradient(180deg,#09090b_0%,#18181b_40%,#09090b_100%)] dark:text-zinc-50">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 dark:opacity-50"
        style={{
          background:
            "radial-gradient(circle at top center, rgba(var(--brand-primary-rgb), 0.09), transparent 58%)",
        }}
      />
      <header className="relative">
        <div className="mx-auto max-w-[1600px] px-4 pt-5 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)] sm:p-6 lg:p-7">
            {/* Top: back + context + pitch count */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <Link
                  href={backTo ?? "/"}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 dark:border-zinc-700 bg-background px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-smooth hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-surface hover:text-slate-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {backLabel ?? "Home"}
                </Link>
                <div className="hidden h-8 w-px shrink-0 bg-[#E2E8F0] dark:bg-zinc-700 sm:block" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500 dark:text-zinc-500">
                    Command outing
                  </p>
                  <p className="mt-0.5 max-w-xl text-[13px] leading-snug text-slate-500 dark:text-zinc-400">
                    Video, scatter, and command metrics for this session.
                  </p>
                </div>
              </div>
              <LeaderboardPill tone="brand" variant="light" className="shrink-0">
                {laneFiltered.length} / {pitches.length} pitches
              </LeaderboardPill>
            </div>

            {/* Hero */}
            <div className="mt-6">
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                  brandSoftPillClasses,
                  brandSoftEyebrowTextClasses,
                )}
              >
                <Target className="h-3.5 w-3.5 text-[var(--brand-primary)]" aria-hidden />
                Pitch command
              </div>
              <p className="mt-4 text-[13px] font-semibold text-slate-500 dark:text-zinc-400">{player.name}</p>
              {isEditingOutingLabel ? (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={outingLabelInput}
                    onChange={(e) => setOutingLabelInput(e.target.value)}
                    onBlur={() => {
                      const trimmed = outingLabelInput.trim();
                      if (trimmed) {
                        saveOutingLabel(outing.id, trimmed);
                        setOutingLabelOverride(trimmed);
                      } else {
                        saveOutingLabel(outing.id, "");
                        setOutingLabelOverride(null);
                      }
                      setIsEditingOutingLabel(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                      if (e.key === "Escape") {
                        setOutingLabelInput(displayOutingLabel);
                        setIsEditingOutingLabel(false);
                        e.currentTarget.blur();
                      }
                    }}
                    autoFocus
                    className="font-display min-w-[12rem] flex-1 rounded-xl border border-slate-200 dark:border-zinc-700 bg-background px-3 py-2.5 text-2xl font-black tracking-tight text-slate-900 outline-none transition-colors focus:border-[var(--brand-primary-border)] focus:bg-surface focus:ring-2 focus:ring-[rgba(var(--brand-primary-rgb),0.18)] dark:border-zinc-700 dark:text-zinc-50 sm:text-4xl"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOutingLabelInput(displayOutingLabel);
                    setIsEditingOutingLabel(true);
                  }}
                  className="group mt-1 -ml-1 flex max-w-full cursor-pointer items-start gap-2 rounded-xl py-1 pr-2 pl-1 text-left transition hover:bg-background dark:hover:bg-zinc-800/40"
                  aria-label="Edit outing name"
                >
                  <h1
                    className="font-display min-w-0 text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[2.35rem] sm:leading-[1.08]"
                  >
                    {displayOutingLabel}
                  </h1>
                  <Pencil
                    className="mt-1.5 h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500 opacity-60 group-hover:opacity-100 dark:text-zinc-500 sm:mt-2 sm:h-5 sm:w-5"
                    aria-hidden
                  />
                </button>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {currentSeason ? (
                  <LeaderboardPill tone="brand" variant="light">
                    {currentSeason} season
                  </LeaderboardPill>
                ) : null}
                <LeaderboardPill variant="light">{pitches.length} tracked pitches</LeaderboardPill>
                {selected ? (
                  <LeaderboardPill tone="neutral" variant="light">
                    Pitch #{selected.pitch_number} • {pitchDisplayName(selected.pitch_type)}
                  </LeaderboardPill>
                ) : null}
              </div>
            </div>

            {/* Quick links */}
            <div className="mt-6 border-t border-slate-100 dark:border-zinc-800 pt-6 dark:border-zinc-800">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500 dark:text-zinc-500">Quick links</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {profileHref ? (
                  <HeaderActionLink href={profileHref} label="Player Profile" />
                ) : null}
                <HeaderActionLink
                  href={`/player/${player.id}/report?scope=outing&outingId=${outing.id}${profileContextQuery}`}
                  label="Print Outing"
                />
                <HeaderActionLink
                  href={`/player/${player.id}/report?scope=overall${profileContextQuery}`}
                  label="Season Report"
                />
                {player.outings.length >= 1 ? (
                  <HeaderActionLink href={compareHref} label="Compare Outings" emphasis />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-6 sm:px-6 lg:px-8 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <aside className="space-y-4 xl:sticky xl:top-4">
          <SidebarPanel
            title="Filters"
            detail="Choose pitch types and a max miss."
          >
            <FilterPanel
              pitches={pitches}
              filters={filters}
              onChange={setFilters}
            />
          </SidebarPanel>

          {hasEdits ? (
            <div className={cn("rounded-2xl px-4 py-3", brandHighlightCardClasses)}>
              <div className="flex items-center justify-between gap-3">
                <span className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", brandSoftEyebrowTextClasses)}>
                  {editedPitches.size} edited
                </span>
                <button
                  type="button"
                  onClick={handleResetEdits}
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.16em] opacity-90 transition-smooth hover:opacity-100",
                    brandSoftEyebrowTextClasses,
                  )}
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}

          <section className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
            <div className="border-b border-slate-100 dark:border-zinc-800 px-4 py-3 dark:border-zinc-800">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500 dark:text-zinc-500">
                Pitch Log
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                Pick any pitch to update the video and miss shape.
              </div>
            </div>
            <PitchTable
              pitches={activeLane ? laneFiltered : filtered}
              selected={selected}
              onSelect={setSelected}
              pitcherHand={pitcherHand}
              editedPitches={editedPitches}
              onEditPitchType={handleEditPitchType}
              pitchTypeOptions={pitchTypeOptions}
            />
          </section>
        </aside>

        <main className="min-w-0 space-y-4">
          <section className="rounded-[28px] border border-border bg-surface p-4 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)] sm:p-5">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <VideoPlayer
                pitch={selected}
                overlayDir={outing.overlayDir}
                clipsDir={outing.clipsDir}
                pitcherHand={pitcherHand}
              />
              <StrikeZoneScatter
                pitches={laneFiltered}
                selected={selected}
                onSelect={setSelected}
                throwsHand={pitcherHand}
              />
            </div>
          </section>

          {outingMeta ? (
            <GameStatsSection meta={outingMeta} statsByGame={statsByGame} />
          ) : null}

          {laneFiltered.length > 0 ? (
            <CommandPlusSection pitches={laneFiltered} outingId={outing.id} />
          ) : null}

          {laneFiltered.length > 0 ? (
            <PitchTypeSummaryCards pitches={laneFiltered} />
          ) : null}

          {measurable.length > 0 ? (
            <LaneReport
              pitches={measurable}
              throwsHand={pitcherHand}
              activeLane={activeLane}
              onSelectLane={toggleLane}
            />
          ) : null}

        </main>
      </div>
    </div>
  );
}
