"use client";
import { useState } from "react";
import { HitterLeaderboardTable, type HitterLeaderboardRow, type StatGroup } from "./HitterLeaderboardTable";
import { LeaderboardClientState } from "./LeaderboardClientState";

interface HitsProps {
    hitters: HitterLeaderboardRow[];
    searchQuery: string;
    tab: string;
    range: string;
    session: string;
    games: any;
}

export function HitterStatGroupWrapper({ hitters, searchQuery, tab, range, session, games }: HitsProps) {
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

            <div className="mt-6 rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-6 shadow-xl">
                <HitterLeaderboardTable
                    hitters={hitters}
                    searchQuery={searchQuery}
                    statGroup={statGroup}
                />
            </div>
        </>
    );
}
