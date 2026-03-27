"use client";

import { useState, useEffect, useMemo } from "react";
import type { Pitch } from "../types";
import { computeCommandPlus, listCommandPlusBaselines } from "@/lib/commandPlus";
import { globalCommandPlusBaselines, loadAllOutingData } from "@/lib/leaderboards/load";
import { seasonFromDateId } from "@/lib/season";
import type { SeasonFilter } from "@/lib/leaderboards/types";
import { brandSoftEyebrowTextClasses, brandSoftPillClasses } from "@/lib/brandSurfaces";
import { plusMetricBadgeStyle, plusMetricSurfaceClassesLight } from "@/lib/stuffPlusUtils";
import { cn } from "@/lib/utils";
import { sortPitchTypes } from "@/lib/pitchTypeOrder";
import TeamAveragesBar, { type PitchCommandTableRow } from "./TeamAveragesBar";

interface Props {
    pitches: Pitch[];
    outingId: string;
}

const MIN_PITCH_COUNT = 3;

interface PitchPlus {
    type: string;
    count: number;
    score: number | null;
    qualified: boolean;
    baselineAvgMiss: number | null;
}

export default function CommandPlusSection({ pitches, outingId }: Props) {
    const season = seasonFromDateId(outingId.split("/")[1]) ?? null;
    const [loadedSeason, setLoadedSeason] = useState<SeasonFilter | null>(null);

    useEffect(() => {
        if (!season || globalCommandPlusBaselines[season] || loadedSeason === season) {
            return;
        }
        let active = true;
        loadAllOutingData({ seasonFilter: season as SeasonFilter }).then(() => {
            if (!active) return;
            setLoadedSeason(season as SeasonFilter);
        });
        return () => {
            active = false;
        };
    }, [loadedSeason, season]);
    const baselinesLoaded = !season || Boolean(globalCommandPlusBaselines[season]) || loadedSeason === season;

    const data = useMemo(() => {
        if (!season || !baselinesLoaded || pitches.length === 0) return null;
        const seasonBaselines = globalCommandPlusBaselines[season];
        if (!seasonBaselines) return null;
        const result = computeCommandPlus(pitches, seasonBaselines, {
            minPitchTypeCount: MIN_PITCH_COUNT,
        });

        const pitchBreakdown: PitchPlus[] = sortPitchTypes(
            result.pitchTypeScores.map((entry) => ({
                type: entry.pitchType,
                count: entry.subjectCount,
                score: entry.score,
                qualified: entry.eligible,
                baselineAvgMiss: entry.baselineAvgMiss,
            })),
            (entry) => entry.type,
        );
        const pitchTypesShown = new Set(pitchBreakdown.map((entry) => entry.type));

        const comparablePitchTypes = result.pitchTypeScores.filter(
            (entry) => entry.baselineAvgMiss !== null,
        );
        const comparablePitchCount = comparablePitchTypes.reduce(
            (sum, entry) => sum + entry.subjectCount,
            0,
        );
        const subjectAvgMiss = comparablePitchCount > 0
            ? comparablePitchTypes.reduce(
                (sum, entry) => sum + (entry.subjectAvgMiss * entry.subjectCount),
                0,
            ) / comparablePitchCount
            : null;
        const teamMixAvgMiss = comparablePitchCount > 0
            ? comparablePitchTypes.reduce(
                (sum, entry) => sum + ((entry.baselineAvgMiss ?? 0) * entry.subjectCount),
                0,
            ) / comparablePitchCount
            : null;

        const teamAverages = sortPitchTypes(
            listCommandPlusBaselines(seasonBaselines).filter((row) =>
                pitchTypesShown.has(row.pitchType),
            ),
            (row) => row.pitchType,
        );

        const pitchTableRows: PitchCommandTableRow[] = pitchBreakdown.map((pb) => {
            const team = teamAverages.find((r) => r.pitchType === pb.type);
            return {
                pitchType: pb.type,
                teamAvgMiss: team?.avgMiss ?? pb.baselineAvgMiss ?? null,
                teamSampleCount: team?.count ?? 0,
                outingPitchCount: pb.count,
                yourCmdPlus: pb.score,
                qualified: pb.qualified,
            };
        });

        return {
            overall: result.overall,
            pitchBreakdown,
            subjectAvgMiss,
            teamMixAvgMiss,
            teamAverages,
            pitchTableRows,
        };
    }, [pitches, season, baselinesLoaded]);

    if (!data) return null;
    const { overall, subjectAvgMiss, teamMixAvgMiss, pitchTableRows } = data;

    const isQualified = overall !== null;
    const tierClass = plusMetricSurfaceClassesLight(overall);

  return (
        <div className={`rounded-[28px] border ${tierClass.borderClass} ${tierClass.bgClass} flex flex-col gap-4 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]`}>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500 dark:text-zinc-500">
                        Command+
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                            brandSoftPillClasses,
                            brandSoftEyebrowTextClasses,
                          )}
                        >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                            {season} Live Season
                        </span>
                    </h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400 dark:text-zinc-400">
                        This outing&apos;s command grade against the current team baseline. 100 is team average.
                    </p>
                    {!isQualified && (
                        <p className="text-[11px] leading-5 text-slate-500 dark:text-zinc-400 mt-1.5">
                            No official score yet. Each pitch type needs at least {MIN_PITCH_COUNT} tracked pitches to qualify.
                        </p>
                    )}
                </div>
                {overall === null ? (
                    <div className="inline-flex min-w-[5rem] items-center justify-center rounded-xl border border-slate-200 bg-surface px-4 py-2 font-mono text-4xl font-extrabold tracking-tight text-slate-400 dark:text-zinc-500 dark:border-zinc-700 dark:text-zinc-500">
                        --
                    </div>
                ) : (
                    <div
                        className="inline-flex min-w-[5rem] items-center justify-center rounded-xl px-4 py-2 font-mono text-4xl font-extrabold tracking-tight"
                        style={plusMetricBadgeStyle(overall)}
                    >
                        {overall.toFixed(0)}
                    </div>
                )}
            </div>

            <TeamAveragesBar
                season={season!}
                rows={pitchTableRows}
                subjectAvgMiss={subjectAvgMiss}
                teamMixAvgMiss={teamMixAvgMiss}
            />
        </div>
    );
}
