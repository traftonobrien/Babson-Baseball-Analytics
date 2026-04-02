export type TeamBrandEntry = {
  name: string;
  aliases: string[];
  accent?: string;
  secondary?: string;
  source?: "teamcolorcodes";
};

// This is the local opponent-brand backlog.
// Only add `accent`/`secondary` when the school color has been explicitly verified.
// Until then, the UI uses a stable generated accent based on the canonical team name.
const TEAM_BRAND_DIRECTORY: TeamBrandEntry[] = [
  {
    name: "Babson",
    aliases: ["babson", "babson college"],
    accent: "#154734",
    secondary: "#A89968",
    source: "teamcolorcodes",
  },
  {
    name: "Trinity (Texas)",
    aliases: ["trinity texas", "trinity tx", "trinity san antonio"],
    accent: "#8C2129",
    secondary: "#808080",
    source: "teamcolorcodes",
  },
  {
    name: "Bowdoin",
    aliases: ["bowdoin", "bowdoin college"],
    accent: "#A7A5A6",
    secondary: "#231F20",
    source: "teamcolorcodes",
  },
  {
    name: "Saint Joseph (Conn.)",
    aliases: ["saint joseph conn", "saint josephs conn", "st joseph conn"],
    accent: "#FCD006",
    secondary: "#0E2B58",
    source: "teamcolorcodes",
  },
  {
    name: "Amherst",
    aliases: ["amherst", "amherst college"],
    accent: "#470A77",
    source: "teamcolorcodes",
  },
  {
    name: "Scranton",
    aliases: ["scranton", "university of scranton"],
    accent: "#6E4990",
    secondary: "#231F20",
    source: "teamcolorcodes",
  },
  {
    name: "Johns Hopkins",
    aliases: ["johns hopkins", "johns hopkins university"],
    accent: "#73B0E4",
    secondary: "#231F20",
    source: "teamcolorcodes",
  },
  {
    name: "Rutgers-Newark",
    aliases: ["rutgers newark", "rutgers newark scarlet raiders"],
  },
  {
    name: "Franklin & Marshall",
    aliases: ["franklin marshall", "franklin and marshall"],
  },
  {
    name: "Wheaton",
    aliases: ["wheaton", "wheaton college"],
    accent: "#155196",
    secondary: "#A9B6DA",
    source: "teamcolorcodes",
  },
  {
    name: "Suffolk",
    aliases: ["suffolk", "suffolk university"],
    accent: "#C6A140",
    secondary: "#172A47",
    source: "teamcolorcodes",
  },
  {
    name: "Roger Williams",
    aliases: ["roger williams", "roger williams university"],
    accent: "#9BC9EA",
    secondary: "#01295F",
    source: "teamcolorcodes",
  },
  {
    name: "Coast Guard",
    aliases: ["coast guard", "uscga", "united states coast guard academy"],
    accent: "#F2531B",
    secondary: "#223C70",
    source: "teamcolorcodes",
  },
  {
    name: "Trinity (Conn.)",
    aliases: ["trinity conn", "trinity ct", "trinity college hartford"],
  },
  {
    name: "Nichols",
    aliases: ["nichols", "nichols college"],
    accent: "#017B5E",
    secondary: "#221F20",
    source: "teamcolorcodes",
  },
  {
    name: "UMass Boston",
    aliases: ["umass boston", "massachusetts boston"],
    accent: "#516FBF",
    secondary: "#231F20",
    source: "teamcolorcodes",
  },
  {
    name: "Salve Regina",
    aliases: ["salve regina", "salve regina university"],
    accent: "#005588",
    secondary: "#AA8800",
    source: "teamcolorcodes",
  },
  {
    name: "Rhode Island College",
    aliases: ["rhode island college", "ric"],
  },
  {
    name: "MIT",
    aliases: ["mit", "massachusetts institute of technology"],
    accent: "#A31F34",
    secondary: "#A2A6B2",
    source: "teamcolorcodes",
  },
  {
    name: "Tufts",
    aliases: ["tufts", "tufts university"],
    accent: "#3E8EDE",
    secondary: "#512D6D",
    source: "teamcolorcodes",
  },
  {
    name: "UMass Dartmouth",
    aliases: ["umass dartmouth", "massachusetts dartmouth"],
  },
  {
    name: "Emerson",
    aliases: ["emerson", "emerson college"],
    accent: "#522D80",
    secondary: "#282A2D",
    source: "teamcolorcodes",
  },
  {
    name: "Springfield",
    aliases: ["springfield", "springfield college"],
    accent: "#A31F34",
    secondary: "#FFFFFF",
    source: "teamcolorcodes",
  },
  {
    name: "Lasell",
    aliases: ["lasell", "lasell university"],
  },
  {
    name: "Johnson & Wales",
    aliases: ["johnson wales", "johnson and wales"],
  },
  {
    name: "Clark",
    aliases: ["clark", "clark university"],
    accent: "#F26826",
    secondary: "#5A2D81",
    source: "teamcolorcodes",
  },
  {
    name: "Keene State",
    aliases: ["keene state", "keene state college"],
  },
  {
    name: "WPI",
    aliases: ["wpi", "worcester polytechnic institute"],
  },
];

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const safeHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const int = Number.parseInt(safeHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function normalizeTeamName(value: string): string {
  return value
    .toLowerCase()
    .replace(/#\d+(?:\/\d+)?\s*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hashTeamName(normalizedName: string): number {
  let hash = 0;
  for (let index = 0; index < normalizedName.length; index += 1) {
    hash = (hash * 31 + normalizedName.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = secondary;
  } else if (segment < 2) {
    red = secondary;
    green = chroma;
  } else if (segment < 3) {
    green = chroma;
    blue = secondary;
  } else if (segment < 4) {
    green = secondary;
    blue = chroma;
  } else if (segment < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  const match = l - chroma / 2;
  const toHex = (channel: number) =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function generatedAccent(normalizedName: string): string {
  const hash = hashTeamName(normalizedName);
  const hue = hash % 360;
  const saturation = 54 + (hash % 9);
  const lightness = 48 + ((hash >> 3) % 6);
  return hslToHex(hue, saturation, lightness);
}

function matchesAlias(normalizedName: string, alias: string): boolean {
  return normalizedName === alias || normalizedName.includes(alias) || alias.includes(normalizedName);
}

export function getTeamBrandEntry(teamName: string): TeamBrandEntry | null {
  const normalized = normalizeTeamName(teamName);
  if (!normalized) return null;

  for (const entry of TEAM_BRAND_DIRECTORY) {
    if (entry.aliases.some((alias) => matchesAlias(normalized, normalizeTeamName(alias)))) {
      return entry;
    }
  }

  return null;
}

export function getTeamAccentColor(teamName: string): string {
  const normalized = normalizeTeamName(teamName);
  if (!normalized) return "#f97316";

  const match = getTeamBrandEntry(teamName);
  if (match?.accent) {
    return match.accent;
  }

  return generatedAccent(normalizeTeamName(match?.name ?? teamName));
}
