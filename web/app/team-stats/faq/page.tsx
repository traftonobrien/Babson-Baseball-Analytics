import type { Metadata } from "next";
import TeamStatsFaqView from "./TeamStatsFaqView";

export const metadata: Metadata = {
    title: "Statistics Guide — Babson Baseball",
};

export default function TeamStatsFaqPage() {
    return <TeamStatsFaqView />;
}
