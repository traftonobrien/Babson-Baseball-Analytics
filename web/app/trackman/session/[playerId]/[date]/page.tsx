import TrackmanSessionView from "./TrackmanSessionView";

export default async function TrackmanSessionPage({
  params,
}: {
  params: Promise<{ playerId: string; date: string }>;
}) {
  const { playerId, date } = await params;
  return <TrackmanSessionView playerId={playerId} date={date} />;
}
