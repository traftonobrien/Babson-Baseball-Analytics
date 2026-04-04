"use client";
import { useEffect, useState } from "react";
import { PitcherLeaderboardTable, type PitcherLeaderboardRow } from "./PitcherLeaderboardTable";
import { LeaderboardClientState } from "./LeaderboardClientState";
import type { StatGroup } from "./types";

interface PitchProps {
    pitchers: PitcherLeaderboardRow[];
    searchQuery: string;
    initialStatGroup: StatGroup;
    tab: string;
    range: string;
    session: string;
    games: any;
    scopeLabel: string;
    scopeGameCount: number;
}

export function PitcherStatGroupWrapper({
    pitchers,
    searchQuery,
    initialStatGroup,
    tab,
    range,
    session,
    games,
    scopeLabel,
    scopeGameCount,
}: PitchProps) {
    const [statGroup, setStatGroup] = useState<StatGroup>(initialStatGroup);

    useEffect(() => {
        setStatGroup(initialStatGroup);
    }, [initialStatGroup]);

    return (
        <>
            <LeaderboardClientState
                tab={tab}
                range={range}
                session={session}
                searchQuery={searchQuery}
                games={games}
                statGroup={statGroup}
                onStatGroupChange={setStatGroup}
                scopeLabel={scopeLabel}
                scopeGameCount={scopeGameCount}
            />

            <div className="leaderboard-print-panel mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-surface shadow-sm dark:border-zinc-700 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                <div className="leaderboard-print-table-shell max-h-[70vh] overflow-auto">
                    <PitcherLeaderboardTable
                        pitchers={pitchers}
                        searchQuery={searchQuery}
                        statGroup={statGroup}
                    />
                </div>
            </div>
        </>
    );
}
