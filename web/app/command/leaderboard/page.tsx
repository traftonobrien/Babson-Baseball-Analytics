"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Search, Target } from "lucide-react";
import { SegmentedRail, type SegmentedItem } from "@/app/components/leaderboards/SegmentedRail";
import { useSmoothFilterTransition } from "@/app/components/leaderboards/useSmoothFilterTransition";
import {
  LeaderboardHero,
  LeaderboardIntro,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardStatBlock,
  LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";
import { LeaderboardExportPdfButton } from "@/app/components/leaderboards/LeaderboardExportPdfButton";
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
import { handBadgeClasses } from "@/lib/handBadge";
import { savantColorAt } from "@/lib/savantColors";
import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";


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
    color: "#ffffff",
    background: `linear-gradient(180deg, ${hexToRgba(style.bg, 0.98)} 0%, ${hexToRgba(style.bg, 0.84)} 100%)`,
    border: `1px solid ${hexToRgba(style.bg, 0.6)}`,
    boxShadow: [
      `inset 0 1px 0 ${hexToRgba("#ffffff", 0.18)}`,
      `0 0 0 1px ${hexToRgba(style.bg, 0.12)}`,
      `0 0 16px ${hexToRgba(style.bg, 0.32)}`,
      `0 0 28px ${hexToRgba(style.bg, 0.14)}`,
    ].join(", "),
    textShadow: "0 1px 1px rgba(0, 0, 0, 0.28)",
  };
}

/* ------------------------------------------------------------------ */
/*  Hand badge                                                         */
/* ------------------------------------------------------------------ */

function HandBadge({ hand, unknown }: { hand: "R" | "L"; unknown: boolean }) {
  if (unknown) {
    return (
      <span
        className="ml-2 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-normal text-amber-800"
        title="Pitcher hand not found in Arsenals.csv; defaulted to R"
      >
        Hand unknown
      </span>
    );
  }
  return (
    <span
      className={`ml-2 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${handBadgeClasses(hand)}`}
    >
      {hand === "L" ? "LHP" : "RHP"}
    </span>
  );
}

function LeaderboardActionCard({
  href,
  sectionTitle,
  buttonLabel,
  icon: Icon,
}: {
  href: string;
  sectionTitle: string;
  buttonLabel: string;
  icon: typeof Target;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-surface p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] dark:border-zinc-700 dark:bg-zinc-900/55 dark:shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
        {sectionTitle}
      </div>
      <div className="mt-3">
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(var(--brand-primary-rgb),0.22)] transition-smooth hover:bg-[var(--brand-primary-hover)]"
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {buttonLabel}
          <ChevronRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton row                                                       */
/* ------------------------------------------------------------------ */

