"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Target, Download, BookOpen } from "lucide-react";
import Breadcrumbs from "@/app/components/Breadcrumbs";
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
import LogoutButton from "@/app/components/LogoutButton";

/* ------------------------------------------------------------------ */
/*  Sort helpers                                                       */
/* ------------------------------------------------------------------ */

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

const DEFAULT_SORT: SortState = { key: "onTargetPct", desc: true };

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
  const diff = (av as number) - (bv as number);
  return s.desc ? -diff : diff;
}

function comparePlayers(a: PlayerAggregateRow, b: PlayerAggregateRow, s: SortState): number {
  const av = a[s.key as keyof PlayerAggregateRow];
  const bv = b[s.key as keyof PlayerAggregateRow];
  if (typeof av === "string" && typeof bv === "string") {
    return s.desc ? bv.localeCompare(av) : av.localeCompare(bv);
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
      className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer select-none hover:text-orange-400/80 whitespace-nowrap transition-smooth"
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
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className="flex rounded-lg overflow-hidden border border-zinc-700/80 bg-zinc-900/60 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-sm font-medium transition-smooth rounded-md ${selected === opt.value
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              }`}
          >
            {opt.display}
          </button>
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
  row: { pitchCount: number; onTargetPct: number; avgMissIn: number; avgHAbsIn: number; avgVAbsIn: number; outlierPct: number; consistencyStdIn: number; commandPlus: number };
  onTargetMin: number;
  onTargetMax: number;
}) {
  const pctForColor =
    onTargetMax > onTargetMin
      ? ((row.onTargetPct - onTargetMin) / (onTargetMax - onTargetMin)) * 100
      : 50;
  const onTargetStyle = savantColorAt(pctForColor);
  return (
    <>
      <td className="px-4 py-3 text-zinc-300 font-mono text-sm">{row.pitchCount}</td>
      <td className="px-4 py-3">
        <span
          className="inline-block font-mono font-bold text-[11px] px-2 py-0.5 rounded"
          style={{ backgroundColor: onTargetStyle.bg, color: onTargetStyle.text }}
        >
          {fmtPct(row.onTargetPct)}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-zinc-300 text-sm">{fmtIn(row.avgMissIn)}</td>
      <td className="px-4 py-3 font-mono text-zinc-300 text-sm">{fmtIn(row.avgHAbsIn)}</td>
      <td className="px-4 py-3 font-mono text-zinc-300 text-sm">{fmtIn(row.avgVAbsIn)}</td>
      <td className="px-4 py-3 font-mono text-zinc-400 text-sm">{fmtPct(row.outlierPct)}</td>
      <td className="px-4 py-3 font-mono text-zinc-400 text-sm">{fmtIn(row.consistencyStdIn)}</td>
      <td className="px-4 py-3">
        <span className={`inline-block font-mono font-bold text-[11px] px-2 py-0.5 rounded ${row.commandPlus >= 100 ? 'bg-orange-500/20 text-orange-400' : 'bg-rose-500/20 text-rose-400'}`}>
          {row.commandPlus.toFixed(0)}
        </span>
      </td>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LeaderboardsPage() {
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

  const escapeCsv = (v: string | number): string => {
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportCsv = useCallback(() => {
    const headers =
      mode === "outings"
        ? ["Rank", "Player", "Date", "Pitches", "On-target %", "Avg Miss (in)", "Avg H (in)", "Avg V (in)", "Outlier %", "Consistency (in)", "Command+"]
        : ["Rank", "Player", "Outings", "Pitches", "On-target %", "Avg Miss (in)", "Avg H (in)", "Avg V (in)", "Outlier %", "Consistency (in)", "Command+"];
    const rows =
      mode === "outings"
        ? displayedOutings.map((r, i) => [
          i + 1,
          r.playerName,
          dateLabel(r.dateId),
          r.pitchCount,
          r.onTargetPct.toFixed(1),
          r.avgMissIn.toFixed(1),
          r.avgHAbsIn.toFixed(1),
          r.avgVAbsIn.toFixed(1),
          r.outlierPct.toFixed(1),
          r.consistencyStdIn.toFixed(1),
          r.commandPlus.toFixed(0),
        ])
        : displayedPlayers.map((r, i) => [
          i + 1,
          r.playerName,
          r.outingCount,
          r.pitchCount,
          r.onTargetPct.toFixed(1),
          r.avgMissIn.toFixed(1),
          r.avgHAbsIn.toFixed(1),
          r.avgVAbsIn.toFixed(1),
          r.outlierPct.toFixed(1),
          r.consistencyStdIn.toFixed(1),
          r.commandPlus.toFixed(0),
        ]);
    const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `command-leaderboard-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [mode, displayedOutings, displayedPlayers]);

  const { onTargetMin, onTargetMax } = useMemo(() => {
    const rows = mode === "outings" ? displayedOutings : displayedPlayers;
    if (rows.length === 0) return { onTargetMin: 0, onTargetMax: 100 };
    const vals = rows.map((r) => r.onTargetPct);
    return {
      onTargetMin: Math.min(...vals),
      onTargetMax: Math.max(...vals),
    };
  }, [mode, displayedOutings, displayedPlayers]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 relative">
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Command", href: "/command" }, { label: "Leaderboards" }]} />
        <div className="flex items-start justify-between gap-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <Target className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
                Team Leaderboards
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Command metrics by outing or player
              </p>
            </div>
          </div>

          <Link
            href="/leaderboards/faq"
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-orange-500/50 hover:bg-zinc-800 text-sm text-zinc-300 hover:text-white transition-all shadow-sm group"
          >
            <BookOpen className="w-4 h-4 text-orange-400 group-hover:text-orange-300" />
            Metrics Dictionary
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
        <Segment<LeaderboardMode>
          label="Mode"
          options={[
            { value: "outings", display: "Outings" },
            { value: "players", display: "Players" },
          ]}
          selected={mode}
          onChange={setMode}
        />

        <Segment
          label="Season"
          options={[
            { value: "2025", display: "2025" },
            { value: "2026", display: "2026" },
            { value: "both", display: "Both" },
          ]}
          selected={String(seasonFilter)}
          onChange={(v) => setSeasonFilter(v === "both" ? "both" : (Number(v) as SeasonFilter))}
        />

        <Segment
          label="Hand"
          options={[
            { value: "ALL", display: "All" },
            { value: "R", display: "RHP" },
            { value: "L", display: "LHP" },
          ]}
          selected={handFilter}
          onChange={setHandFilter}
        />

        <Segment
          label="Pitches"
          options={[
            { value: "ALL", display: "Overall" },
            { value: "FASTBALL", display: "Fastballs" },
            { value: "BREAKING", display: "Breaking Balls" },
          ]}
          selected={pitchGroup}
          onChange={setPitchGroup}
        />

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player..."
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 w-48 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-smooth"
        />

        {loading && progress.total > 0 && (
          <span className="text-xs text-zinc-500 font-medium">
            Loading {progress.loaded}/{progress.total} outings...
          </span>
        )}
        {!loading && (
          <span className="text-xs font-semibold text-orange-400/80">
            {rowCount} {mode === "outings" ? "outing" : "player"}{rowCount !== 1 ? "s" : ""}
          </span>
        )}
        {!loading && rowCount > 0 && (
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-smooth text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/30 shadow-xl shadow-black/20 max-h-[70vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-12">
                #
              </th>
              <Col label="Player" sortKey="playerName" sort={sort} onSort={handleSort} />
              {mode === "outings" ? (
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Date
                </th>
              ) : (
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Outings
                </th>
              )}
              <Col label="Pitches" sortKey="pitchCount" sort={sort} onSort={handleSort} />
              <Col label="On-target %" sortKey="onTargetPct" sort={sort} onSort={handleSort} title="Pitches within 8 inches" />
              <Col label="Avg Miss" sortKey="avgMissIn" sort={sort} onSort={handleSort} title="Average total miss (inches)" />
              <Col label="Avg H" sortKey="avgHAbsIn" sort={sort} onSort={handleSort} title="Average horizontal miss (inches, absolute)" />
              <Col label="Avg V" sortKey="avgVAbsIn" sort={sort} onSort={handleSort} title="Average vertical miss (inches, absolute)" />
              <Col label="Outlier %" sortKey="outlierPct" sort={sort} onSort={handleSort} title="Pitches beyond 20 inches" />
              <Col label="Consistency" sortKey="consistencyStdIn" sort={sort} onSort={handleSort} title="Std dev of total miss (lower = more consistent)" />
              <Col label="Command+" sortKey="commandPlus" sort={sort} onSort={handleSort} title="Pitch-weighted command relative to team average (100 = average, >100 is better)" />
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 8 }, (_, i) => (
                <SkeletonRow key={i} i={i} cols={9} />
              ))}
            {!loading && rowCount === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-zinc-500">
                      No {mode === "outings" ? "outings" : "players"} found for the selected filters.
                    </span>
                    {search.trim() && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="text-sm font-medium text-orange-400 hover:text-orange-300 transition-smooth"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {/* Outings mode */}
            {!loading && mode === "outings" &&
              displayedOutings.map((row, i) => (
                <tr
                  key={row.outingId}
                  className="border-b border-zinc-800/50 hover:bg-orange-500/5 transition-smooth cursor-pointer group"
                >
                  <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>
                    {i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    <Link
                      href={`/player/${row.playerId}/report?outingId=${row.outingId}`}
                      className="hover:text-orange-400 transition-smooth"
                    >
                      {row.playerName}
                    </Link>
                    <HandBadge hand={row.pitcherHand} unknown={row.handUnknown} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                    <Link
                      href={`/player/${row.playerId}/report?outingId=${row.outingId}`}
                      className="hover:text-zinc-200 transition-smooth"
                    >
                      {dateLabel(row.dateId)}
                    </Link>
                  </td>
                  <KpiCells row={row} onTargetMin={onTargetMin} onTargetMax={onTargetMax} />
                </tr>
              ))}

            {/* Players mode */}
            {!loading && mode === "players" &&
              displayedPlayers.map((row, i) => (
                <tr
                  key={row.playerId}
                  className="border-b border-zinc-800/50 hover:bg-orange-500/5 transition-smooth cursor-pointer group"
                >
                  <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>
                    {i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    <Link
                      href={`/player/${row.playerId}`}
                      className="hover:text-orange-400 transition-smooth"
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
              ))}
          </tbody>
        </table>
      </div>

      {/* Aggregate subtext */}
      {!loading && mode === "players" && displayedPlayers.length > 0 && (
        <p className="mt-4 text-xs text-zinc-500">
          Aggregated across all outings matching filters. Consistency is exact standard deviation across all pitches.
        </p>
      )}
    </div>
  );
}
