import pitcherPlayers from "@/data/players.json";
import chartingRoster from "@/data/chartingRoster.json";

type RawPitcherPlayer = {
  player_slug?: string;
  slug?: string;
  full_name?: string;
  name?: string;
  team?: string;
  school?: string;
  role?: string;
  d3_player_id?: number | string | null;
  ncaa_player_id?: number | string | null;
};

type RawChartingRosterPlayer = {
  slug: string;
  name: string;
  positions?: string[];
  bats?: string | null;
  throws?: string | null;
  academicYear?: string | null;
};

export interface PlayerRegistryEntry {
  slug: string;
  name: string;
  team: string;
  role: string;
  d3_player_id: string | null;
  ncaa_player_id: string | null;
  positions: string[];
  bats: string | null;
  throws: string | null;
  academicYear: string | null;
  isPitcher: boolean;
  isHitter: boolean;
  isTwoWay: boolean;
}

function normalizePitcherEntry(entry: RawPitcherPlayer) {
  const slug = entry.slug ?? entry.player_slug ?? "";
  const name = entry.name ?? entry.full_name ?? "";
  const team = entry.team ?? entry.school ?? "Babson";
  if (!slug || !name) {
    return null;
  }

  return {
    slug,
    name,
    team,
    d3_player_id: entry.d3_player_id != null ? String(entry.d3_player_id) : null,
    ncaa_player_id: entry.ncaa_player_id != null ? String(entry.ncaa_player_id) : null,
  };
}

function classifyPositions(positions: string[]) {
  const upper = positions.map((position) => position.toUpperCase());
  const isPitcher = upper.some((position) => position.includes("P"));
  const isHitter =
    !isPitcher ||
    upper.some(
      (position) =>
        position !== "P" &&
        position !== "RHP" &&
        position !== "LHP"
    );

  return {
    isPitcher,
    isHitter,
    isTwoWay: isPitcher && isHitter,
  };
}

function buildRoleLabel(positions: string[], isPitcher: boolean, isHitter: boolean): string {
  if (isPitcher && isHitter) {
    return "Two-Way";
  }
  if (isPitcher) {
    return "Pitcher";
  }
  if (positions.length > 0) {
    return positions.join(" / ");
  }
  return isHitter ? "Hitter" : "Player";
}

const pitcherEntryBySlug = new Map(
  (pitcherPlayers as RawPitcherPlayer[])
    .map(normalizePitcherEntry)
    .filter((entry): entry is NonNullable<ReturnType<typeof normalizePitcherEntry>> => entry != null)
    .map((entry) => [entry.slug, entry])
);

export const playerRegistry: PlayerRegistryEntry[] = (chartingRoster as RawChartingRosterPlayer[])
  .map((player) => {
    const positions = (player.positions ?? []).filter(Boolean);
    const { isPitcher, isHitter, isTwoWay } = classifyPositions(positions);
    const pitcherEntry = pitcherEntryBySlug.get(player.slug);

    return {
      slug: player.slug,
      name: player.name,
      team: pitcherEntry?.team ?? "Babson",
      role: buildRoleLabel(positions, isPitcher, isHitter),
      d3_player_id: pitcherEntry?.d3_player_id ?? null,
      ncaa_player_id: pitcherEntry?.ncaa_player_id ?? null,
      positions,
      bats: player.bats ?? null,
      throws: player.throws ?? null,
      academicYear: player.academicYear ?? null,
      isPitcher,
      isHitter,
      isTwoWay,
    } satisfies PlayerRegistryEntry;
  })
  .sort((left, right) => left.name.localeCompare(right.name));

export function getPlayerBySlug(slug: string): PlayerRegistryEntry | null {
  return playerRegistry.find((player) => player.slug === slug) ?? null;
}
