"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Target, BookOpen } from "lucide-react";
import Breadcrumbs from "@/app/components/Breadcrumbs";
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
import {
  loadAllOutingData,
  computeLeaderboardRows,
  computePlayerAggregateRows,
  type HandFilter,
  type LoadOptions,
} from "@/lib/leaderboards/load";
import type {
  OutingLeaderboardRow,
  PlayerAggregateRow,
  SeasonFilter,
  LeaderboardMode,
} from "@/lib/leaderboards/types";
import type { PitchGroup } from "@/lib/leaderboards/pitchGroups";
import { handBadgeClassesCompact } from "@/lib/handBadge";
import { savantColorAt } from "@/lib/savantColors";
import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import LogoutButton from "@/app/components/LogoutButton";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fields common to both row types that are sortable. */
type CommonSortKey =
  | "onTargetPct"
  | "avgMissIn"
  | "avgHAbsIn"
  | "avgVAbsIn"
  | "outlierPct"
  | "consistencyStdIn"
  | "pitchCount"
  | "playerName"
  | "commandPlus";

interface SortState {
  key: CommonSortKey;
  desc: boolean;
}

const DEFAULT_SORT: SortState = { key: "commandPlus", desc: true };

/** Lower-is-better metrics: default sort ascending when first clicked. */
const ASC_DEFAULT_KEYS = new Set<CommonSortKey>([
  "avgMissIn", "avgHAbsIn", "avgVAbsIn", "consistencyStdIn", "outlierPct",
]);

function compareOutings(a: OutingLeaderboardRow, b: OutingLeaderboardRow, s: SortState): number {
  const av = a[s.key as keyof OutingLeaderboardRow];
  const bv = b[s.key as keyof OutingLeaderboardRow];
  if (typeof av === "string" && typeof bv === "string") {
    return s.desc ? bv.localeCompare(av) : av.localeCompare(bv);
  }
  if (av == null || bv == null) {
    if (av == null && bv == null) return 0;
    return av == null ? 1 : -1;
  }
  const diff = (av as number) - (bv as number);
  return s.desc ? -diff : diff;
}

function comparePlayers(a: PlayerAggregateRow, b: PlayerAggregateRow, s: SortState): number {
  const av = a[s.key as keyof PlayerAggregateRow];
  const bv = b[s.key as keyof PlayerAggregateRow];
  if (typeof av === "string" && typeof bv === "string") {
    return s.desc ? bv.localeCompare(av) : av.localeCompare(bv);
  }
  if (av == null || bv == null) {
    if (av == null && bv == null) return 0;
    return av == null ? 1 : -1;
  }
  const diff = (av as number) - (bv as number);
  return s.desc ? -diff : diff;
}

/* ------------------------------------------------------------------ */
/*  Format helpers                                                     */
/* ------------------------------------------------------------------ */

function fmtPct(v: number): string {
  return v.toFixed(1) + "%";
}
function fmtIn(v: number): string {
  return v.toFixed(1) + "\u2033";
}
function dateLabel(dateId: string): string {
  const parts = dateId.split("_");
  if (parts.length < 3) return dateId;
  const [y, m, d] = parts;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mi = parseInt(m, 10) - 1;
  return `${months[mi] ?? m} ${parseInt(d, 10)}, ${y}`;
}

