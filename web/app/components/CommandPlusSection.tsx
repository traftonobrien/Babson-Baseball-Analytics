"use client";

import { useState, useEffect, useMemo } from "react";
import type { Pitch } from "../types";
import { computeCommandPlus, listCommandPlusBaselines } from "@/lib/commandPlus";
import { globalCommandPlusBaselines, loadAllOutingData } from "@/lib/leaderboards/load";
import { seasonFromDateId } from "@/lib/season";
import type { SeasonFilter } from "@/lib/leaderboards/types";
import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import { pitchColor } from "../utils";
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

        const pitchBreakdown: PitchPlus[] = result.pitchTypeScores.map((entry) => ({
            type: entry.pitchType,
            count: entry.subjectCount,
            score: entry.score,
            qualified: entry.eligible,
            baselineAvgMiss: entry.baselineAvgMiss,
        }));

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
            teamAverages: listCommandPlusBaselines(seasonBaselines),
        };
    }, [pitches, season, baselinesLoaded]);

    if (!data) return null;
    const { overall, pitchBreakdown, subjectAvgMiss, teamMixAvgMiss, teamAverages } = data;

    const isQualified = overall !== null;
    const tierClass = !isQualified
        ? {
            borderClass: "border-zinc-800",
            bgClass: "bg-zinc-900/50",
            pillClass: "bg-zinc-800 text-zinc-300",
        }
        : overall >= 110
            ? {
                borderClass: "border-rose-500/50",
                bgClass: "bg-rose-950/10",
                pillClass: "bg-rose-500/15 text-rose-300",
            }
            : overall >= 100
                ? {
                    borderClass: "border-orange-500/50",
                    bgClass: "bg-orange-950/10",
                    pillClass: "bg-orange-500/15 text-orange-300",
                }
                : overall >= 90
                    ? {
                        borderClass: "border-zinc-700",
                        bgClass: "bg-zinc-900/50",
                        pillClass: "bg-zinc-800 text-zinc-300",
                    }
                    : {
                        borderClass: "border-sky-500/50",
                        bgClass: "bg-sky-950/10",
                        pillClass: "bg-sky-500/15 text-sky-300",
                    };

    return (
        <div className={`mt-2 rounded-xl border ${tierClass.borderClass} ${tierClass.bgClass} p-4 flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                        Command+
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${tierClass.pillClass}`}>
                            {season} Live Season
                        </span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                        Pitch execution relative to the live team baseline for this season. 100 is team average.
                    </p>
                    {!isQualified && (
                        <p className="text-[11px] text-zinc-500 mt-1">
                            No official score yet. A pitch type needs at least {MIN_PITCH_COUNT} tracked pitches to qualify.
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
                <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-700/50 mt-1">
                    {pitchBreakdown.map(pb => {
                        const pColor = pitchColor(pb.type);
                        return (
                            <div
                                key={pb.type}
                                className={`flex items-center gap-2 bg-zinc-950/40 rounded border border-zinc-800/80 px-2 py-1 ${!pb.qualified ? "opacity-50" : ""}`}
                                title={pb.baselineAvgMiss === null ? undefined : `Team avg: ${pb.baselineAvgMiss.toFixed(1)}"`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pb.qualified ? pColor : "#52525b" }} />
                                    <span className={`font-mono text-[11px] font-bold ${pb.qualified ? "text-zinc-300" : "text-zinc-600"}`}>{pb.type}</span>
                                </span>
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
                                    <span className="text-[8px] text-zinc-600 font-medium">NQ</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
