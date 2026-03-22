import type { Metadata } from "next";
import MechanicsFaqView from "./MechanicsFaqView";
import { TEAM_NAME } from "@/lib/teamConfig";

export const metadata: Metadata = {
    title: `Mechanics Guide — ${TEAM_NAME} Baseball`,
};

export default function MechanicsFaqPage() {
    return <MechanicsFaqView />;
}
