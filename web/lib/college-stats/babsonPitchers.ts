/**
 * Filter the NCAA pitching leaderboard to Babson pitchers only.
 */

export interface PitchingLeaderboardRow {
  player_id?: string;
  player_name?: string;
  team_id?: number;
  team_name?: string;
  ip?: number;
  ip_float?: number;
  h?: number;
  r?: number;
  er?: number;
  bb?: number;
  so?: number;
  bf?: number;
  war?: number;
  era?: number;
  whip?: number;
  k_pct?: number;
  bb_pct?: number;
  k_minus_bb_pct?: number | string;
  fip?: number;
  xfip?: number;
  k9?: number;
  bb9?: number;
  h9?: number;
  gs?: number;
  app?: number;
  w?: number;
  l?: number;
  sv?: number;
  era_plus?: number;
  hr_a?: number;
  hb?: number;
  go?: number;
  fo?: number;
  ibb?: number;
  pitches?: number;
  [key: string]: unknown;
}

export interface BabsonPitcherRow {
  playerId: string;
  playerName: string;
  ip: number;
  h: number;
  r: number;
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
  fip: number;
  xfip: number;
  siera: number;
  k9: number;
  bb9: number;
  h9: number;
  hr9: number;
  gs: number;
  app: number;
  w: number;
  l: number;
  sv: number;
  eraPlus: number;
  hr: number;
  hb: number;
  go: number;
  fo: number;
  ibb: number;
  pitches: number;
}

export interface QualifiedAggregate {
  pitcherCount: number;
  minIp: number;
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

/** Default minimum IP to qualify for team aggregate (college standard). */
export const DEFAULT_MIN_IP_QUALIFIED = 15;

/**
 * Compute SIERA (Skill-Interactive ERA) from available counting stats.
 * Uses ground outs (go) and fly outs (fo) as a proxy for GB/FB rates.
 * Formula: Zimmermann & Stephenson (FanGraphs).
 */
function computeSiera(so: number, bb: number, bf: number, go: number, fo: number): number {
  if (bf <= 0) return 0;
  const k = so / bf;
  const w = bb / bf;
  const g = (go - fo) / bf;
  const siera =
    6.145 -
    16.986 * k +
    11.434 * w -
    1.858 * g +
    7.653 * k * k -
    6.664 * g * Math.abs(g) +
    10.130 * k * g -
    5.195 * w * g;
  return Math.max(0, siera);
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

/** Team name variations for Babson in leaderboard data. */
const BABSON_NAMES = ["Babson", "Babson College", "Babson College Beavers"];

function isBabson(teamName: string): boolean {
  const t = teamName.trim();
  return BABSON_NAMES.some((b) => t === b || t.toLowerCase().includes("babson"));
}

export function filterBabsonPitchers(rows: PitchingLeaderboardRow[]): BabsonPitcherRow[] {
  const result: BabsonPitcherRow[] = [];

  for (const row of rows) {
    const teamName = String(row.team_name ?? "").trim();
    if (!isBabson(teamName)) continue;

    const ip = num(row.ip_float) || num(row.ip);
    if (ip <= 0) continue;

    const playerId = String(row.player_id ?? "").trim();
    const playerName = String(row.player_name ?? "").trim();
    if (!playerId || !playerName) continue;

    const h = num(row.h);
    const r = num(row.r);
    const er = num(row.er);
    const bb = num(row.bb);
    const so = num(row.so);
    const bf = num(row.bf);
    const hr = num(row.hr_a);
    const hb = num(row.hb);
    const go = num(row.go);
    const fo = num(row.fo);
    const ibb = num(row.ibb);
    const pitches = num(row.pitches);
    const war = num(row.war);
    const era = num(row.era) || (ip > 0 ? (er * 9) / ip : 0);
    const whip = num(row.whip) || (ip > 0 ? (h + bb) / ip : 0);
    const kPct = num(row.k_pct) || (bf > 0 ? (so / bf) * 100 : 0);
    const bbPct = num(row.bb_pct) || (bf > 0 ? (bb / bf) * 100 : 0);
    const kMinusBbPct =
      row.k_minus_bb_pct == null || row.k_minus_bb_pct === ""
        ? kPct - bbPct
        : num(row.k_minus_bb_pct);
    const k9 = num(row.k9) || (ip > 0 ? (so * 9) / ip : 0);
    const bb9 = num(row.bb9) || (ip > 0 ? (bb * 9) / ip : 0);
    const h9 = num(row.h9) || (ip > 0 ? (h * 9) / ip : 0);
    const hr9 = ip > 0 ? (hr * 9) / ip : 0;
    const eraPlus = num(row.era_plus);
    const xfip = num(row.xfip);
    const siera = computeSiera(so, bb, bf, go, fo);

    result.push({
      playerId,
      playerName,
      ip,
      h,
      r,
      er,
      bb,
      so,
      bf,
      hr,
      hb,
      go,
      fo,
      ibb,
      pitches,
      war,
      era,
      whip,
      kPct,
      bbPct,
      kMinusBbPct,
      fip: num(row.fip),
      xfip,
      siera,
      k9,
      bb9,
      h9,
      hr9,
      gs: num(row.gs),
      app: num(row.app),
      w: num(row.w),
      l: num(row.l),
      sv: num(row.sv),
      eraPlus,
    });
  }

  return result;
}

export function computeQualifiedAggregate(
  pitchers: BabsonPitcherRow[],
  minIp: number = DEFAULT_MIN_IP_QUALIFIED,
): QualifiedAggregate | null {
  const qualified = pitchers.filter((p) => p.ip >= minIp);
  if (qualified.length === 0) return null;

  let ip = 0;
  let h = 0;
  let er = 0;
  let bb = 0;
  let so = 0;
  let bf = 0;
  let war = 0;

  for (const p of qualified) {
    ip += p.ip;
    h += p.h;
    er += p.er;
    bb += p.bb;
    so += p.so;
    bf += p.bf;
    war += p.war;
  }

  const era = ip > 0 ? (er * 9) / ip : 0;
  const whip = ip > 0 ? (h + bb) / ip : 0;
  const kPct = bf > 0 ? (so / bf) * 100 : 0;
  const bbPct = bf > 0 ? (bb / bf) * 100 : 0;
  const kMinusBbPct = kPct - bbPct;

  return {
    pitcherCount: qualified.length,
    minIp,
    ip,
    h,
    er,
    bb,
    so,
    bf,
    war,
    era,
    whip,
    kPct,
    bbPct,
    kMinusBbPct,
  };
}