function SkeletonRow({ i, cols }: { i: number; cols: number }) {
  return (
    <tr className="animate-pulse border-b border-slate-100 dark:border-zinc-800">
      <td className="px-4 py-3 text-slate-500 dark:text-zinc-500">{i + 1}</td>
      {Array.from({ length: cols }, (_, j) => (
        <td key={j} className="px-4 py-3">
          <div className="h-4 w-16 rounded bg-slate-200 dark:bg-zinc-700" />
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
      className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-smooth hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400"
      onClick={() => onSort(sortKey)}
      title={title}
    >
      {label}
      {active && (
        <span className="ml-1 text-orange-600 dark:text-orange-400">
          {sort.desc ? "\u25BC" : "\u25B2"}
        </span>
      )}
    </th>
  );
}

const MODE_ITEMS: SegmentedItem<LeaderboardMode>[] = [
  { value: "outings", label: "Outings" },
  { value: "players", label: "Players" },
];

const SEASON_ITEMS: SegmentedItem<SeasonFilter>[] = [
  { value: 2025, label: "2025" },
  { value: 2026, label: "2026" },
  { value: "both", label: "Both" },
];

const HAND_ITEMS: SegmentedItem<HandFilter>[] = [
  { value: "ALL", label: "All" },
  { value: "R", label: "RHP" },
  { value: "L", label: "LHP" },
];

const PITCH_MIX_ITEMS: SegmentedItem<PitchGroup>[] = [
  { value: "ALL", label: "Overall" },
  { value: "FASTBALL", label: "Fastballs" },
  { value: "BREAKING", label: "Breaking" },
];

/* ------------------------------------------------------------------ */
/*  Rank badge (gold / silver / bronze)                                 */
/* ------------------------------------------------------------------ */

function rankColor(i: number): string {
  const glow = "[text-shadow:0_0_6px_rgba(234,179,8,0.35)]";
  if (i === 0) return `text-amber-600 ${glow} dark:text-amber-400`;
  if (i === 1) return `text-slate-400 ${glow} dark:text-zinc-400`;
  if (i === 2) return `text-amber-700 ${glow} dark:text-amber-500`;
  return "text-slate-500 dark:text-zinc-400";
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
      <td className="px-2 py-3 font-mono text-[11px] text-slate-700 dark:text-zinc-300">{row.pitchCount}</td>
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
          <span className="inline-flex min-w-[52px] items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400">
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
      <td className="px-2 py-3 font-mono text-[11px] text-slate-700 dark:text-zinc-300">{fmtIn(row.avgMissIn)}</td>
      <td className="px-2 py-3 font-mono text-[11px] text-slate-700 dark:text-zinc-300">{fmtIn(row.avgHAbsIn)}</td>
      <td className="px-2 py-3 font-mono text-[11px] text-slate-700 dark:text-zinc-300">{fmtIn(row.avgVAbsIn)}</td>
      <td className="px-2 py-3 font-mono text-[11px] text-slate-600 dark:text-zinc-400">{fmtPct(row.outlierPct)}</td>
      <td className="px-2 py-3 font-mono text-[11px] text-slate-600 dark:text-zinc-400">{fmtIn(row.consistencyStdIn)}</td>
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
    <LeaderboardPageFrame variant="light" maxWidth="max-w-[1440px]">
      <div className="leaderboard-print-root font-display flex min-h-full flex-col gap-6">
        <LeaderboardIntro
          surface="light"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Leaderboards", href: "/leaderboards-hub" },
            { label: "Command" },
          ]}
          actions={
            <LeaderboardExportPdfButton
              fileStem={`command_leaderboard_${mode}_${seasonFilter}_${handFilter}_${pitchGroup}`}
            />
          }
        >
          <LeaderboardHero
            tone="amber"
            icon={Target}
            eyebrow="Command"
            title="Command Leaderboard"
            description="Track Command+, on-target rate, miss shape, and consistency across the current command filter stack."
            meta={
              <>
                <LeaderboardPill variant="light" tone="brand">{activeSeasonLabel}</LeaderboardPill>
                <LeaderboardPill variant="light" tone="neutral">{filterSummary}</LeaderboardPill>
              </>
            }
            side={
              <div className="leaderboard-print-hide grid w-full gap-3 sm:grid-cols-2 xl:w-[26rem]">
                <LeaderboardActionCard
                  href="/command"
                  icon={Target}
                  sectionTitle="Command hub"
                  buttonLabel="View Hub"
                />
                <LeaderboardActionCard
                  href="/command/faq"
                  icon={BookOpen}
                  sectionTitle="Dictionary"
                  buttonLabel="Metrics FAQ"
                />
              </div>
            }
            variant="light"
          />
        </LeaderboardIntro>

        <div className="leaderboard-print-hide grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LeaderboardStatBlock
            label="Table rows"
            value={loading ? "—" : String(rowCount)}
            detail={`${mode === "outings" ? "Outing" : "Player"} view · search filtered.`}
            variant="light"
          />
          <LeaderboardStatBlock
            label="Outings loaded"
            value={loading ? "—" : String(outingRows.length)}
            detail="Outings in the current season cache after mix filters."
            variant="light"
          />
          <LeaderboardStatBlock
            label="Pitchers (aggregate)"
            value={loading ? "—" : String(playerRows.length)}
            detail="Player rows available in player view for the same filters."
            variant="light"
          />
        </div>

        <LeaderboardToolbar variant="light" className="leaderboard-print-hide">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SegmentedRail
              label="Mode"
              items={MODE_ITEMS}
              value={mode}
              onChange={(nextMode) => runWithTransition(() => setMode(nextMode))}
            />
            <button
              type="button"
              onClick={() =>
                runWithTransition(() => {
                  setMode("outings");
                  setSeasonFilter(2026);
                  setHandFilter("ALL");
                  setPitchGroup("ALL");
                  setSearch("");
                })
              }
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-surface px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm transition-smooth hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
            >
              Reset filters
            </button>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[auto_auto_auto_auto_minmax(0,1fr)_auto] xl:items-end">
            <SegmentedRail
              label="Season"
              items={SEASON_ITEMS}
              value={seasonFilter}
              onChange={(next) => runWithTransition(() => setSeasonFilter(next))}
              compact
            />
            <SegmentedRail
              label="Hand"
              items={HAND_ITEMS}
              value={handFilter}
              onChange={(nextHand) => runWithTransition(() => setHandFilter(nextHand))}
              compact
            />
            <SegmentedRail
              label="Pitch mix"
              items={PITCH_MIX_ITEMS}
              value={pitchGroup}
              onChange={(nextPitchGroup) => runWithTransition(() => setPitchGroup(nextPitchGroup))}
              compact
            />
            <div className="min-w-0 xl:col-span-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400">
                Search
              </div>
              <label className="mt-2 flex h-11 items-center gap-3 rounded-full border border-slate-200 bg-slate-100 px-4 shadow-sm transition-all focus-within:border-orange-300 focus-within:bg-surface dark:border-zinc-700 dark:bg-zinc-900/70 dark:focus-within:border-orange-500/60">
                <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pitcher..."
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-surface px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm transition-smooth hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </LeaderboardToolbar>

        <div className={contentTransitionClassName}>
          <LeaderboardPanel variant="light" className="leaderboard-print-panel overflow-hidden shadow-sm">
            <div className="leaderboard-print-table-shell max-h-[70vh] overflow-auto">
              <table className="leaderboard-print-table w-full text-sm">
                <thead className="leaderboard-print-sticky-head sticky top-0 z-10 border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900/85">
                  <tr>
                    <th className="w-12 px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      #
                    </th>
                    <Col label="Player" sortKey="playerName" sort={sort} onSort={handleSort} />
                    {mode === "outings" ? (
                      <th className="px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        Date
                      </th>
                    ) : (
                      <th className="px-2 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
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
                          <span className="text-slate-500 dark:text-zinc-400">
                            No {mode === "outings" ? "outings" : "players"} found for the selected filters.
                          </span>
                          {search.trim() ? (
                            <button
                              type="button"
                              onClick={() => setSearch("")}
                              className="text-sm font-medium text-orange-600 transition-smooth hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
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
                            className={`${rowTransition.className} cursor-pointer border-b border-slate-100 transition-smooth last:border-b-0 hover:bg-slate-50/80 group dark:border-zinc-800 dark:hover:bg-zinc-800/40`}
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
                            <td className="whitespace-nowrap px-2 py-3 font-medium text-slate-900 dark:text-zinc-100">
                              <Link
                                href={outingDashboardHref(row.playerId, row.outingId)}
                                className="text-slate-900 transition-smooth hover:text-orange-600 dark:text-zinc-100 dark:hover:text-orange-400"
                              >
                                {row.playerName}
                              </Link>
                              <HandBadge hand={row.pitcherHand} unknown={row.handUnknown} />
                            </td>
                            <td className="whitespace-nowrap px-2 py-3 text-slate-600 dark:text-zinc-400">
                              <Link
                                href={outingDashboardHref(row.playerId, row.outingId)}
                                className="transition-smooth hover:text-orange-600 dark:hover:text-orange-400"
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
                            className={`${rowTransition.className} cursor-pointer border-b border-slate-100 transition-smooth last:border-b-0 hover:bg-slate-50/80 group dark:border-zinc-800 dark:hover:bg-zinc-800/40`}
                            style={rowTransition.style}
                          >
                            <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>
                              {i + 1}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-medium">
                              <Link
                                href={`/player/${row.playerId}`}
                                className="text-slate-900 transition-smooth hover:text-orange-600 dark:text-zinc-100 dark:hover:text-orange-400"
                              >
                                {row.playerName}
                              </Link>
                              <HandBadge hand={row.pitcherHand} unknown={row.handUnknown} />
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600 dark:text-zinc-400">
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
            <p className="mt-4 text-xs text-slate-500 dark:text-zinc-500">
              Aggregated across all outings matching filters. Consistency is exact standard deviation across all pitches.
            </p>
          ) : null}
        </div>
      </div>
    </LeaderboardPageFrame>
  );
}
