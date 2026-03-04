import type { Metadata } from "next";
import LeaderboardsFaqView from "./LeaderboardsFaqView";

export const metadata: Metadata = {
    title: "Command Guide — Babson Baseball",
};

export default function LeaderboardsFaqPage() {
    return <LeaderboardsFaqView />;
}
