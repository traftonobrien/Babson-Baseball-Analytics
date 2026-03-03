import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/dataIndex";
import PlayerDashboard from "./PlayerDashboard";

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { playerId } = await params;
  const sp = await searchParams;
  const outingId = typeof sp.outingId === "string" ? sp.outingId : undefined;
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const slug = typeof sp.slug === "string" ? sp.slug : undefined;

  const player = getPlayer(playerId);
  if (!player) {
    notFound();
  }

  const outing =
    player.outings.find((o) => o.id === outingId) ?? player.outings[0];

  if (!outing) {
    notFound();
  }

  const backTo =
    from === "profile" && slug
      ? `/players/${slug}`
      : from === "command"
        ? "/command"
        : undefined;

  const backLabel =
    from === "profile" && slug
      ? "Profile"
      : from === "command"
        ? "Command Hub"
        : undefined;

  return (
    <PlayerDashboard
      player={player}
      outing={outing}
      backTo={backTo}
      backLabel={backLabel}
    />
  );
}
