import MechanicsSessionView from "./MechanicsSessionView";

export default async function MechanicsSessionPage({
  params,
}: {
  params: Promise<{ playerSlug: string; sessionSlug: string }>;
}) {
  const { playerSlug, sessionSlug } = await params;
  return <MechanicsSessionView playerSlug={playerSlug} sessionSlug={sessionSlug} />;
}
