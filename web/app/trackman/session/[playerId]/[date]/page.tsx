import TrackmanSessionView from "./TrackmanSessionView";

export default async function TrackmanSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string; date: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { playerId, date } = await params;
  const sp = await searchParams;
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const slug = typeof sp.slug === "string" ? sp.slug : undefined;
  return <TrackmanSessionView playerId={playerId} date={date} from={from} slug={slug} />;
}
