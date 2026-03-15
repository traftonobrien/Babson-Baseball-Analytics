import type { Metadata } from "next";
import ChartingFaqView from "./ChartingFaqView";

export const metadata: Metadata = {
  title: "Charting Guide — Babson Baseball",
};

export default function ChartingFaqPage() {
  return <ChartingFaqView />;
}
