import rosterData from "@/data/roster.json";
import { playerRegistry } from "@/lib/playerRegistry";
import PlayersHubView from "./PlayersHubView";

const roster = rosterData as Record<string, { height?: string; weight?: string; class?: string; photo?: string }>;

export default function PlayersPage() {
  return <PlayersHubView registry={playerRegistry} roster={roster} />;
}
