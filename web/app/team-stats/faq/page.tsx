import type { Metadata } from "next";
import TeamStatsFaqView from "./TeamStatsFaqView";
import { TEAM_NAME } from "@/lib/teamConfig";

export const metadata: Metadata = {
    title: `Statistics Guide — ${TEAM_NAME} Baseball`,
};

export default function TeamStatsFaqPage() {
    return <TeamStatsFaqView />;
}
