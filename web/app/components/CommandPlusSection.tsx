"use client";

import { useState, useEffect, useMemo } from "react";
import type { Pitch } from "../types";
import { computeCommandPlus, listCommandPlusBaselines } from "@/lib/commandPlus";
import { globalCommandPlusBaselines, loadAllOutingData } from "@/lib/leaderboards/load";
import { seasonFromDateId } from "@/lib/season";
import type { SeasonFilter } from "@/lib/leaderboards/types";
import { plusMetricBadgeStyle, plusMetricSurfaceClasses } from "@/lib/stuffPlusUtils";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { pitchDisplayName } from "@/lib/pitchNames";
import { sortPitchTypes } from "@/lib/pitchTypeOrder";
import TeamAveragesBar from "./TeamAveragesBar";

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
    const [baselinesLoaded, setBaselinesLoaded] = useState(false);

    useEffect(() => {
        if (!season) {
            setBaselinesLoaded(true);
            return;
        }
        if (globalCommandPlusBaselines[season]) {
            setBaselinesLoaded(true);
        } else {
            loadAllOutingData({ seasonFilter: season as SeasonFilter }).then(() => setBaselinesLoaded(true));
        }
    }, [season]);

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

        return {
            overall: result.overall,
            pitchBreakdown,
            subjectAvgMiss,
            teamMixAvgMiss,
            teamAverages: sortPitchTypes(
                listCommandPlusBaselines(seasonBaselines).filter((row) =>
                    pitchTypesShown.has(row.pitchType),
                ),
                (row) => row.pitchType,
            ),
        };
    }, [pitches, season, baselinesLoaded]);

    if (!data) return null;
    const { overall, pitchBreakdown, subjectAvgMiss, teamMixAvgMiss, teamAverages } = data;

    const isQualified = overall !== null;
    const tierClass = plusMetricSurfaceClasses(overall);

  return (
        <div className={`rounded-[1.8rem] border ${tierClass.borderClass} ${tierClass.bgClass} p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)] flex flex-col gap-4`}>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.24em] flex items-center gap-2">
                        Command+
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/35 bg-[linear-gradient(135deg,rgba(251,146,60,0.22),rgba(9,9,11,0.92))] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(251,146,60,0.1),0_0_18px_rgba(251,146,60,0.14)]">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-300 shadow-[0_0_10px_rgba(253,186,116,0.9)]" />
                            {season} Live Season
                        </span>
                    </h3>
                    <p className="mt-2 text-sm text-zinc-300">
                        This outing&apos;s command grade against the current team baseline. 100 is team average.
                    </p>
                    {!isQualified && (
                        <p className="text-[11px] leading-5 text-zinc-500 mt-1.5">
                            No official score yet. Each pitch type needs at least {MIN_PITCH_COUNT} tracked pitches to qualify.
                        </p>
                    )}
                </div>
                {overall === null ? (
                    <div className="inline-flex min-w-[5rem] items-center justify-center rounded-xl bg-zinc-800 px-4 py-2 font-mono text-4xl font-extrabold tracking-tight text-zinc-300">
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
                averages={teamAverages}
                subjectAvgMiss={subjectAvgMiss}
                teamMixAvgMiss={teamMixAvgMiss}
            />

            {pitchBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-2.5 pt-4 border-t border-zinc-700/50 mt-1">
                    {pitchBreakdown.map(pb => {
                        return (
                            <div
                                key={pb.type}
                                className={`flex items-center gap-2.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/55 px-3 py-2 ${!pb.qualified ? "opacity-50" : ""}`}
                                title={pb.baselineAvgMiss === null ? undefined : `Team avg: ${pb.baselineAvgMiss.toFixed(1)}"`}
                            >
                                <PitchTypeChip
                                    pitchType={pb.type}
                                    label={pitchDisplayName(pb.type)}
                                    size="xs"
                                    className={pb.qualified ? "" : "opacity-65"}
                                />
                                {pb.score === null ? (
                                    <span className="font-mono text-sm font-extrabold text-zinc-600">
                                        --
                                    </span>
                                ) : (
                                    <span
                                        className="inline-flex min-w-[46px] items-center justify-center rounded-md px-1.5 py-0.5 font-mono text-sm font-extrabold tracking-tight"
                                        style={plusMetricBadgeStyle(pb.score)}
                                    >
                                        {pb.score.toFixed(0)}
                                    </span>
                                )}
                                {!pb.qualified && (
                                    <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">NQ</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
