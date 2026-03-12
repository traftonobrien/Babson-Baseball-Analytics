import { isNotNull } from "drizzle-orm";
import { legacyChartingPlateAppearances } from "./plateAppearanceStorage";

export interface LiveAbOpsPlusBaseline {
  plateAppearances: number;
  atBats: number;
  hits: number;
  walks: number;
  hitByPitch: number;
  totalBases: number;
  obp: number | null;
  slg: number | null;
}

type OpsPlusEligibleRow = {
  obp: number | null;
  slg: number | null;
};

const HIT_RESULT_CODES = new Set(["1B", "2B", "3B", "HR"]);

function totalBasesForResult(resultCode: string): number {
  switch (resultCode) {
    case "1B":
      return 1;
    case "2B":
      return 2;
    case "3B":
      return 3;
    case "HR":
      return 4;
    default:
      return 0;
  }
}

export function buildLiveAbOpsPlusBaseline(
  plateAppearances: Array<{ resultCode: string | null }>
): LiveAbOpsPlusBaseline {
  const closedPlateAppearances = plateAppearances
    .map((plateAppearance) => plateAppearance.resultCode)
    .filter((resultCode): resultCode is string => resultCode !== null);

  const walks = closedPlateAppearances.filter((resultCode) => resultCode === "BB").length;
  const hitByPitch = closedPlateAppearances.filter(
    (resultCode) => resultCode === "HBP"
  ).length;
  const hits = closedPlateAppearances.filter((resultCode) =>
    HIT_RESULT_CODES.has(resultCode)
  ).length;
  const atBats = closedPlateAppearances.length - walks - hitByPitch;
  const totalBases = closedPlateAppearances.reduce(
    (sum, resultCode) => sum + totalBasesForResult(resultCode),
    0
  );
  const obp =
    closedPlateAppearances.length > 0
      ? (hits + walks + hitByPitch) / closedPlateAppearances.length
      : null;
  const slg = atBats > 0 ? totalBases / atBats : null;

  return {
    plateAppearances: closedPlateAppearances.length,
    atBats,
    hits,
    walks,
    hitByPitch,
    totalBases,
    obp,
    slg,
  };
}

export function computeOpsPlus(
  obp: number | null,
  slg: number | null,
  baseline: LiveAbOpsPlusBaseline | null
): number | null {
  if (
    obp === null ||
    slg === null ||
    baseline === null ||
    baseline.obp === null ||
    baseline.slg === null ||
    baseline.obp <= 0 ||
    baseline.slg <= 0
  ) {
    return null;
  }

  return 100 * (obp / baseline.obp + slg / baseline.slg - 1);
}

export function withOpsPlus<T extends OpsPlusEligibleRow>(
  row: T,
  baseline: LiveAbOpsPlusBaseline | null
): T & { opsPlus: number | null } {
  return {
    ...row,
    opsPlus: computeOpsPlus(row.obp, row.slg, baseline),
  };
}

export async function loadLiveAbOpsPlusBaseline(): Promise<LiveAbOpsPlusBaseline> {
  const { db } = await import("@/db");
  const plateAppearances = await db
    .select({ resultCode: legacyChartingPlateAppearances.resultCode })
    .from(legacyChartingPlateAppearances)
    .where(isNotNull(legacyChartingPlateAppearances.resultCode));

  return buildLiveAbOpsPlusBaseline(plateAppearances);
}
