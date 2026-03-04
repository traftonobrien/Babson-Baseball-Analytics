import type { Metadata } from "next";
import TrackmanFaqView from "./TrackmanFaqView";

export const metadata: Metadata = {
    title: "Trackman Guide — Babson Baseball",
};

export default function TrackmanFaqPage() {
    return <TrackmanFaqView />;
}
