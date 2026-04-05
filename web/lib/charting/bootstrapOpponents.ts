import opponentsData from "../../public/data/opponents.json";

export type ChartingOpponentPlayer = {
  name: string;
  bats: string;
  throws: string;
};

export function getOpponentRoster(opponentTeamName: string): ChartingOpponentPlayer[] {
  // Use fuzzy mapping if necessary, or just exact match
  const teamMap = opponentsData as Record<string, Record<string, { bats: string; throws: string }>>;
  
  // Clean names for matching
  const target = opponentTeamName.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  const exactTeam = Object.keys(teamMap).find(t => 
    t.toLowerCase().replace(/[^a-z0-9]/g, "") === target
  );

  if (!exactTeam) return [];

  const team = teamMap[exactTeam];
  if (!team) return [];

  return Object.entries(team).map(([name, data]) => ({
    name,
    bats: data.bats,
    throws: data.throws,
  })).sort((a, b) => a.name.localeCompare(b.name));
}
