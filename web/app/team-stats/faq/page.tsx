import type { Metadata } from "next";
import TeamStatsFaqView from "./TeamStatsFaqView";

export const metadata: Metadata = {
    title: "Statistics Metrics Dictionary — Babson Baseball",
};

export default function TeamStatsFaqPage() {
    return <TeamStatsFaqView />;
}