function outingDashboardHref(playerId: string, outingId: string): string {
  return `/player/${playerId}?outingId=${outingId}&from=leaderboards`;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((c) => `${c}${c}`).join("")
    : normalized;
  const value = parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function glowingBadgeStyle(style: { bg: string; text: string }) {
  return {
    color: style.text,
    background: `linear-gradient(180deg, ${hexToRgba(style.bg, 0.98)} 0%, ${hexToRgba(style.bg, 0.84)} 100%)`,
    border: `1px solid ${hexToRgba(style.bg, 0.6)}`,
    boxShadow: [
      `inset 0 1px 0 ${hexToRgba("#ffffff", 0.18)}`,
      `0 0 0 1px ${hexToRgba(style.bg, 0.12)}`,
      `0 0 16px ${hexToRgba(style.bg, 0.32)}`,
      `0 0 28px ${hexToRgba(style.bg, 0.14)}`,
    ].join(", "),
    textShadow: style.text === "#ffffff" ? "0 1px 1px rgba(0, 0, 0, 0.28)" : "none",
  };
}

/* ------------------------------------------------------------------ */
/*  Hand badge                                                         */
/* ------------------------------------------------------------------ */

function HandBadge({ hand, unknown }: { hand: "R" | "L"; unknown: boolean }) {
  if (unknown) {
    return (
      <span
        className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 font-normal"
        title="Pitcher hand not found in Arsenals.csv; defaulted to R"
      >
        Hand unknown
      </span>
    );
  }
  return (
    <span
      className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(hand)}`}
    >
      {hand === "L" ? "LHP" : "RHP"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton row                                                       */
/* ------------------------------------------------------------------ */

function SkeletonRow({ i, cols }: { i: number; cols: number }) {
  return (
    <tr className="border-b border-zinc-800/50 animate-pulse">
      <td className="px-4 py-3 text-zinc-600">{i + 1}</td>
      {Array.from({ length: cols }, (_, j) => (
        <td key={j} className="px-4 py-3">
          <div className="h-4 bg-zinc-800 rounded w-16" />
        </td>
      ))}
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Column header                                                      */
/* ------------------------------------------------------------------ */

interface ColProps {
  label: string;
  sortKey: CommonSortKey;
  sort: SortState;
  onSort: (key: CommonSortKey) => void;
  title?: string;
}

function Col({ label, sortKey, sort, onSort, title }: ColProps) {
  const active = sort.key === sortKey;
  return (
    <th
      className="px-2 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer select-none hover:text-orange-400/80 whitespace-nowrap transition-smooth"
      onClick={() => onSort(sortKey)}
      title={title}
    >
      {label}
      {active && (
        <span className="ml-1 text-orange-400">
          {sort.desc ? "\u25BC" : "\u25B2"}
        </span>
      )}
    </th>
  );
}

/* ------------------------------------------------------------------ */
/*  Segmented control                                                  */
/* ------------------------------------------------------------------ */

interface SegmentProps<T extends string> {
  label: string;
  options: { value: T; display: string }[];
  selected: T;
  onChange: (v: T) => void;
}

function Segment<T extends string>({ label, options, selected, onChange }: SegmentProps<T>) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        {label}
      </div>
      <div className="inline-flex flex-wrap gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
        {options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant="ghost"
            neon
            tone="orange"
            onClick={() => onChange(opt.value)}
            className={`${leaderboardFilterButtonBaseClassName} min-w-[4.75rem] flex-1 ${selected === opt.value
              ? leaderboardFilterButtonOrangeActiveClassName
              : leaderboardFilterButtonGhostInactiveClassName
              }`}
          >
            {opt.display}
          </Button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rank badge (gold / silver / bronze)                                 */
/* ------------------------------------------------------------------ */

function rankColor(i: number): string {
  const glow = "[text-shadow:0_0_8px_currentColor]";
  if (i === 0) return `text-amber-400 ${glow}`; // gold
  if (i === 1) return `text-zinc-400 ${glow}`; // silver
  if (i === 2) return `text-amber-600 ${glow}`; // bronze
  return "text-zinc-500";
}

/* ------------------------------------------------------------------ */
/*  KPI columns (shared between both modes)                            */
/* ------------------------------------------------------------------ */

function KpiCells({
  row,
  onTargetMin,
  onTargetMax,
}: {
  row: { pitchCount: number; onTargetPct: number; avgMissIn: number; avgHAbsIn: number; avgVAbsIn: number; outlierPct: number; consistencyStdIn: number; commandPlus: number | null };
  onTargetMin: number;
  onTargetMax: number;
}) {
  const pctForColor =
    onTargetMax > onTargetMin
      ? ((row.onTargetPct - onTargetMin) / (onTargetMax - onTargetMin)) * 100
      : 50;
  const onTargetStyle = savantColorAt(pctForColor);
  const onTargetBadgeStyle = glowingBadgeStyle(onTargetStyle);
  const commandPlusStyle =
    row.commandPlus === null ? null : plusMetricBadgeStyle(row.commandPlus);
  return (
    <>
      <td className="px-2 py-3 text-zinc-300 font-mono text-[11px]">{row.pitchCount}</td>
      <td className="px-2 py-3">
        <span
          className="inline-flex min-w-[70px] items-center justify-center rounded-lg px-2 py-1 font-mono text-[11px] font-extrabold tracking-tight"
          style={onTargetBadgeStyle}
        >
          {fmtPct(row.onTargetPct)}
        </span>
      </td>
      <td className="px-2 py-3">
        {row.commandPlus === null ? (
          <span className="inline-flex min-w-[52px] items-center justify-center rounded-md bg-zinc-800 px-2 py-1 font-mono text-[11px] font-bold text-zinc-500 shadow-sm">
            --
          </span>
        ) : (
          <span
            className="inline-flex min-w-[52px] items-center justify-center rounded-lg px-2 py-1 font-mono text-[11px] font-extrabold tracking-tight"
            style={commandPlusStyle ?? undefined}
          >
            {row.commandPlus.toFixed(0)}
          </span>
        )}
      </td>
      <td className="px-2 py-3 font-mono text-zinc-300 text-[11px]">{fmtIn(row.avgMissIn)}</td>
      <td className="px-2 py-3 font-mono text-zinc-300 text-[11px]">{fmtIn(row.avgHAbsIn)}</td>
      <td className="px-2 py-3 font-mono text-zinc-300 text-[11px]">{fmtIn(row.avgVAbsIn)}</td>
      <td className="px-2 py-3 font-mono text-zinc-400 text-[11px]">{fmtPct(row.outlierPct)}</td>
      <td className="px-2 py-3 font-mono text-zinc-400 text-[11px]">{fmtIn(row.consistencyStdIn)}</td>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LeaderboardsPage() {
  const router = useRouter();
  const {
    runWithTransition,
    contentTransitionClassName,
    getRowTransitionProps,
    transitionKey,
  } = useSmoothFilterTransition();
  const [mode, setMode] = useState<LeaderboardMode>("outings");
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>(2026);
  const [handFilter, setHandFilter] = useState<HandFilter>("ALL");
  const [pitchGroup, setPitchGroup] = useState<PitchGroup>("ALL");
  const [outingRows, setOutingRows] = useState<OutingLeaderboardRow[]>([]);
  const [playerRows, setPlayerRows] = useState<PlayerAggregateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [search, setSearch] = useState("");
  const dataLoaded = useRef(false);

  // Recompute both view types from cache
  const recompute = useCallback(() => {
    if (!dataLoaded.current) return;
    const filters = { seasonFilter, handFilter, pitchGroup, minPitches: 5 };
    setOutingRows(computeLeaderboardRows(filters));
    setPlayerRows(computePlayerAggregateRows(filters));
  }, [seasonFilter, handFilter, pitchGroup]);

  // Load raw data when season changes
  const loadData = useCallback(
    (filter: SeasonFilter) => {
      setLoading(true);
      setOutingRows([]);
      setPlayerRows([]);
      setProgress({ loaded: 0, total: 0 });
      dataLoaded.current = false;

      const opts: LoadOptions = {
        seasonFilter: filter,
        onProgress: (loaded, total) => setProgress({ loaded, total }),
      };

      loadAllOutingData(opts)
        .then(() => {
          dataLoaded.current = true;
          recompute();
          setLoading(false);
        })
        .catch((err) => {
          console.error("[Leaderboards] Load failed:", err);
          setLoading(false);
        });
    },
    [recompute],
  );

  useEffect(() => {
    loadData(seasonFilter);
  }, [seasonFilter, loadData]);

  // Recompute from cache when filters change (no refetch)
  useEffect(() => {
    recompute();
  }, [recompute]);

  // Sort toggle
  const handleSort = useCallback(
    (key: CommonSortKey) => {
      setSort((prev) =>
        prev.key === key
          ? { key, desc: !prev.desc }
          : { key, desc: !ASC_DEFAULT_KEYS.has(key) },
      );
    },
    [],
  );

  // Filter + sort for outings mode
  const displayedOutings = useMemo(() => {
    let filtered: OutingLeaderboardRow[] = outingRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = outingRows.filter((r) => r.playerName.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => compareOutings(a, b, sort));
  }, [outingRows, search, sort]);

  // Filter + sort for players mode
  const displayedPlayers = useMemo(() => {
    let filtered: PlayerAggregateRow[] = playerRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = playerRows.filter((r) => r.playerName.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => comparePlayers(a, b, sort));
  }, [playerRows, search, sort]);

  const rowCount = mode === "outings" ? displayedOutings.length : displayedPlayers.length;

  const { onTargetMin, onTargetMax } = useMemo(() => {
    const rows = mode === "outings" ? displayedOutings : displayedPlayers;
    if (rows.length === 0) return { onTargetMin: 0, onTargetMax: 100 };
    const vals = rows.map((r) => r.onTargetPct);
    return {
      onTargetMin: Math.min(...vals),
      onTargetMax: Math.max(...vals),
    };
  }, [mode, displayedOutings, displayedPlayers]);

  const activeSeasonLabel =
    seasonFilter === "both" ? "Both seasons" : `${seasonFilter} season`;
  const filterSummary = `${handFilter === "ALL" ? "All hands" : handFilter === "L" ? "LHP" : "RHP"} · ${
    pitchGroup === "ALL" ? "All pitches" : pitchGroup === "FASTBALL" ? "Fastballs" : "Breaking"
  }`;

  return (
    <LeaderboardPageFrame maxWidth="max-w-7xl">
      <div className="flex justify-end">
        <LogoutButton />
      </div>

      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Leaderboards", href: "/leaderboards-hub" }, { label: "Command" }]} />

      <LeaderboardHero
        tone="orange"
        icon={Target}
        eyebrow="Command Leaderboard"
        title={<>Command Leaderboard</>}
        meta={(
          <>
            <LeaderboardPill tone="orange">
              {mode === "outings" ? "Outing view" : "Player view"}
            </LeaderboardPill>
            <LeaderboardPill tone="neutral">{activeSeasonLabel}</LeaderboardPill>
            <LeaderboardPill tone="neutral">{filterSummary}</LeaderboardPill>
          </>
        )}
        side={(
          <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Guide</div>
            <Link
              href="/command/faq"
              className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-orange-500/25 bg-orange-500/10 px-4 py-3.5 text-sm font-semibold text-orange-300 transition-smooth hover:border-orange-400/40 hover:text-orange-200"
            >
              <BookOpen className="h-4 w-4" />
              Metrics Dictionary
            </Link>
          </div>
        )}
      />

      <LeaderboardToolbar>
        <div className="grid gap-4 xl:grid-cols-[auto_auto_auto_auto_minmax(0,1fr)_auto] xl:items-end">
          <Segment<LeaderboardMode>
            label="Mode"
            options={[
              { value: "outings", display: "Outings" },
              { value: "players", display: "Players" },
            ]}
            selected={mode}
            onChange={(nextMode) => runWithTransition(() => setMode(nextMode))}
          />

          <Segment
            label="Season"
            options={[
              { value: "2025", display: "2025" },
              { value: "2026", display: "2026" },
              { value: "both", display: "Both" },
            ]}
            selected={String(seasonFilter)}
            onChange={(v) =>
              runWithTransition(() =>
                setSeasonFilter(v === "both" ? "both" : (Number(v) as SeasonFilter)),
              )
            }
          />

          <Segment
            label="Hand"
            options={[
              { value: "ALL", display: "All" },
              { value: "R", display: "RHP" },
              { value: "L", display: "LHP" },
            ]}
            selected={handFilter}
            onChange={(nextHand) => runWithTransition(() => setHandFilter(nextHand))}
          />

          <Segment
            label="Pitch Mix"
            options={[
              { value: "ALL", display: "Overall" },
              { value: "FASTBALL", display: "Fastballs" },
              { value: "BREAKING", display: "Breaking" },
            ]}
            selected={pitchGroup}
            onChange={(nextPitchGroup) => runWithTransition(() => setPitchGroup(nextPitchGroup))}
          />

          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Search
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pitcher..."
              className="w-full rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </div>

          <div className="flex items-end xl:min-w-[6rem]">
            <div className="flex flex-wrap gap-3">
              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </LeaderboardToolbar>

      <div
        className={`mt-6 ${contentTransitionClassName}`}
      >
        <LeaderboardPanel className="overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
                <tr className="bg-zinc-900/80 border-y border-zinc-800/60">
                  <th className="px-2 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-12">
                    #
                  </th>
                  <Col label="Player" sortKey="playerName" sort={sort} onSort={handleSort} />
                  {mode === "outings" ? (
                    <th className="px-2 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Date
                    </th>
                  ) : (
                    <th className="px-2 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Outings
                    </th>
                  )}
                  <Col label="Pitches" sortKey="pitchCount" sort={sort} onSort={handleSort} />
                  <Col label="On-target %" sortKey="onTargetPct" sort={sort} onSort={handleSort} title="Pitches within 8 inches" />
                  <Col label="Command+" sortKey="commandPlus" sort={sort} onSort={handleSort} title="Pitch-weighted command relative to team average (100 = average, >100 is better)" />
                  <Col label="Avg Miss" sortKey="avgMissIn" sort={sort} onSort={handleSort} title="Average total miss (inches)" />
                  <Col label="Avg H" sortKey="avgHAbsIn" sort={sort} onSort={handleSort} title="Average horizontal miss (inches, absolute)" />
                  <Col label="Avg V" sortKey="avgVAbsIn" sort={sort} onSort={handleSort} title="Average vertical miss (inches, absolute)" />
                  <Col label="Outlier %" sortKey="outlierPct" sort={sort} onSort={handleSort} title="Pitches beyond 20 inches" />
                  <Col label="Consistency" sortKey="consistencyStdIn" sort={sort} onSort={handleSort} title="Std dev of total miss (lower = more consistent)" />
                </tr>
              </thead>
              <tbody key={`${mode}-${transitionKey}`}>
                {loading
                  ? Array.from({ length: 8 }, (_, i) => (
                      <SkeletonRow key={i} i={i} cols={9} />
                    ))
                  : null}
                {!loading && rowCount === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-zinc-500">
                          No {mode === "outings" ? "outings" : "players"} found for the selected filters.
                        </span>
                        {search.trim() ? (
                          <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="text-sm font-medium text-orange-300 hover:text-orange-200 transition-smooth"
                          >
                            Clear filters
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}

                {!loading && mode === "outings"
                  ? displayedOutings.map((row, i) => {
                      const rowTransition = getRowTransitionProps(i);
                      return (
                        <tr
                          key={row.outingId}
                          className={`${rowTransition.className} border-b border-zinc-800/50 hover:bg-orange-500/5 transition-smooth cursor-pointer group`}
                          style={rowTransition.style}
                          onClick={() => router.push(outingDashboardHref(row.playerId, row.outingId))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              router.push(outingDashboardHref(row.playerId, row.outingId));
                            }
                          }}
                          tabIndex={0}
                          role="link"
                          aria-label={`${row.playerName} ${dateLabel(row.dateId)} outing`}
                        >
                          <td className={`px-2 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>
                            {i + 1}
                          </td>
                          <td className="px-2 py-3 font-medium whitespace-nowrap">
                            <Link
                              href={outingDashboardHref(row.playerId, row.outingId)}
                              className="hover:text-orange-300 transition-smooth"
                            >
                              {row.playerName}
                            </Link>
                            <HandBadge hand={row.pitcherHand} unknown={row.handUnknown} />
                          </td>
                          <td className="px-2 py-3 text-zinc-400 whitespace-nowrap">
                            <Link
                              href={outingDashboardHref(row.playerId, row.outingId)}
                              className="hover:text-zinc-200 transition-smooth"
                            >
                              {dateLabel(row.dateId)}
                            </Link>
                          </td>
                          <KpiCells row={row} onTargetMin={onTargetMin} onTargetMax={onTargetMax} />
                        </tr>
                      );
                    })
                  : null}

                {!loading && mode === "players"
                  ? displayedPlayers.map((row, i) => {
                      const rowTransition = getRowTransitionProps(i);
                      return (
                        <tr
                          key={row.playerId}
                          className={`${rowTransition.className} border-b border-zinc-800/50 hover:bg-orange-500/5 transition-smooth cursor-pointer group`}
                          style={rowTransition.style}
                        >
                          <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>
                            {i + 1}
                          </td>
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            <Link
                              href={`/player/${row.playerId}`}
                              className="hover:text-orange-300 transition-smooth"
                            >
                              {row.playerName}
                            </Link>
                            <HandBadge hand={row.pitcherHand} unknown={row.handUnknown} />
                          </td>
                          <td className="px-4 py-3 text-zinc-400 font-mono">
                            {row.outingCount}
                          </td>
                          <KpiCells row={row} onTargetMin={onTargetMin} onTargetMax={onTargetMax} />
                        </tr>
                      );
                    })
                  : null}
              </tbody>
            </table>
          </div>
        </LeaderboardPanel>

        {!loading && mode === "players" && displayedPlayers.length > 0 ? (
          <p className="mt-4 text-xs text-zinc-500">
            Aggregated across all outings matching filters. Consistency is exact standard deviation across all pitches.
          </p>
        ) : null}
      </div>
    </LeaderboardPageFrame>
  );
}
