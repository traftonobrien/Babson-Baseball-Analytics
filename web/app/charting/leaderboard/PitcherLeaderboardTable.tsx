"use client";

import { useCallback, useMemo, useState } from "react";
import { type AggregatedPitcherStats } from "@/lib/charting/analytics";

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
    const glow = "[text-shadow:0_0_8px_currentColor]";
    if (i === 0) return `text-amber-400 ${glow}`;
    if (i === 1) return `text-zinc-400 ${glow}`;
    if (i === 2) return `text-amber-600 ${glow}`;
    return "text-zinc-500";
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
        <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
                <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-400 w-12">
                        #
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-400 w-48">
                        Pitcher
                    </th>
                    {visibleSortKeys.map(({ key, label }) => (
                        <th
                            key={key}
                            className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-400 cursor-pointer whitespace-nowrap transition-smooth hover:text-emerald-300"
                            onClick={() => handleSort(key)}
                        >
                            {label}
                            {sortKey === key ? (
                                <span className="ml-1 text-emerald-300">
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
                                <span className="text-zinc-500">No pitchers match your filters.</span>
                            </div>
                        </td>
                    </tr>
                ) : null}
                {sorted.map((pitcher, index) => (
                    <tr
                        key={pitcher.playerId || pitcher.displayName}
                        className="border-b border-zinc-800/50 transition-smooth hover:bg-emerald-500/5 last:border-b-0"
                    >
                        <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(index)}`}>
                            {index + 1}
                        </td>
                        <td className="px-4 py-3">
                            <span className="font-medium text-zinc-100">{pitcher.displayName}</span>
                        </td>
                        {visibleSortKeys.map(({ key, format }) => {
                            const val = pitcher[key] as number | null;
                            return (
                                <td key={key} className="px-4 py-3 text-right font-mono text-zinc-300">
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
