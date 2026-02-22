import HomeContent from "./HomeContent";
import { readMechanicsIndex, getNeedsAttentionCount } from "@/lib/mechanics/registry";

export default async function Home() {
  const index = await readMechanicsIndex();
  return (
    <HomeContent
      mechanicsPlayerCount={index.players.length}
      mechanicsNeedsAttention={getNeedsAttentionCount(index.players)}
    />
  );
}
