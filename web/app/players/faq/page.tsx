import type { Metadata } from "next";
import PlayersFaqView from "./PlayersFaqView";

export const metadata: Metadata = {
    title: "Player Profiles Guide — Babson Baseball",
};

export default function PlayersFaqPage() {
    return <PlayersFaqView />;
}
