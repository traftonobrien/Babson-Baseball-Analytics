"use client";
import { useEffect, useState } from "react";
import { PitcherLeaderboardTable, type PitcherLeaderboardRow } from "./PitcherLeaderboardTable";
import { LeaderboardClientState } from "./LeaderboardClientState";
import { LeaderboardPanel } from "@/app/components/leaderboards/LeaderboardChrome";
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
    sessionType?: "live_ab" | "game" | "all";
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
    sessionType = "live_ab",
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
                rowCount={pitchers.length}
                scopeLabel={scopeLabel}
                scopeGameCount={scopeGameCount}
                sessionType={sessionType}
            />

            <LeaderboardPanel className="mt-6 overflow-hidden">
                <div className="max-h-[70vh] overflow-auto">
                    <PitcherLeaderboardTable
                        pitchers={pitchers}
                        searchQuery={searchQuery}
                        statGroup={statGroup}
                    />
                </div>
            </LeaderboardPanel>
        </>
    );
}
