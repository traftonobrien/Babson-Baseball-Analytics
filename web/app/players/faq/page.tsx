import type { Metadata } from "next";
import PlayersFaqView from "./PlayersFaqView";
import { TEAM_NAME } from "@/lib/teamConfig";

export const metadata: Metadata = {
    title: `Player Profiles Guide — ${TEAM_NAME} Baseball`,
};

export default function PlayersFaqPage() {
    return <PlayersFaqView />;
}
