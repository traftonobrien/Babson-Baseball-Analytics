import players from "@/data/players.json";
import rosterData from "@/data/roster.json";
import PlayersHubView from "./PlayersHubView";

interface RawPlayerEntry {
  player_slug?: string;
  slug?: string;
  full_name?: string;
  name?: string;
  team?: string;
  school?: string;
  role?: string;
  d3_player_id?: number | string | null;
}

interface PlayerRegistryEntry {
  slug: string;
  name: string;
  team: string;
  role: string;
  d3_player_id: string | null;
}

function normalizePlayerEntry(entry: RawPlayerEntry): PlayerRegistryEntry | null {
  const slug = entry.slug ?? entry.player_slug ?? "";
  const name = entry.name ?? entry.full_name ?? "";
  const team = entry.team ?? entry.school ?? "";
  const role = entry.role ?? "";
  if (!slug || !name) return null;

  return {
    slug,
    name,
    team,
    role,
    d3_player_id: entry.d3_player_id != null ? String(entry.d3_player_id) : null,
  };
}

const registry = (players as RawPlayerEntry[])
  .map((entry) => normalizePlayerEntry(entry))
  .filter((entry): entry is PlayerRegistryEntry => entry != null);

const roster = rosterData as Record<string, { height?: string; weight?: string; class?: string }>;

export default function PlayersPage() {
  return <PlayersHubView registry={registry} roster={roster} />;
}
