import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";
import type { ChartingBootstrapPitcher, PitchType } from "./types";
import { PITCH_TYPES } from "./domain";
import {
  CANONICAL_BY_PLAYER_ID,
  HAND_BY_PLAYER_ID,
} from "@/lib/canonicalPlayersData";
import { pitchDisplayName } from "@/lib/pitchNames";

let arsenalPitchTypeMapPromise: Promise<Map<string, PitchType[]>> | null = null;

function mapArsenalPitchType(rawValue: string): PitchType {
  const normalized = pitchDisplayName(rawValue).trim().toLowerCase();

  if (normalized.includes("fastball") || normalized.includes("sinker")) {
    return "Fastball";
  }
  if (normalized.includes("slider") || normalized.includes("sweeper")) {
    return "Slider";
  }
  if (normalized.includes("curve")) {
    return "Curveball";
  }
  if (normalized.includes("change")) {
    return "Changeup";
  }
  if (normalized.includes("split") || normalized.includes("cutter")) {
    return "Split/Cut";
  }

  // Fallback to Fastball if we don't know what it is (shouldn't happen with our known arsenals)
  return "Fastball";
}

function orderPitchTypes(pitchTypes: PitchType[]): PitchType[] {
  const uniqueTypes = new Set<PitchType>(pitchTypes);
  return PITCH_TYPES.filter((pitchType) => uniqueTypes.has(pitchType));
}

async function loadArsenalPitchTypesByPlayer(): Promise<Map<string, PitchType[]>> {
  if (arsenalPitchTypeMapPromise) {
    return arsenalPitchTypeMapPromise;
  }

  arsenalPitchTypeMapPromise = (async () => {
    const csvPath = path.join(process.cwd(), "public", "data", "Arsenals.csv");
    const text = await fs.readFile(csvPath, "utf8");
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    const pitchTypesByPlayer = new Map<string, PitchType[]>();

    for (const row of parsed.data) {
      const playerId = row.player_id?.trim();
      if (!playerId) continue;

      const rawPitchType = row.abbreviation?.trim() || row.pitch_type?.trim() || "";
      const mappedPitchType = mapArsenalPitchType(rawPitchType);
      const current = pitchTypesByPlayer.get(playerId) ?? [];
      current.push(mappedPitchType);
      pitchTypesByPlayer.set(playerId, current);
    }

    for (const [playerId, pitchTypes] of pitchTypesByPlayer.entries()) {
      pitchTypesByPlayer.set(playerId, orderPitchTypes(pitchTypes));
    }

    return pitchTypesByPlayer;
  })();

  return arsenalPitchTypeMapPromise;
}

export async function buildBootstrapPitchers(): Promise<ChartingBootstrapPitcher[]> {
  const arsenalPitchTypesByPlayer = await loadArsenalPitchTypesByPlayer();

  const pitchers: ChartingBootstrapPitcher[] = [];

  for (const [playerId, name] of Object.entries(CANONICAL_BY_PLAYER_ID)) {
    const arsenal = arsenalPitchTypesByPlayer.get(playerId);

    // Only include players who actually pitch (have a defined arsenal in Arsenals.csv)
    if (arsenal && arsenal.length > 0) {
      const withOther = arsenal.includes("Other") ? arsenal : [...arsenal, "Other"];
      pitchers.push({
        playerId,
        name,
        throws: (HAND_BY_PLAYER_ID[playerId] ?? "R") as "R" | "L",
        arsenalPitchTypes: withOther,
      });
    }
  }

  return pitchers.sort((a, b) => a.name.localeCompare(b.name));
}
