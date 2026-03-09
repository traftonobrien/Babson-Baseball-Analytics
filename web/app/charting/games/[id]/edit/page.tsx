import { notFound } from "next/navigation";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import { ChartingEditor } from "@/app/charting/_components/ChartingEditor";
import { buildBootstrapPitchers } from "@/lib/charting/bootstrapPitchers";
import { buildBootstrapRosterPlayers } from "@/lib/charting/bootstrapRoster";
import { loadChartingGameSnapshot } from "@/lib/charting/snapshot";

export const revalidate = 0;

export default async function ChartingGameEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [snapshot, pitchers] = await Promise.all([
    loadChartingGameSnapshot(id),
    buildBootstrapPitchers(),
  ]);

  if (!snapshot) {
    return notFound();
  }

  const rosterPlayers = buildBootstrapRosterPlayers();

  return (
    <LeaderboardPageFrame maxWidth="max-w-[96rem]">
      <ChartingEditor
        initialSnapshot={snapshot}
        pitchers={pitchers}
        rosterPlayers={rosterPlayers}
      />
    </LeaderboardPageFrame>
  );
}
