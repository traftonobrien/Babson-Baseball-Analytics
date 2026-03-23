import LiveAbInsightsExplorer from "./LiveAbInsightsExplorer";
import { normalizeComparisonView } from "./explorerState";
import {
  loadChartingHitterComparisonDirectory,
  loadChartingPitcherComparisonDirectory,
} from "@/lib/charting/comparisonDirectory";

export const revalidate = 0;

export default async function ChartingInsightsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const view = normalizeComparisonView(
    typeof searchParams.view === "string" ? searchParams.view : null
  );
  const explorerParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      explorerParams.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        explorerParams.append(key, item);
      }
    }
  }

  explorerParams.sort();
  const entries =
    view === "pitchers"
      ? await loadChartingPitcherComparisonDirectory()
      : await loadChartingHitterComparisonDirectory();

  return (
    <LiveAbInsightsExplorer
      key={`${view}:${explorerParams.toString()}`}
      entries={entries}
      view={view}
    />
  );
}
