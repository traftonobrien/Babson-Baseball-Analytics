import type { Metadata } from "next";
import LeaderboardsFaqView from "./LeaderboardsFaqView";

export const metadata: Metadata = {
    title: "Command Metrics Dictionary — Babson Baseball",
};

export default function LeaderboardsFaqPage() {
    return <LeaderboardsFaqView />;
}
