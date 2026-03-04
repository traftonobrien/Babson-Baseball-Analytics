import type { Metadata } from "next";
import PlayersFaqView from "./PlayersFaqView";

export const metadata: Metadata = {
    title: "Players Metrics Dictionary — Babson Baseball",
};

export default function PlayersFaqPage() {
    return <PlayersFaqView />;
}
