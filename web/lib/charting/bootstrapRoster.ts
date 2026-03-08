import rosterData from "@/data/chartingRoster.json";
import { PLAYER_ID_BY_SLUG } from "@/lib/canonicalPlayersData";
import type { ChartingBootstrapRosterPlayer } from "./types";

type RawChartingRosterPlayer = {
  slug: string;
  name: string;
  positions?: string[];
  bats?: string | null;
  throws?: string | null;
  academicYear?: string | null;
};

export function buildBootstrapRosterPlayers(): ChartingBootstrapRosterPlayer[] {
  return (rosterData as RawChartingRosterPlayer[])
    .map((player) => {
      const positions = (player.positions ?? []).filter(Boolean);
      return {
        slug: player.slug,
        playerId: PLAYER_ID_BY_SLUG[player.slug] ?? null,
        name: player.name,
        positions,
        bats: player.bats ?? null,
        throws: player.throws ?? null,
        academicYear: player.academicYear ?? null,
        isPitcher: positions.some((position) => position.toUpperCase().includes("P")),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
