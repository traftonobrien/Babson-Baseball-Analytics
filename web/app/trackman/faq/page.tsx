import type { Metadata } from "next";
import TrackmanFaqView from "./TrackmanFaqView";
import { TEAM_NAME } from "@/lib/teamConfig";

export const metadata: Metadata = {
    title: `Trackman Guide — ${TEAM_NAME} Baseball`,
};

export default function TrackmanFaqPage() {
    return <TrackmanFaqView />;
}
