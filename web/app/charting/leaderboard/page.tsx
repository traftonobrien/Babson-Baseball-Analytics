import { redirect } from "next/navigation";
import { format, parseISO, subDays } from "date-fns";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chartingGames, chartingPitcherSegments, chartingPlateAppearances } from "@/db/schema";
import {
    AggregateOptions,
    aggregateHitterStats,
    aggregatePitcherStats,
} from "@/lib/charting/analytics";
import { PitcherStatGroupWrapper } from "./PitcherStatGroupWrapper";
import { type PitcherLeaderboardRow } from "./PitcherLeaderboardTable";
import { HitterStatGroupWrapper } from "./HitterStatGroupWrapper";
import { type HitterLeaderboardRow } from "./HitterLeaderboardTable";
import type { StatGroup } from "./types";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";

export const revalidate = 0;

function buildScopeLabel(
    range: string,
    session: string,
    games: Array<{ id: string; gameDate: string; opponent: string | null }>
): string {
    if (session !== "all") {
        const activeGame = games.find((game) => game.id === session);
        if (!activeGame) {
            return "Single Game";
        }
        return `${activeGame.opponent || "Unnamed Game"} • ${format(parseISO(activeGame.gameDate), "M/d/yy")}`;
    }

    if (range === "7d") {
        return "Last 7 Days";
    }
    if (range === "30d") {
        return "Last 30 Days";
    }
    return "All Games";
}

function getScopedGameCount(
    range: string,
    session: string,
    games: Array<{ id: string; gameDate: string; opponent: string | null }>
): number {
    if (session !== "all") {
        return games.some((game) => game.id === session) ? 1 : 0;
    }

    if (range === "all") {
        return games.length;
    }

    const windowStart = range === "7d" ? subDays(new Date(), 7) : subDays(new Date(), 30);
    return games.filter((game) => parseISO(game.gameDate) >= windowStart).length;
}

export default async function ChartingLeaderboardPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    try {
        const searchParams = await props.searchParams;
        const tab = typeof searchParams.tab === "string" ? searchParams.tab : "pitchers";
        const range = typeof searchParams.range === "string" ? searchParams.range : "all";
        const session = typeof searchParams.session === "string" ? searchParams.session : "all";
        const searchQuery = typeof searchParams.q === "string" ? searchParams.q : "";
        const statGroupParam = searchParams.statGroup;
        const statGroup: StatGroup =
            typeof statGroupParam === "string" && statGroupParam === "advanced"
                ? "advanced"
                : "basic";

        const validTabs = ["pitchers", "hitters"];
        if (!validTabs.includes(tab)) {
            redirect("/charting/leaderboard?tab=pitchers");
        }

        const games = await db
            .select({
                id: chartingGames.id,
                gameDate: chartingGames.gameDate,
                opponent: chartingGames.opponent,
            })
            .from(chartingGames)
            .where(eq(chartingGames.sessionType, "game"))
            .orderBy(desc(chartingGames.gameDate));

        const scopeLabel = buildScopeLabel(range, session, games);
        const scopeGameCount = getScopedGameCount(range, session, games);

        const options: AggregateOptions = { sessionType: "game" };
        if (session !== "all" && session !== "") {
            options.gameIds = [session];
        } else if (range === "7d") {
            options.from = subDays(new Date(), 7);
        } else if (range === "30d") {
            options.from = subDays(new Date(), 30);
        }

        let pitcherRows: PitcherLeaderboardRow[] = [];
        let hitterRows: HitterLeaderboardRow[] = [];

        if (tab === "pitchers") {
            const segments = await db
                .select({
                    playerId: chartingPitcherSegments.playerId,
                    displayName: chartingPitcherSegments.displayName,
                })
                .from(chartingPitcherSegments)
                .where(eq(chartingPitcherSegments.teamSide, "our"));

            const pitcherMap = new Map<string, string>();
            for (const s of segments) {
                if (s.playerId && s.playerId.trim() !== "") {
                    pitcherMap.set(s.playerId, s.displayName);
                }
            }
            const pitcherPromises: Array<Promise<PitcherLeaderboardRow | null>> = Array.from(
                pitcherMap.keys(),
            ).map(async (id) => {
                const stats = await aggregatePitcherStats(id, options);
                if (!stats) {
                    return null;
                }
                return {
                    ...stats,
                    playerId: id,
                    displayName: pitcherMap.get(id) ?? "Unknown",
                } satisfies PitcherLeaderboardRow;
            });
            const resolvedPitchers = await Promise.all(pitcherPromises);
            pitcherRows = resolvedPitchers.filter(
                (row): row is PitcherLeaderboardRow => row !== null,
            );
        } else {
            const pas = await db
                .select({ hitterName: chartingPlateAppearances.hitterName })
                .from(chartingPlateAppearances)
                .where(eq(chartingPlateAppearances.teamSide, "our"));
            const uniqueHitters = Array.from(
                new Set(pas.map((p) => p.hitterName.trim()).filter((n) => n.length > 0)),
            );

            const hitterPromises: Array<Promise<HitterLeaderboardRow | null>> = uniqueHitters.map(async (name) => {
                const stats = await aggregateHitterStats(name, options);
                if (!stats) {
                    return null;
                }
                return {
                    ...stats,
                    hitterName: name,
                } satisfies HitterLeaderboardRow;
            });
            const resolvedHitters = await Promise.all(hitterPromises);
            hitterRows = resolvedHitters.filter(
                (row): row is HitterLeaderboardRow => row !== null,
            );
        }

        return (
            <LeaderboardPageFrame variant="light" maxWidth="max-w-[1440px]">
                {tab === "pitchers" ? (
                    <PitcherStatGroupWrapper
                        pitchers={pitcherRows}
                        searchQuery={searchQuery}
                        initialStatGroup={statGroup}
                        tab={tab}
                        range={range}
                        session={session}
                        games={games}
                        scopeLabel={scopeLabel}
                        scopeGameCount={scopeGameCount}
                    />
                ) : (
                    <HitterStatGroupWrapper
                        hitters={hitterRows}
                        searchQuery={searchQuery}
                        initialStatGroup={statGroup}
                        tab={tab}
                        range={range}
                        session={session}
                        games={games}
                        scopeLabel={scopeLabel}
                        scopeGameCount={scopeGameCount}
                    />
                )}
            </LeaderboardPageFrame>
        );
    } catch (e) {
        console.error("Leaderboard Page Error:", e);
        return null;
    }
}
