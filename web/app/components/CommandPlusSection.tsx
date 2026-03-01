"use client";

import { useState, useEffect, useMemo } from "react";
import type { Pitch } from "../types";
import { globalTeamAvgMiss, loadAllOutingData } from "@/lib/leaderboards/load";
import { seasonFromDateId } from "@/lib/season";
import type { SeasonFilter } from "@/lib/leaderboards/types";
import { pitchColor } from "../utils";

interface Props {
    pitches: Pitch[];
    outingId: string;
}

interface PitchPlus {
    type: string;
    count: number;
    score: number;
}

export default function CommandPlusSection({ pitches, outingId }: Props) {
    const season = seasonFromDateId(outingId.split("/")[1]) ?? null;
    const [baselinesLoaded, setBaselinesLoaded] = useState(false);

    useEffect(() => {
        if (!season) {
            setBaselinesLoaded(true);
            return;
        }
        if (globalTeamAvgMiss[season]) {
            setBaselinesLoaded(true);
        } else {
            loadAllOutingData({ seasonFilter: season as SeasonFilter }).then(() => setBaselinesLoaded(true));
        }
    }, [season]);

    const data = useMemo(() => {
        if (!season || !baselinesLoaded || pitches.length === 0) return null;
        const seasonBaselines = globalTeamAvgMiss[season];
        if (!seasonBaselines) return null;

        let totalWeight = 0;
        let weightedScores = 0;
        const pPlus: PitchPlus[] = [];

        // Group pitches by type to get avgMiss
        const map = new Map<string, Pitch[]>();
        for (const p of pitches) {
            const t = p.pitch_type;
            if (!t) continue;
            const arr = map.get(t) ?? [];
            arr.push(p);
            map.set(t, arr);
        }

        for (const [type, group] of map.entries()) {
            if (group.length === 0) continue;
            const baseline = seasonBaselines[type];
            const avgMiss = group.reduce((s, p) => s + p.total_miss_inches, 0) / group.length;

            if (baseline && baseline > 0 && avgMiss > 0) {
                const pitchCommandPlus = (baseline / avgMiss) * 100;
                weightedScores += pitchCommandPlus * group.length;
                totalWeight += group.length;

                if (group.length >= 5) {
                    pPlus.push({
                        type,
                        count: group.length,
                        score: pitchCommandPlus
                    });
                }
            }
        }

        if (totalWeight === 0) return null;
        pPlus.sort((a, b) => b.count - a.count);
        return { overall: weightedScores / totalWeight, pitchBreakdown: pPlus };
    }, [pitches, season, baselinesLoaded]);

    if (!data) return null;
    const { overall, pitchBreakdown } = data;

    const isGood = overall >= 105;
    const isBad = overall <= 95;
    const colorClass = isGood ? "text-green-400" : isBad ? "text-red-400" : "text-zinc-100";
    const borderClass = isGood ? "border-green-500/50" : isBad ? "border-red-500/50" : "border-zinc-800";
    const bgClass = isGood ? "bg-green-950/20" : isBad ? "bg-red-950/20" : "bg-zinc-900/50";

    return (
        <div className={`mt-2 rounded-xl border ${borderClass} ${bgClass} p-4 flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                        Command+
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${isGood ? 'bg-green-900/40 text-green-400' : isBad ? 'bg-red-900/40 text-red-400' : 'bg-zinc-800 text-zinc-300'}`}>
                            {season} Baseline
                        </span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                        Pitch execution relative to the collegiate team average. 100 is league average.
                    </p>
                </div>
                <div className={`text-4xl font-mono font-extrabold ${colorClass} tracking-tight`}>
                    {overall.toFixed(0)}
                </div>
            </div>

            {pitchBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-700/50 mt-1">
                    {pitchBreakdown.map(pb => {
                        const pColor = pitchColor(pb.type);
                        const pGood = pb.score >= 105;
                        const pBad = pb.score <= 95;
                        const scoreColor = pGood ? "text-green-400" : pBad ? "text-red-400" : "text-zinc-100";
                        return (
                            <div key={pb.type} className="flex items-center gap-2 bg-zinc-950/40 rounded border border-zinc-800/80 px-2 py-1">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pColor }} />
                                    <span className="font-mono text-[11px] font-bold text-zinc-300">{pb.type}</span>
                                </span>
                                <span className={`font-mono text-sm font-extrabold ${scoreColor}`}>
                                    {pb.score.toFixed(0)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
