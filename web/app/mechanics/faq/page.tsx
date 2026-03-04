import type { Metadata } from "next";
import MechanicsFaqView from "./MechanicsFaqView";

export const metadata: Metadata = {
    title: "Mechanics Guide — Babson Baseball",
};

export default function MechanicsFaqPage() {
    return <MechanicsFaqView />;
}
