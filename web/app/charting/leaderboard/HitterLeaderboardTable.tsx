"use client";

import { useCallback, useMemo, useState } from "react";
import { type AggregatedHitterStats } from "@/lib/charting/analytics";
import { mutedBadgeClasses } from "@/lib/badgeStyles";
import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";

export interface HitterLeaderboardRow extends AggregatedHitterStats {
    hitterName: string;
    opsPlus: number | null;
}

export type SortKey =
    | "sessions"
    | "totalPAs"
    | "avg"
    | "obp"
    | "slg"
    | "ops"
    | "opsPlus"
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

type SortConfig = {
    key: SortKey;
    label: string;
    lowerBetter?: boolean;
    title?: string;
    format?: (val: number | null) => string;
    getValue: (row: HitterLeaderboardRow) => number | null;
};

const SORT_KEYS: SortConfig[] = [
    { key: "sessions", label: "Sessions", lowerBetter: false, getValue: (row) => row.sessions, format: (v) => v?.toString() ?? "—" },
    { key: "totalPAs", label: "PAs", lowerBetter: false, getValue: (row) => row.totalPAs, format: (v) => v?.toString() ?? "—" },
    { key: "avg", label: "AVG", lowerBetter: false, getValue: (row) => row.avg, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—" },
    { key: "obp", label: "OBP", lowerBetter: false, getValue: (row) => row.obp, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—" },
    { key: "slg", label: "SLG", lowerBetter: false, getValue: (row) => row.slg, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—" },
    { key: "ops", label: "OPS", lowerBetter: false, getValue: (row) => row.ops, format: (v) => v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—" },
    { key: "opsPlus", label: "OPS+", lowerBetter: false, title: "100 = all-history Live AB average; no park adjustment", getValue: (row) => row.opsPlus, format: (v) => v !== null ? v.toFixed(0) : "—" },
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

const BASIC_KEYS: SortKey[] = ["sessions", "totalPAs", "opsPlus", "avg", "obp", "slg", "ops", "woba", "kPct", "bbPct"];
const ADVANCED_KEYS: SortKey[] = ["sessions", "totalPAs", "chasePct", "contactPct", "fbWhiff", "brkWhiff", "offWhiff", "zoneSwingPct", "zoneWfPct", "babip", "iso"];

function rankColor(i: number): string {
    const glow = "[text-shadow:0_0_8px_currentColor]";
    if (i === 0) return `text-amber-400 ${glow}`;
    if (i === 1) return `text-zinc-400 ${glow}`;
    if (i === 2) return `text-amber-600 ${glow}`;
    return "text-zinc-500";
}

export type StatGroup = "basic" | "advanced";

function resolveSortConfig(sortKey: SortKey): SortConfig {
    return SORT_KEYS.find((metric) => metric.key === sortKey) ?? SORT_KEYS[0];
}

function opsPlusColumnClasses(): string {
    return "text-center";
}

export function getVisibleColumns(statGroup: StatGroup): SortConfig[] {
    const visibleKeys = statGroup === "basic" ? BASIC_KEYS : ADVANCED_KEYS;
    return visibleKeys.map((key) => resolveSortConfig(key));
}

function sortDirection(sortKey: SortKey, sortDesc: boolean): boolean {
    const config = resolveSortConfig(sortKey);
    return config.lowerBetter === true ? !sortDesc : sortDesc;
}

export function sortHitterLeaderboardRows(
    rows: HitterLeaderboardRow[],
    sortKey: SortKey,
    sortDesc: boolean
): HitterLeaderboardRow[] {
    const config = resolveSortConfig(sortKey);
    const descending = sortDirection(sortKey, sortDesc);

    return [...rows].sort((a, b) => {
        const aVal = config.getValue(a);
        const bVal = config.getValue(b);

        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;

        const diff = aVal - bVal;
        return descending ? -diff : diff;
    });
}

export function HitterLeaderboardTable({
    hitters,
    searchQuery,
    statGroup,
}: {
    hitters: HitterLeaderboardRow[];
    searchQuery: string;
    statGroup: StatGroup;
}) {
    const [sortKey, setSortKey] = useState<SortKey>("opsPlus");
    const [sortDesc, setSortDesc] = useState(true);

    const visibleColumns = useMemo(() => getVisibleColumns(statGroup), [statGroup]);

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return hitters;
        const q = searchQuery.toLowerCase();
        return hitters.filter((hitter) => hitter.hitterName.toLowerCase().includes(q));
    }, [hitters, searchQuery]);

    const sorted = useMemo(() => {
        return sortHitterLeaderboardRows(filtered, sortKey, sortDesc);
    }, [filtered, sortKey, sortDesc]);

    const handleSort = useCallback((key: SortKey) => {
        setSortKey(key);
        setSortDesc((prev) => (
            sortKey === key
                ? !prev
                : resolveSortConfig(key).lowerBetter !== true
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
                        Hitter
                    </th>
                    {visibleColumns.map(({ key, label, title }) => (
                        <th
                            key={key}
                            title={title}
                            className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 cursor-pointer whitespace-nowrap transition-smooth hover:text-emerald-300 ${key === "opsPlus" ? opsPlusColumnClasses() : "text-right"}`}
                            onClick={() => handleSort(key)}
                        >
                            {key === "opsPlus" ? (
                                <span className="flex items-center justify-center gap-1">
                                    <span>{label}</span>
                                    {sortKey === key ? (
                                        <span className="text-emerald-300">
                                            {sortDesc ? "\u25BC" : "\u25B2"}
                                        </span>
                                    ) : null}
                                </span>
                            ) : (
                                <>
                                    {label}
                                    {sortKey === key ? (
                                        <span className="ml-1 text-emerald-300">
                                            {sortDesc ? "\u25BC" : "\u25B2"}
                                        </span>
                                    ) : null}
                                </>
                            )}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {sorted.length === 0 ? (
                    <tr>
                        <td colSpan={visibleColumns.length + 2} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-zinc-500">No hitters match your filters.</span>
                            </div>
                        </td>
                    </tr>
                ) : null}
                {sorted.map((hitter, index) => (
                    <tr
                        key={hitter.hitterName}
                        className="border-b border-zinc-800/50 transition-smooth hover:bg-emerald-500/5 last:border-b-0"
                    >
                        <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(index)}`}>
                            {index + 1}
                        </td>
                        <td className="px-4 py-3">
                            <span className="font-medium text-zinc-100">{hitter.hitterName}</span>
                        </td>
                        {visibleColumns.map(({ key, getValue, format }) => {
                            const val = getValue(hitter);
                            return (
                                <td
                                    key={key}
                                    className={`px-4 py-3 font-mono text-zinc-300 ${key === "opsPlus" ? opsPlusColumnClasses() : "text-right"}`}
                                >
                                    {key === "opsPlus" ? (
                                        <div className="flex w-full justify-center">
                                            {val === null ? (
                                                <span className={`inline-flex min-w-[52px] items-center justify-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${mutedBadgeClasses()}`}>
                                                    —
                                                </span>
                                            ) : (
                                                <span
                                                    className="inline-flex min-w-[52px] items-center justify-center rounded-lg px-2.5 py-1 text-[11px] font-extrabold tracking-tight text-white"
                                                    style={plusMetricBadgeStyle(val)}
                                                >
                                                    {val.toFixed(0)}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        format ? format(val) : val
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
