"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { type AggregatedHitterStats } from "@/lib/charting/analytics";

export interface HitterLeaderboardRow extends AggregatedHitterStats {
    hitterName: string;
}

type SortKey = "sessions" | "totalPAs" | "avg" | "obp" | "slg" | "ops" | "chasePct" | "contactPct" | "kPct" | "bbPct" | "fbWhiff" | "brkWhiff" | "offWhiff" | "zoneSwingPct" | "zoneWfPct" | "babip" | "iso";

const SORT_KEYS: { key: SortKey; label: string; lowerBetter?: boolean; format?: (val: number | null) => string; getValue: (row: HitterLeaderboardRow) => number | null }[] = [
    { key: "sessions", label: "Sessions", lowerBetter: false, getValue: (row) => row.sessions, format: (v) => v?.toString() ?? "—" },
    { key: "totalPAs", label: "PAs", lowerBetter: false, getValue: (row) => row.totalPAs, format: (v) => v?.toString() ?? "—" },
    { key: "avg", label: "AVG", lowerBetter: false, getValue: (row) => row.avg, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, '.') : "—" },
    { key: "obp", label: "OBP", lowerBetter: false, getValue: (row) => row.obp, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, '.') : "—" },
    { key: "slg", label: "SLG", lowerBetter: false, getValue: (row) => row.slg, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, '.') : "—" },
    { key: "ops", label: "OPS", lowerBetter: false, getValue: (row) => row.ops, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, '.') : "—" },
    { key: "chasePct", label: "Chase%", lowerBetter: true, getValue: (row) => row.chasePct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "contactPct", label: "Contact%", lowerBetter: false, getValue: (row) => row.contactPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "kPct", label: "K%", lowerBetter: true, getValue: (row) => row.kPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "bbPct", label: "BB%", lowerBetter: false, getValue: (row) => row.bbPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "fbWhiff", label: "FB Whiff%", lowerBetter: true, getValue: (row) => row.vsFastball.whiffPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "brkWhiff", label: "BRK Whiff%", lowerBetter: true, getValue: (row) => row.vsBreaking.whiffPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "offWhiff", label: "OFF Whiff%", lowerBetter: true, getValue: (row) => row.vsOffspeed.whiffPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "zoneSwingPct", label: "Z-Swing%", lowerBetter: false, getValue: (row) => row.zoneSwingPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "zoneWfPct", label: "Z-Whiff%", lowerBetter: true, getValue: (row) => row.zoneWfPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "babip", label: "BABIP", lowerBetter: false, getValue: (row) => row.babip, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, '.') : "—" },
    { key: "iso", label: "ISO", lowerBetter: false, getValue: (row) => row.iso, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, '.') : "—" },
];

const BASIC_KEYS: SortKey[] = ["sessions", "totalPAs", "avg", "obp", "slg", "ops", "chasePct", "contactPct", "kPct", "bbPct"];
const ADVANCED_KEYS: SortKey[] = ["sessions", "totalPAs", "fbWhiff", "brkWhiff", "offWhiff", "zoneSwingPct", "zoneWfPct", "babip", "iso"];

function rankColor(i: number): string {
    const glow = "[text-shadow:0_0_8px_currentColor]";
    if (i === 0) return `text-amber-400 ${glow}`;
    if (i === 1) return `text-zinc-400 ${glow}`;
    if (i === 2) return `text-amber-600 ${glow}`;
    return "text-zinc-500";
}

export type StatGroup = "basic" | "advanced";

export function HitterLeaderboardTable({
    hitters,
    searchQuery,
    statGroup,
}: {
    hitters: HitterLeaderboardRow[];
    searchQuery: string;
    statGroup: StatGroup;
}) {
    const [sortKey, setSortKey] = useState<SortKey>("avg");
    const [sortDesc, setSortDesc] = useState(true);

    const visibleKeys = statGroup === "basic" ? BASIC_KEYS : ADVANCED_KEYS;
    const visibleColumns = SORT_KEYS.filter((k) => visibleKeys.includes(k.key));

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return hitters;
        const q = searchQuery.toLowerCase();
        return hitters.filter((h) => h.hitterName.toLowerCase().includes(q));
    }, [hitters, searchQuery]);

    const sorted = useMemo(() => {
        const config = SORT_KEYS.find((s) => s.key === sortKey);
        const desc = config?.lowerBetter !== undefined ? !config.lowerBetter === sortDesc : sortDesc;

        return [...filtered].sort((a, b) => {
            const aVal = config?.getValue(a) ?? null;
            const bVal = config?.getValue(b) ?? null;

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
        <div className="flex flex-col gap-4">
            <div className="max-h-[70vh] overflow-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm shadow-[0_1px_0_rgba(255,255,255,0.05)]">
                        <tr>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-12">
                                #
                            </th>
                            <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-48">
                                Hitter
                            </th>
                            {visibleColumns.map(({ key, label }) => (
                                <th
                                    key={key}
                                    className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-sky-300 transition-colors whitespace-nowrap select-none"
                                    onClick={() => handleSort(key)}
                                >
                                    {label}
                                    {sortKey === key ? (
                                        <span className="ml-1 text-sky-300">
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
                                        No hitters match your filters.
                                    </div>
                                </td>
                            </tr>
                        ) : null}
                        {sorted.map((h, i) => (
                            <tr
                                key={h.hitterName}
                                className={`border-b border-zinc-900/80 transition-smooth hover:bg-emerald-500/5 last:border-b-0`}
                            >
                                <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>
                                    {i + 1}
                                </td>
                                <td className="px-4 py-3 font-medium">
                                    <span className="font-semibold text-zinc-100 hover:text-emerald-300 transition-smooth cursor-default">
                                        {h.hitterName}
                                    </span>
                                </td>
                                {visibleColumns.map(({ key, getValue, format }) => {
                                    const val = getValue(h);
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
        </div>
    );
}
