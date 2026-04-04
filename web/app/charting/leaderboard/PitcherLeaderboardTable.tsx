"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { type AggregatedPitcherStats } from "@/lib/charting/analytics";
import { getCanonicalPlayerId, getSlugForPlayerId } from "@/lib/canonicalPlayers";

export interface PitcherLeaderboardRow extends AggregatedPitcherStats {
    playerId: string | null;
    displayName: string;
}

export type StatGroup = "basic" | "advanced";

type SortKey = keyof Omit<PitcherLeaderboardRow, "playerId" | "displayName" | "pitchMix" | "pitchMixPct">;

const SORT_KEYS: { key: SortKey; label: string; lowerBetter?: boolean; format?: (val: number | null) => string }[] = [
    { key: "sessions", label: "Sessions", lowerBetter: false, format: (v) => v?.toString() ?? "—" },
    { key: "innings", label: "Innings", lowerBetter: false, format: (v) => v?.toString() ?? "—" },
    { key: "totalPitches", label: "Pitches", lowerBetter: false, format: (v) => v?.toString() ?? "—" },
    { key: "totalPAs", label: "TBF", lowerBetter: false, format: (v) => v?.toString() ?? "—" },
    { key: "strikePct", label: "Strike%", lowerBetter: false, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "zonePct", label: "Zone%", lowerBetter: false, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "whiffPct", label: "Whiff%", lowerBetter: false, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "chasePct", label: "Chase%", lowerBetter: false, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "fpsPct", label: "FPS%", lowerBetter: false, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
];

const BASIC_KEYS: SortKey[] = [
    "sessions",
    "innings",
    "totalPitches",
    "totalPAs",
    "strikePct",
    "zonePct",
    "fpsPct",
];
const ADVANCED_KEYS: SortKey[] = [
    "sessions",
    "innings",
    "totalPitches",
    "totalPAs",
    "whiffPct",
    "chasePct",
    "strikePct",
    "zonePct",
];

function rankColor(i: number): string {
    const glow = "[text-shadow:0_0_6px_rgba(234,179,8,0.35)]";
    if (i === 0) return `text-amber-600 ${glow} dark:text-amber-400`;
    if (i === 1) return `text-slate-400 ${glow} dark:text-zinc-400`;
    if (i === 2) return `text-amber-700 ${glow} dark:text-amber-500`;
    return "text-slate-500 dark:text-zinc-400";
}

function pitcherProfileHref(playerId: string | null, displayName: string): string | null {
    const canonicalId = playerId ?? getCanonicalPlayerId(displayName);
    if (!canonicalId) {
        return null;
    }

    const playerSlug = getSlugForPlayerId(canonicalId);
    return playerSlug ? `/players/${playerSlug}?tab=charting` : null;
}

export function PitcherLeaderboardTable({
    pitchers,
    searchQuery,
    statGroup,
}: {
    pitchers: PitcherLeaderboardRow[];
    searchQuery: string;
    statGroup: StatGroup;
}) {
    const [sortKey, setSortKey] = useState<SortKey>("strikePct");
    const [sortDesc, setSortDesc] = useState(true);

    const visibleColumns = statGroup === "basic" ? BASIC_KEYS : ADVANCED_KEYS;
    const visibleSortKeys = SORT_KEYS.filter((metric) => visibleColumns.includes(metric.key));

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return pitchers;
        const q = searchQuery.toLowerCase();
        return pitchers.filter((pitcher) => pitcher.displayName.toLowerCase().includes(q));
    }, [pitchers, searchQuery]);

    const sorted = useMemo(() => {
        const config = SORT_KEYS.find((metric) => metric.key === sortKey);
        const desc = config?.lowerBetter !== undefined ? !config.lowerBetter === sortDesc : sortDesc;

        return [...filtered].sort((a, b) => {
            const aVal = a[sortKey] as number | null;
            const bVal = b[sortKey] as number | null;

            if (aVal === null && bVal === null) return 0;
            if (aVal === null) return 1;
            if (bVal === null) return -1;

            const diff = aVal - bVal;
            return desc ? -diff : diff;
        });
    }, [filtered, sortKey, sortDesc]);

    const handleSort = useCallback((key: SortKey) => {
        setSortKey(key);
        setSortDesc((prev) => (
            sortKey === key
                ? !prev
                : SORT_KEYS.find((metric) => metric.key === key)?.lowerBetter === false
        ));
    }, [sortKey]);

    return (
        <table className="leaderboard-print-table w-full text-sm">
            <thead className="leaderboard-print-sticky-head sticky top-0 z-10 border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900/85">
                <tr>
                    <th className="w-12 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        #
                    </th>
                    <th className="w-48 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        Pitcher
                    </th>
                    {visibleSortKeys.map(({ key, label }) => (
                        <th
                            key={key}
                            className="cursor-pointer whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-smooth hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400"
                            onClick={() => handleSort(key)}
                        >
                            {label}
                            {sortKey === key ? (
                                <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                                    {sortDesc ? "\u25BC" : "\u25B2"}
                                </span>
                            ) : null}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {sorted.length === 0 ? (
                    <tr>
                        <td colSpan={visibleSortKeys.length + 2} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-slate-500 dark:text-zinc-400">No pitchers match your filters.</span>
                            </div>
                        </td>
                    </tr>
                ) : null}
                {sorted.map((pitcher, index) => (
                    <tr
                        key={pitcher.playerId || pitcher.displayName}
                        className="border-b border-slate-100 transition-smooth last:border-b-0 hover:bg-slate-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                    >
                        <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(index)}`}>
                            {index + 1}
                        </td>
                        <td className="px-4 py-3">
                            {(() => {
                                const href = pitcherProfileHref(pitcher.playerId, pitcher.displayName);
                                if (!href) {
                                    return (
                                        <span className="font-medium text-slate-900 dark:text-zinc-100">
                                            {pitcher.displayName}
                                        </span>
                                    );
                                }

                                return (
                                    <Link
                                        href={href}
                                        className="font-medium text-slate-900 transition-smooth hover:text-emerald-700 dark:text-zinc-100 dark:hover:text-emerald-400"
                                    >
                                        {pitcher.displayName}
                                    </Link>
                                );
                            })()}
                        </td>
                        {visibleSortKeys.map(({ key, format }) => {
                            const val = pitcher[key] as number | null;
                            return (
                                <td key={key} className="px-4 py-3 text-right font-mono text-slate-700 dark:text-zinc-300">
                                    {format ? format(val) : val}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
