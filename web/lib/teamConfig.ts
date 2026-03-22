type TeamBrandTheme = {
  primary: string;
  primaryHover: string;
  primaryRgb: string;
  soft: string;
  softStrong: string;
  surface: string;
  border: string;
  subtleText: string;
  spotlight: string;
  deep: string;
  deepAlt: string;
};

type TeamConfig = {
  key: string;
  name: string;
  brand: TeamBrandTheme;
};

/**
 * Team identity configuration.
 *
 * NEXT_PUBLIC_TEAM_NAME is set in Vercel environment variables.
 * It is read at build time for client components and at runtime for server components.
 *
 * Default: "Babson" — so existing deployments are unchanged until overridden.
 */
export const TEAM_NAME: string = process.env.NEXT_PUBLIC_TEAM_NAME ?? "Babson";

const TEAM_PRIMARY_COLOR = process.env.NEXT_PUBLIC_TEAM_PRIMARY_COLOR ?? null;

const TEAM_PRIMARY_BY_KEY: Record<string, string> = {
  babson: "#125e40",
};

function normalizeTeamKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  const compact = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  if (/^[0-9a-fA-F]{3}$/.test(compact)) {
    return `#${compact
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(compact)) {
    return `#${compact.toLowerCase()}`;
  }

  return "#125e40";
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex);
  const numeric = Number.parseInt(normalized.slice(1), 16);
  return [
    (numeric >> 16) & 255,
    (numeric >> 8) & 255,
    numeric & 255,
  ];
}

function rgbToHex([red, green, blue]: [number, number, number]): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHex(baseHex: string, targetHex: string, targetWeight: number): string {
  const [baseRed, baseGreen, baseBlue] = hexToRgb(baseHex);
  const [targetRed, targetGreen, targetBlue] = hexToRgb(targetHex);
  const clampedWeight = Math.max(0, Math.min(1, targetWeight));
  const baseWeight = 1 - clampedWeight;

  return rgbToHex([
    Math.round(baseRed * baseWeight + targetRed * clampedWeight),
    Math.round(baseGreen * baseWeight + targetGreen * clampedWeight),
    Math.round(baseBlue * baseWeight + targetBlue * clampedWeight),
  ]);
}

function createBrandTheme(primaryHex: string): TeamBrandTheme {
  const primary = normalizeHex(primaryHex);
  const [red, green, blue] = hexToRgb(primary);

  return {
    primary,
    primaryHover: mixHex(primary, "#000000", 0.16),
    primaryRgb: `${red}, ${green}, ${blue}`,
    soft: mixHex(primary, "#ffffff", 0.9),
    softStrong: mixHex(primary, "#ffffff", 0.82),
    surface: mixHex(primary, "#ffffff", 0.95),
    border: mixHex(primary, "#ffffff", 0.72),
    subtleText: mixHex(primary, "#000000", 0.12),
    spotlight: mixHex(primary, "#ffffff", 0.56),
    deep: mixHex(primary, "#000000", 0.46),
    deepAlt: mixHex(primary, "#000000", 0.18),
  };
}

const teamKey = normalizeTeamKey(TEAM_NAME);
const teamPrimary =
  TEAM_PRIMARY_COLOR ?? TEAM_PRIMARY_BY_KEY[teamKey] ?? "#0f766e";

const TEAM_CONFIG: TeamConfig = {
  key: teamKey,
  name: TEAM_NAME,
  brand: createBrandTheme(teamPrimary),
};

export const TEAM_THEME = TEAM_CONFIG.brand;

/**
 * Server-side helper that returns the active team config.
 * Other deployments can override the accent by setting
 * NEXT_PUBLIC_TEAM_PRIMARY_COLOR without touching the UI code.
 */
export function getTeamConfig(): TeamConfig {
  return TEAM_CONFIG;
}
