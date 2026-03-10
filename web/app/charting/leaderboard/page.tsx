import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO, subDays } from "date-fns";
import { BarChart3, ChevronLeft } from "lucide-react";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { chartingGames, chartingPitcherSegments, chartingPlateAppearances } from "@/db/schema";
import {
    AggregateOptions,
    aggregateHitterStats,
    aggregatePitcherStats,
} from "@/lib/charting/analytics";
import { PitcherStatGroupWrapper } from "./PitcherStatGroupWrapper";
import { type PitcherLeaderboardRow } from "./PitcherLeaderboardTable";
import { LeaderboardClientState } from "./LeaderboardClientState";
import { HitterStatGroupWrapper } from "./HitterStatGroupWrapper";
import { type HitterLeaderboardRow, type StatGroup } from "./HitterLeaderboardTable";
import { LeaderboardPageFrame, LeaderboardPanel } from "@/app/components/leaderboards/LeaderboardChrome";

export const revalidate = 0;

export default async function ChartingLeaderboardPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    try {
        const searchParams = await props.searchParams;
        const tab = typeof searchParams.tab === "string" ? searchParams.tab : "pitchers";
        const range = typeof searchParams.range === "string" ? searchParams.range : "all";
        const session = typeof searchParams.session === "string" ? searchParams.session : "all";
        const searchQuery = typeof searchParams.q === "string" ? searchParams.q : "";
        const statGroup = typeof searchParams.statGroup === "string" ? (searchParams.statGroup as StatGroup) : "basic";


        const validTabs = ["pitchers", "hitters"];
        if (!validTabs.includes(tab)) {
            redirect("/charting/leaderboard?tab=pitchers");
        }

        // Fetch games for the session dropdown
        const games = await db
            .select({
                id: chartingGames.id,
                gameDate: chartingGames.gameDate,
                opponent: chartingGames.opponent,
            })
            .from(chartingGames)
            .orderBy(desc(chartingGames.gameDate));

        // Determine aggregate options
        let options: AggregateOptions = {};
        if (session !== "all" && session !== "") {
            options.gameIds = [session];
        } else if (range === "7d") {
            options.from = subDays(new Date(), 7);
        } else if (range === "30d") {
            options.from = subDays(new Date(), 30);
        }

        // Pre-fetch unique players
        let pitcherRows: PitcherLeaderboardRow[] = [];
        let hitterRows: HitterLeaderboardRow[] = [];

        if (tab === "pitchers") {
            const segments = await db
                .select({
                    playerId: chartingPitcherSegments.playerId,
                    displayName: chartingPitcherSegments.displayName,
                })
                .from(chartingPitcherSegments);

            const pitcherMap = new Map<string, string>();
            for (const s of segments) {
                if (s.playerId && s.playerId.trim() !== "") {
                    pitcherMap.set(s.playerId, s.displayName);
                }
            }
            const pitcherIds = Array.from(pitcherMap.keys());

            const pitcherPromises = pitcherIds.map(async (id) => {
                const stats = await aggregatePitcherStats(id, options);
                if (!stats) return null;
                return {
                    ...stats,
                    playerId: id,
                    displayName: pitcherMap.get(id) ?? "Unknown",
                };
            });
            pitcherRows = (await Promise.all(pitcherPromises)).filter(Boolean) as PitcherLeaderboardRow[];
        } else {
            const pas = await db
                .select({ hitterName: chartingPlateAppearances.hitterName })
                .from(chartingPlateAppearances);
            const uniqueHitters = Array.from(new Set(pas.map((p) => p.hitterName).filter((n) => n.trim() !== "")));

            const hitterPromises = uniqueHitters.map(async (name) => {
                const stats = await aggregateHitterStats(name, options);
                if (!stats) return null;
                return {
                    ...stats,
                    hitterName: name,
                };
            });
            hitterRows = (await Promise.all(hitterPromises)).filter(Boolean) as HitterLeaderboardRow[];
        }

        return (
            <LeaderboardPageFrame maxWidth="max-w-7xl">
                {tab === "pitchers" ? (
                    <PitcherStatGroupWrapper
                        pitchers={pitcherRows}
                        searchQuery={searchQuery}
                        tab={tab}
                        range={range}
                        session={session}
                        games={games}
                    />
                ) : (
                    <HitterStatGroupWrapper
                        hitters={hitterRows}
                        searchQuery={searchQuery}
                        tab={tab}
                        range={range}
                        session={session}
                        games={games}
                    />
                )}
            </LeaderboardPageFrame>
        );
    } catch (e) {
        console.error("Leaderboard Page Error:", e);
        return null;
    }
}
