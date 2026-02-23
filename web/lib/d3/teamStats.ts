/**
 * Aggregate D3 pitching leaderboard by team for team statistics leaderboard.
 */

export interface D3PitcherRow {
  team_id?: number;
  team_name?: string;
  ip?: number;
  ip_float?: number;
  h?: number;
  er?: number;
  bb?: number;
  so?: number;
  bf?: number;
  war?: number;
  era?: number;
  whip?: number;
  k_pct?: number;
  bb_pct?: number;
  k_minus_bb_pct?: number;
  [key: string]: unknown;
}

export interface TeamStatsRow {
  rank: number;
  teamId: number;
  teamName: string;
  pitcherCount: number;
  ip: number;
  h: number;
  er: number;
  bb: number;
  so: number;
  bf: number;
  war: number;
  era: number;
  whip: number;
  kPct: number;
  bbPct: number;
  kMinusBbPct: number;
}

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const parsed = parseFloat(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function aggregateTeamStats(rows: D3PitcherRow[]): TeamStatsRow[] {
  const byTeam = new Map<number, { teamName: string; ip: number; h: number; er: number; bb: number; so: number; bf: number; war: number }>();

  for (const row of rows) {
    const teamId = num(row.team_id);
    const teamName = String(row.team_name ?? "").trim();
    if (!teamId || !teamName) continue;

    const ip = num(row.ip_float) || num(row.ip);
    if (ip <= 0) continue;

    const entry = byTeam.get(teamId);
    const h = num(row.h);
    const er = num(row.er);
    const bb = num(row.bb);
    const so = num(row.so);
    const bf = num(row.bf);
    const war = num(row.war);

    if (entry) {
      entry.ip += ip;
      entry.h += h;
      entry.er += er;
      entry.bb += bb;
      entry.so += so;
      entry.bf += bf;
      entry.war += war;
    } else {
      byTeam.set(teamId, { teamName, ip, h, er, bb, so, bf, war });
    }
  }

  const result: TeamStatsRow[] = [];
  for (const [teamId, agg] of byTeam.entries()) {
    const era = agg.ip > 0 ? (agg.er * 9) / agg.ip : 0;
    const whip = agg.ip > 0 ? (agg.h + agg.bb) / agg.ip : 0;
    const kPct = agg.bf > 0 ? (agg.so / agg.bf) * 100 : 0;
    const bbPct = agg.bf > 0 ? (agg.bb / agg.bf) * 100 : 0;
    const kMinusBbPct = kPct - bbPct;

    result.push({
      rank: 0,
      teamId,
      teamName: agg.teamName,
      pitcherCount: 0,
      ip: agg.ip,
      h: agg.h,
      er: agg.er,
      bb: agg.bb,
      so: agg.so,
      bf: agg.bf,
      war: agg.war,
      era,
      whip,
      kPct,
      bbPct,
      kMinusBbPct,
    });
  }

  // Count pitchers per team
  const pitcherCounts = new Map<number, number>();
  for (const row of rows) {
    const teamId = num(row.team_id);
    if (teamId && num(row.ip_float || row.ip) > 0) {
      pitcherCounts.set(teamId, (pitcherCounts.get(teamId) ?? 0) + 1);
    }
  }
  for (const r of result) {
    r.pitcherCount = pitcherCounts.get(r.teamId) ?? 0;
  }

  return result;
}
