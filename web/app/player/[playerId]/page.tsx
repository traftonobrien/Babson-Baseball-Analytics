import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/dataIndex";
import PlayerDashboard from "./PlayerDashboard";

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ outingId?: string }>;
}) {
  const { playerId } = await params;
  const { outingId } = await searchParams;

  const player = getPlayer(playerId);
  if (!player) {
    notFound();
  }

  const outing =
    player.outings.find((o) => o.id === outingId) ?? player.outings[0];

  if (!outing) {
    notFound();
  }

  return <PlayerDashboard player={player} outing={outing} />;
}
