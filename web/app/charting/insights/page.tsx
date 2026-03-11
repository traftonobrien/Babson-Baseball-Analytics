import { playerRegistry } from "@/lib/playerRegistry";
import {
  loadChartingHitterInsightsDirectory,
  type ChartingHitterInsightsDirectorySource,
} from "@/lib/charting/playerProfile";
import { buildChartingPlayerComparisonDirectory } from "@/lib/charting/playerComparison";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import LiveAbInsightsExplorer from "./LiveAbInsightsExplorer";

export const revalidate = 0;

export default async function ChartingInsightsPage() {
  const hitterSources: ChartingHitterInsightsDirectorySource[] = playerRegistry
    .filter((player) => player.isHitter)
    .map((player) => ({
      slug: player.slug,
      name: player.name,
      bats:
        player.bats === "R" || player.bats === "L" || player.bats === "S"
          ? player.bats
          : null,
    }));

  const entries = buildChartingPlayerComparisonDirectory(
    await loadChartingHitterInsightsDirectory(hitterSources)
  );

  return (
    <LeaderboardPageFrame maxWidth="max-w-7xl">
      <LiveAbInsightsExplorer entries={entries} />
    </LeaderboardPageFrame>
  );
}
