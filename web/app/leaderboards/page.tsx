"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadAllLeaderboardData,
  type LoadOptions,
} from "@/lib/leaderboards/load";
import type {
  OutingLeaderboardRow,
  SeasonFilter,
} from "@/lib/leaderboards/types";
import LogoutButton from "@/app/components/LogoutButton";

/* ------------------------------------------------------------------ */
/*  Sort helpers                                                       */
/* ------------------------------------------------------------------ */

type SortKey = keyof Pick<
  OutingLeaderboardRow,
  | "onTargetPct"
  | "avgMissIn"
  | "avgHAbsIn"
  | "avgVAbsIn"
  | "outlierPct"
  | "consistencyStdIn"
  | "pitchCount"
  | "playerName"
>;

interface SortState {
  key: SortKey;
  desc: boolean;
}

const DEFAULT_SORT: SortState = { key: "onTargetPct", desc: true };

function compare(a: OutingLeaderboardRow, b: OutingLeaderboardRow, s: SortState): number {
  const av = a[s.key];
  const bv = b[s.key];
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
/*  Skeleton row                                                       */
/* ------------------------------------------------------------------ */

function SkeletonRow({ i }: { i: number }) {
  return (
    <tr className="border-b border-zinc-800 animate-pulse">
      <td className="px-3 py-2 text-zinc-600">{i + 1}</td>
      {Array.from({ length: 9 }, (_, j) => (
        <td key={j} className="px-3 py-2">
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
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  title?: string;
}

function Col({ label, sortKey, sort, onSort, title }: ColProps) {
  const active = sort.key === sortKey;
  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-200 whitespace-nowrap"
      onClick={() => onSort(sortKey)}
      title={title}
    >
      {label}
      {active && (
        <span className="ml-1 text-zinc-300">
          {sort.desc ? "\u25BC" : "\u25B2"}
        </span>
      )}
    </th>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LeaderboardsPage() {
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("both");
  const [rows, setRows] = useState<OutingLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [search, setSearch] = useState("");

  // Load data
  const load = useCallback(
    (filter: SeasonFilter) => {
      setLoading(true);
      setRows([]);
      setProgress({ loaded: 0, total: 0 });

      const opts: LoadOptions = {
        seasonFilter: filter,
        minPitches: 5,
        onProgress: (loaded, total) => setProgress({ loaded, total }),
      };

      loadAllLeaderboardData(opts)
        .then((data) => {
          setRows(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("[Leaderboards] Load failed:", err);
          setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    load(seasonFilter);
  }, [seasonFilter, load]);

  // Sort toggle
  const handleSort = useCallback(
    (key: SortKey) => {
      setSort((prev) =>
        prev.key === key ? { key, desc: !prev.desc } : { key, desc: key !== "playerName" && key !== "avgMissIn" && key !== "avgHAbsIn" && key !== "avgVAbsIn" && key !== "consistencyStdIn" && key !== "outlierPct" },
      );
    },
    [],
  );

  // Filter + sort
  const displayed = useMemo(() => {
    let filtered = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = rows.filter((r) => r.playerName.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => compare(a, b, sort));
  }, [rows, search, sort]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 relative">
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>

      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/"
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
          >
            &larr; Home
          </Link>
          <h1 className="text-2xl font-semibold">Team Leaderboards</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Season filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 uppercase tracking-wider">Season</span>
            <div className="flex rounded-md overflow-hidden border border-zinc-700">
              {([2025, 2026, "both"] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => setSeasonFilter(val)}
                  className={`px-3 py-1 text-sm transition-colors ${
                    seasonFilter === val
                      ? "bg-zinc-700 text-zinc-100"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {val === "both" ? "Both" : val}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player..."
            className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1 text-sm text-zinc-100 placeholder-zinc-500 w-48 focus:outline-none focus:border-zinc-500"
          />

          {/* Progress */}
          {loading && progress.total > 0 && (
            <span className="text-xs text-zinc-500">
              Loading {progress.loaded}/{progress.total} outings...
            </span>
          )}
          {!loading && (
            <span className="text-xs text-zinc-500">
              {displayed.length} outing{displayed.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider w-10">
                  #
                </th>
                <Col label="Player" sortKey="playerName" sort={sort} onSort={handleSort} />
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Date
                </th>
                <Col label="Pitches" sortKey="pitchCount" sort={sort} onSort={handleSort} />
                <Col label="On-target %" sortKey="onTargetPct" sort={sort} onSort={handleSort} title="Pitches within 8 inches" />
                <Col label="Avg Miss" sortKey="avgMissIn" sort={sort} onSort={handleSort} title="Average total miss (inches)" />
                <Col label="Avg H" sortKey="avgHAbsIn" sort={sort} onSort={handleSort} title="Average horizontal miss (inches, absolute)" />
                <Col label="Avg V" sortKey="avgVAbsIn" sort={sort} onSort={handleSort} title="Average vertical miss (inches, absolute)" />
                <Col label="Outlier %" sortKey="outlierPct" sort={sort} onSort={handleSort} title="Pitches beyond 20 inches" />
                <Col label="Consistency" sortKey="consistencyStdIn" sort={sort} onSort={handleSort} title="Std dev of total miss (lower = more consistent)" />
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 8 }, (_, i) => (
                  <SkeletonRow key={i} i={i} />
                ))}
              {!loading && displayed.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                    No outings found for the selected filters.
                  </td>
                </tr>
              )}
              {!loading &&
                displayed.map((row, i) => (
                  <tr
                    key={row.outingId}
                    className="border-b border-zinc-800 hover:bg-zinc-900/60 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2 text-zinc-500 font-mono text-xs">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      <Link
                        href={`/player/${row.playerId}/report?outingId=${row.outingId}`}
                        className="hover:text-blue-400 transition-colors"
                      >
                        {row.playerName}
                      </Link>
                      {row.handUnknown && (
                        <span
                          className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 font-normal"
                          title="Pitcher hand not found in Arsenals.csv; defaulted to R"
                        >
                          Hand unknown
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                      <Link
                        href={`/player/${row.playerId}/report?outingId=${row.outingId}`}
                        className="hover:text-zinc-200 transition-colors"
                      >
                        {dateLabel(row.dateId)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-300 font-mono">{row.pitchCount}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-emerald-400">
                      {fmtPct(row.onTargetPct)}
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-300">{fmtIn(row.avgMissIn)}</td>
                    <td className="px-3 py-2 font-mono text-zinc-300">{fmtIn(row.avgHAbsIn)}</td>
                    <td className="px-3 py-2 font-mono text-zinc-300">{fmtIn(row.avgVAbsIn)}</td>
                    <td className="px-3 py-2 font-mono text-zinc-400">{fmtPct(row.outlierPct)}</td>
                    <td className="px-3 py-2 font-mono text-zinc-400">{fmtIn(row.consistencyStdIn)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
