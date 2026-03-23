"use client";

import { useCallback, useMemo, useState } from "react";
import { type AggregatedHitterStats } from "@/lib/charting/analytics";

export interface HitterLeaderboardRow extends AggregatedHitterStats {
    hitterName: string;
}

type SortKey =
    | "sessions"
    | "totalPAs"
    | "avg"
    | "obp"
    | "slg"
    | "ops"
    | "woba"
    | "chasePct"
    | "contactPct"
    | "kPct"
    | "bbPct"
    | "fbWhiff"
    | "brkWhiff"
    | "offWhiff"
    | "zoneSwingPct"
    | "zoneWfPct"
    | "babip"
    | "iso";

const SORT_KEYS: { key: SortKey; label: string; lowerBetter?: boolean; format?: (val: number | null) => string; getValue: (row: HitterLeaderboardRow) => number | null }[] = [
    { key: "sessions", label: "Sessions", lowerBetter: false, getValue: (row) => row.sessions, format: (v) => v?.toString() ?? "—" },
    { key: "totalPAs", label: "PAs", lowerBetter: false, getValue: (row) => row.totalPAs, format: (v) => v?.toString() ?? "—" },
    { key: "avg", label: "AVG", lowerBetter: false, getValue: (row) => row.avg, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—" },
    { key: "obp", label: "OBP", lowerBetter: false, getValue: (row) => row.obp, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—" },
    { key: "slg", label: "SLG", lowerBetter: false, getValue: (row) => row.slg, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—" },
    { key: "ops", label: "OPS", lowerBetter: false, getValue: (row) => row.ops, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—" },
    { key: "woba", label: "wOBA", lowerBetter: false, getValue: (row) => row.woba, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—" },
    { key: "chasePct", label: "Chase%", lowerBetter: true, getValue: (row) => row.chasePct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "contactPct", label: "Contact%", lowerBetter: false, getValue: (row) => row.contactPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "kPct", label: "K%", lowerBetter: true, getValue: (row) => row.kPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "bbPct", label: "BB%", lowerBetter: false, getValue: (row) => row.bbPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "fbWhiff", label: "FB Whiff%", lowerBetter: true, getValue: (row) => row.vsFastball.whiffPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "brkWhiff", label: "BRK Whiff%", lowerBetter: true, getValue: (row) => row.vsBreaking.whiffPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "offWhiff", label: "OFF Whiff%", lowerBetter: true, getValue: (row) => row.vsOffspeed.whiffPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "zoneSwingPct", label: "Z-Swing%", lowerBetter: false, getValue: (row) => row.zoneSwingPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "zoneWfPct", label: "Z-Whiff%", lowerBetter: true, getValue: (row) => row.zoneWfPct, format: (v) => v !== null ? `${v.toFixed(1)}%` : "—" },
    { key: "babip", label: "BABIP", lowerBetter: false, getValue: (row) => row.babip, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—" },
    { key: "iso", label: "ISO", lowerBetter: false, getValue: (row) => row.iso, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—" },
];

const BASIC_KEYS: SortKey[] = ["sessions", "totalPAs", "avg", "obp", "slg", "ops", "woba", "chasePct", "contactPct", "kPct", "bbPct"];
const ADVANCED_KEYS: SortKey[] = ["sessions", "totalPAs", "fbWhiff", "brkWhiff", "offWhiff", "zoneSwingPct", "zoneWfPct", "babip", "iso"];

function rankColor(i: number): string {
    const glow = "[text-shadow:0_0_6px_rgba(234,179,8,0.35)]";
    if (i === 0) return `text-amber-600 ${glow} dark:text-amber-400`;
    if (i === 1) return `text-slate-400 ${glow} dark:text-zinc-400`;
    if (i === 2) return `text-amber-700 ${glow} dark:text-amber-500`;
    return "text-slate-500 dark:text-zinc-400";
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
    const visibleColumns = SORT_KEYS.filter((metric) => visibleKeys.includes(metric.key));

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return hitters;
        const q = searchQuery.toLowerCase();
        return hitters.filter((hitter) => hitter.hitterName.toLowerCase().includes(q));
    }, [hitters, searchQuery]);

    const sorted = useMemo(() => {
        const config = SORT_KEYS.find((metric) => metric.key === sortKey);
        const desc = config?.lowerBetter !== undefined ? !config.lowerBetter === sortDesc : sortDesc;

        return [...filtered].sort((a, b) => {
            const aVal = config?.getValue(a) ?? null;
            const bVal = config?.getValue(b) ?? null;

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
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900/85">
                <tr>
                    <th className="w-12 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        #
                    </th>
                    <th className="w-48 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        Hitter
                    </th>
                    {visibleColumns.map(({ key, label }) => (
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
                        <td colSpan={visibleColumns.length + 2} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-slate-500 dark:text-zinc-400">No hitters match your filters.</span>
                            </div>
                        </td>
                    </tr>
                ) : null}
                {sorted.map((hitter, index) => (
                    <tr
                        key={hitter.hitterName}
                        className="border-b border-slate-100 transition-smooth last:border-b-0 hover:bg-slate-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                    >
                        <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(index)}`}>
                            {index + 1}
                        </td>
                        <td className="px-4 py-3">
                            <span className="font-medium text-slate-900 dark:text-zinc-100">{hitter.hitterName}</span>
                        </td>
                        {visibleColumns.map(({ key, getValue, format }) => {
                            const val = getValue(hitter);
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
