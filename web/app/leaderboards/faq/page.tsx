import type { Metadata } from "next";
import LeaderboardsFaqView from "./LeaderboardsFaqView";
import { TEAM_NAME } from "@/lib/teamConfig";

export const metadata: Metadata = {
    title: `Command Guide — ${TEAM_NAME} Baseball`,
};

export default function LeaderboardsFaqPage() {
    return <LeaderboardsFaqView />;
}
