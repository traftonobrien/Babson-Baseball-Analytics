import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/dataIndex";
import { getSlugForPlayerId } from "@/lib/canonicalPlayers";
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

  const profileSlug = slug ?? getSlugForPlayerId(playerId) ?? undefined;

  const outing =
    player.outings.find((o) => o.id === outingId) ?? player.outings[0];

  if (!outing) {
    notFound();
  }

  const backTo =
    from === "profile" && profileSlug
      ? `/players/${profileSlug}?tab=Command`
      : from === "command"
        ? "/command"
        : undefined;

  const backLabel =
    from === "profile" && profileSlug
      ? "Player Profile"
      : from === "command"
        ? "Command Hub"
        : undefined;

  return (
    <PlayerDashboard
      player={player}
      outing={outing}
      backTo={backTo}
      backLabel={backLabel}
      profileSlug={profileSlug}
    />
  );
}
