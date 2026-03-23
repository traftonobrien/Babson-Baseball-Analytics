"use client";
import { useEffect, useState } from "react";
import { HitterLeaderboardTable, type HitterLeaderboardRow } from "./HitterLeaderboardTable";
import { LeaderboardClientState } from "./LeaderboardClientState";
import type { StatGroup } from "./types";

interface HitsProps {
    hitters: HitterLeaderboardRow[];
    searchQuery: string;
    initialStatGroup: StatGroup;
    tab: string;
    range: string;
    session: string;
    games: any;
    scopeLabel: string;
    scopeGameCount: number;
    sessionType?: "live_ab" | "game" | "all";
}

export function HitterStatGroupWrapper({
    hitters,
    searchQuery,
    initialStatGroup,
    tab,
    range,
    session,
    games,
    scopeLabel,
    scopeGameCount,
    sessionType = "game",
}: HitsProps) {
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
                sessionType={sessionType}
            />

            <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-surface shadow-sm dark:border-zinc-700 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                <div className="max-h-[70vh] overflow-auto">
                    <HitterLeaderboardTable
                        hitters={hitters}
                        searchQuery={searchQuery}
                        statGroup={statGroup}
                    />
                </div>
            </div>
        </>
    );
}
