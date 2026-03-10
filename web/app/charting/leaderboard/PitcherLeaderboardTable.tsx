"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { type AggregatedPitcherStats } from "@/lib/charting/analytics";

export interface PitcherLeaderboardRow extends AggregatedPitcherStats {
    playerId: string | null;
    displayName: string;
}

type SortKey = keyof Omit<PitcherLeaderboardRow, "playerId" | "displayName" | "pitchMix" | "pitchMixPct">;

const SORT_KEYS: { key: SortKey; label: string; lowerBetter?: boolean; format?: (val: number | null) => string }[] = [
    { key: "sessions", label: "Sessions", lowerBetter: false, format: (v) => v?.toString() ?? "—" },
    { key: "innings", label: "Innings", lowerBetter: false, format: (v) => v?.toString() ?? "—" },
    { key: "totalPitches", label: "Pitches", lowerBetter: false, format: (v) => v?.toString() ?? "—" },
    { key: "strikePct", label: "Strike%", lowerBetter: false, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "zonePct", label: "Zone%", lowerBetter: false, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "whiffPct", label: "Whiff%", lowerBetter: false, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "chasePct", label: "Chase%", lowerBetter: false, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "fpsPct", label: "FPS%", lowerBetter: false, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "kPct", label: "K%", lowerBetter: false, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "bbPct", label: "BB%", lowerBetter: true, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
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
}: {
    pitchers: PitcherLeaderboardRow[];
    searchQuery: string;
}) {
    const [sortKey, setSortKey] = useState<SortKey>("innings");
    const [sortDesc, setSortDesc] = useState(true);

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return pitchers;
        const q = searchQuery.toLowerCase();
        return pitchers.filter((p) => p.displayName.toLowerCase().includes(q));
    }, [pitchers, searchQuery]);

    const sorted = useMemo(() => {
        const config = SORT_KEYS.find((s) => s.key === sortKey);
        const desc = config?.lowerBetter !== undefined ? !config.lowerBetter === sortDesc : sortDesc;

        return [...filtered].sort((a, b) => {
            const aVal = a[sortKey] as number | null;
            const bVal = b[sortKey] as number | null;

            if (aVal === null && bVal === null) return 0;
            if (aVal === null) return 1; // nulls always at bottom
            if (bVal === null) return -1;

            const diff = aVal - bVal;
            return desc ? -diff : diff;
        });
    }, [filtered, sortKey, sortDesc]);

    const handleSort = useCallback((key: SortKey) => {
        setSortKey(key);
        setSortDesc((prev) => (sortKey === key ? !prev : (SORT_KEYS.find((s) => s.key === key)?.lowerBetter === false)));
    }, [sortKey]);

    return (
        <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm shadow-[0_1px_0_rgba(255,255,255,0.05)]">
                    <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-12">
                            #
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-48">
                            Pitcher
                        </th>
                        {SORT_KEYS.map(({ key, label }) => (
                            <th
                                key={key}
                                className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-emerald-300 transition-colors whitespace-nowrap select-none"
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
                            <td colSpan={SORT_KEYS.length + 2} className="px-4 py-12 text-center">
                                <div className="flex flex-col items-center justify-center text-zinc-500">
                                    No pitchers match your filters.
                                </div>
                            </td>
                        </tr>
                    ) : null}
                    {sorted.map((p, i) => (
                        <tr
                            key={p.playerId || p.displayName}
                            className={`border-b border-zinc-900/80 transition-smooth hover:bg-emerald-500/5 last:border-b-0`}
                        >
                            <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>
                                {i + 1}
                            </td>
                            <td className="px-4 py-3 font-medium">
                                <span className="font-semibold text-zinc-100 hover:text-emerald-300 transition-smooth cursor-default">
                                    {p.displayName}
                                </span>
                            </td>
                            {SORT_KEYS.map(({ key, format }) => {
                                const val = p[key] as number | null;
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
        </div>
    );
}
