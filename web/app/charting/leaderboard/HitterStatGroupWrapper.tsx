"use client";
import { useEffect, useState } from "react";
import { HitterLeaderboardTable, type HitterLeaderboardRow } from "./HitterLeaderboardTable";
import { LeaderboardClientState } from "./LeaderboardClientState";
import { LeaderboardPanel } from "@/app/components/leaderboards/LeaderboardChrome";
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
                rowCount={hitters.length}
                scopeLabel={scopeLabel}
                scopeGameCount={scopeGameCount}
                sessionType={sessionType}
            />

            <LeaderboardPanel className="mt-6 overflow-hidden">
                <div className="max-h-[70vh] overflow-auto">
                    <HitterLeaderboardTable
                        hitters={hitters}
                        searchQuery={searchQuery}
                        statGroup={statGroup}
                    />
                </div>
            </LeaderboardPanel>
        </>
    );
}
