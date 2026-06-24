// Pure logic — no DB imports. Safe for vitest.

/** Result codes that are baserunner events, not plate appearances. Skip entirely. */
export const BASERUNNER_ONLY_CODES = new Set(["CS", "PO"]);

/** Result codes that count as a PA but not an AB. */
const NO_AB_CODES = new Set(["BB", "IBB", "HBP", "SAC", "SF"]);

/** Result codes that count as a hit (including reach-on-error single). */
const HIT_CODES = new Set(["1B", "2B", "3B", "HR", "1B+E"]);

/** Result codes that count as a walk for OBP. */
const WALK_CODES = new Set(["BB", "IBB"]);

export interface HitterAccumulator {
  hitterName: string;
  pa: number;
  ab: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  sacFly: number;
  sacBunt: number;
}

export interface FallHitterAggregate extends HitterAccumulator {
  playerId: string | null;
  playerSlug: string | null;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  woba: number | null;
  source: "charting" | "excel_import";
}

export function makeAccumulator(hitterName: string): HitterAccumulator {
  return {
    hitterName,
    pa: 0,
    ab: 0,
    hits: 0,
    singles: 0,
    doubles: 0,
    triples: 0,
    hr: 0,
    bb: 0,
    hbp: 0,
    k: 0,
    sacFly: 0,
    sacBunt: 0,
  };
}

export function addResultCode(acc: HitterAccumulator, resultCode: string): void {
  if (BASERUNNER_ONLY_CODES.has(resultCode)) return;

  acc.pa += 1;

  if (!NO_AB_CODES.has(resultCode)) acc.ab += 1;
  if (HIT_CODES.has(resultCode)) acc.hits += 1;
  if (resultCode === "1B" || resultCode === "1B+E") acc.singles += 1;
  if (resultCode === "2B") acc.doubles += 1;
  if (resultCode === "3B") acc.triples += 1;
  if (resultCode === "HR") acc.hr += 1;
  if (WALK_CODES.has(resultCode)) acc.bb += 1;
  if (resultCode === "HBP") acc.hbp += 1;
  if (resultCode === "K") acc.k += 1;
  if (resultCode === "SF") acc.sacFly += 1;
  if (resultCode === "SAC") acc.sacBunt += 1;
}

export function computeSlash(acc: HitterAccumulator): {
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
} {
  const avg = acc.ab > 0 ? acc.hits / acc.ab : null;

  const obpDenom = acc.ab + acc.bb + acc.hbp + acc.sacFly;
  const obp = obpDenom > 0 ? (acc.hits + acc.bb + acc.hbp) / obpDenom : null;

  const tb = acc.singles + 2 * acc.doubles + 3 * acc.triples + 4 * acc.hr;
  const slg = acc.ab > 0 ? tb / acc.ab : null;

  const ops = obp !== null && slg !== null ? obp + slg : null;

  return { avg, obp, slg, ops };
}

/** Build an aggregate map from a flat list of { hitterName, resultCode } rows. */
export function buildAggregateMap(
  rows: Array<{ hitterName: string; resultCode: string }>,
): Map<string, HitterAccumulator> {
  const map = new Map<string, HitterAccumulator>();

  for (const row of rows) {
    if (BASERUNNER_ONLY_CODES.has(row.resultCode)) continue;

    let acc = map.get(row.hitterName);
    if (!acc) {
      acc = makeAccumulator(row.hitterName);
      map.set(row.hitterName, acc);
    }

    addResultCode(acc, row.resultCode);
  }

  return map;
}
