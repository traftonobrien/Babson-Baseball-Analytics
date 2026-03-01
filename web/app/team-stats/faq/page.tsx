import type { Metadata } from "next";
import TeamStatsFaqView from "./TeamStatsFaqView";

export const metadata: Metadata = {
    title: "Team Statistics FAQ — Babson Baseball",
};

export default function TeamStatsFaqPage() {
    return <TeamStatsFaqView />;
}
