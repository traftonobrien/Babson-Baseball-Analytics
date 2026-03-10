"use client";
import { useState } from "react";
import { PitcherLeaderboardTable, type PitcherLeaderboardRow, type StatGroup } from "./PitcherLeaderboardTable";
import { LeaderboardClientState } from "./LeaderboardClientState";

interface PitchProps {
    pitchers: PitcherLeaderboardRow[];
    searchQuery: string;
    tab: string;
    range: string;
    session: string;
    games: any;
}

export function PitcherStatGroupWrapper({ pitchers, searchQuery, tab, range, session, games }: PitchProps) {
    const [statGroup, setStatGroup] = useState<StatGroup>("basic");

    return (
        <>
            <LeaderboardClientState
                tab={tab}
                range={range}
                session={session}
                searchQuery={searchQuery}
                games={games}
                statGroup={statGroup}
                setStatGroup={setStatGroup}
            />

            <div className="mt-6 overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-6 shadow-xl">
                <PitcherLeaderboardTable
                    pitchers={pitchers}
                    searchQuery={searchQuery}
                    statGroup={statGroup}
                />
            </div>
        </>
    );
}
