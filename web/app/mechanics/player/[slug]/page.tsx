import MechanicsPlayerView from "./MechanicsPlayerView";

export default async function MechanicsPlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <MechanicsPlayerView playerSlug={slug} />;
}
