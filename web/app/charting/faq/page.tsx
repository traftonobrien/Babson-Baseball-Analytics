import type { Metadata } from "next";
import ChartingFaqView from "./ChartingFaqView";
import { TEAM_NAME } from "@/lib/teamConfig";

export const metadata: Metadata = {
  title: `Charting Guide — ${TEAM_NAME} Baseball`,
};

export default function ChartingFaqPage() {
  return <ChartingFaqView />;
}
