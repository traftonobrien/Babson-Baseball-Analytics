import opponentsData from "../../public/data/opponents.json";

export type ChartingOpponentPlayer = {
  name: string;
  bats: string;
  throws: string;
};

type OpponentRosterMap = Record<
  string,
  Record<string, { bats: string; throws: string }>
>;

const teamMap = opponentsData as OpponentRosterMap;

const TEAM_ALIAS_MAP: Record<string, string> = {
  trinityconn: "trinityct",
  trinityconnecticut: "trinityct",
  trinitytexas: "trinitytx",
  universitynewengland: "newenglandcollege",
  uofnewengland: "newenglandcollege",
  unewengland: "newenglandcollege",
};

function normalizeOpponentTeamName(teamName: string): string {
  const expanded = teamName
    .replace(/\s*\(G\d\)\s*$/i, "")
    .toLowerCase()
    .replace(/#\d+(?:\/\d+)?/g, " ")
    .replace(/\bu\.\b/g, " university ")
    .replace(/\bconn\.?\b/g, " connecticut ")
    .replace(/\bcol\.?\b/g, " college ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ");

  const normalized = expanded
    .trim()
    .split(/\s+/)
    .filter((token) => token && token !== "of" && token !== "the" && token !== "and")
    .join("");

  return TEAM_ALIAS_MAP[normalized] ?? normalized;
}

function normalizeOpponentPlayerName(playerName: string): string {
  const trimmed = playerName.trim();
  if (!trimmed) {
    return "";
  }

  const reordered = trimmed.includes(",")
    ? trimmed
        .split(",")
        .map((part) => part.trim())
        .reverse()
        .join(" ")
    : trimmed;

  return reordered
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveOpponentRosterTeamName(
  opponentTeamName: string,
): string | null {
  const target = normalizeOpponentTeamName(opponentTeamName);
  if (!target) {
    return null;
  }

  return (
    Object.keys(teamMap).find(
      (teamName) => normalizeOpponentTeamName(teamName) === target,
    ) ?? null
  );
}

export function getOpponentRoster(
  opponentTeamName: string,
): ChartingOpponentPlayer[] {
  const matchedTeam = resolveOpponentRosterTeamName(opponentTeamName);
  if (!matchedTeam) {
    return [];
  }

  const team = teamMap[matchedTeam];
  if (!team) {
    return [];
  }

  return Object.entries(team)
    .map(([name, data]) => ({
      name,
      bats: data.bats,
      throws: data.throws,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableOpponentTeams(): string[] {
  return Object.keys(teamMap).sort((left, right) => left.localeCompare(right));
}

export function findOpponentRosterPlayer(
  roster: ChartingOpponentPlayer[],
  playerName: string,
): ChartingOpponentPlayer | null {
  const target = normalizeOpponentPlayerName(playerName);
  if (!target) {
    return null;
  }

  return (
    roster.find(
      (player) => normalizeOpponentPlayerName(player.name) === target,
    ) ?? null
  );
}
