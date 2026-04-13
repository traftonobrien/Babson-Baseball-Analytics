import { basename, extname } from "node:path";
import { readFileSync } from "node:fs";
import type { SidearmBaseballProgram } from "./scraper.ts";
import {
  getSidearmConferenceDefinition,
  listSidearmConferences,
  type SidearmConferenceDefinition,
} from "./registry.ts";

export interface Re288ManifestConference {
  id: string;
  name?: string;
  programs?: SidearmBaseballProgram[];
}

export interface Re288Manifest {
  season: number;
  poolId?: string;
  conferences: Re288ManifestConference[];
}

export interface ResolvedManifestConference {
  id: string;
  name: string;
  programs: SidearmBaseballProgram[];
  source: "registry" | "inline";
}

export interface ResolvedRe288Manifest {
  season: number;
  poolId: string;
  conferences: ResolvedManifestConference[];
}

export function loadManifestFromFile(filePath: string): Re288Manifest {
  return JSON.parse(readFileSync(filePath, "utf8")) as Re288Manifest;
}

export function resolveManifest(
  manifest: Re288Manifest,
  filePath?: string,
): ResolvedRe288Manifest {
  if (!Number.isInteger(manifest.season) || manifest.season < 2000) {
    throw new Error("Manifest must include a valid integer 'season'.");
  }

  if (!Array.isArray(manifest.conferences) || manifest.conferences.length === 0) {
    throw new Error("Manifest must include a non-empty 'conferences' array.");
  }

  const conferences = manifest.conferences.map((conference) => resolveManifestConference(conference));
  const poolId = sanitizeId(
    manifest.poolId
    ?? (filePath ? basename(filePath, extname(filePath)) : `pool-${manifest.season}`),
  );

  if (!poolId) {
    throw new Error("Manifest poolId resolved to an empty value.");
  }

  return {
    season: manifest.season,
    poolId,
    conferences,
  };
}

export function buildManifestValidationSummary(
  manifest: ResolvedRe288Manifest,
): {
  season: number;
  poolId: string;
  conferences: Array<{
    id: string;
    name: string;
    source: "registry" | "inline";
    programCount: number;
  }>;
  totalPrograms: number;
} {
  return {
    season: manifest.season,
    poolId: manifest.poolId,
    conferences: manifest.conferences.map((conference) => ({
      id: conference.id,
      name: conference.name,
      source: conference.source,
      programCount: conference.programs.length,
    })),
    totalPrograms: manifest.conferences.reduce(
      (sum, conference) => sum + conference.programs.length,
      0,
    ),
  };
}

function resolveManifestConference(
  conference: Re288ManifestConference,
): ResolvedManifestConference {
  if (!conference.id || !sanitizeId(conference.id)) {
    throw new Error("Every manifest conference must include a non-empty 'id'.");
  }

  if (conference.programs && conference.programs.length > 0) {
    return {
      id: sanitizeId(conference.id),
      name: conference.name?.trim() || conference.id,
      programs: validatePrograms(conference.programs, conference.id),
      source: "inline",
    };
  }

  const definition: SidearmConferenceDefinition = getSidearmConferenceDefinition(conference.id);
  return {
    id: definition.id,
    name: definition.name,
    programs: definition.programs,
    source: "registry",
  };
}

function validatePrograms(
  programs: SidearmBaseballProgram[],
  conferenceId: string,
): SidearmBaseballProgram[] {
  const seenProgramIds = new Set<string>();

  return programs.map((program) => {
    if (program.provider !== "sidearm") {
      throw new Error(`Program '${program.id}' in conference '${conferenceId}' must use provider 'sidearm'.`);
    }

    if (!program.id || !program.school || !program.baseUrl || !program.schedulePathTemplate) {
      throw new Error(`Program '${program.id || "unknown"}' in conference '${conferenceId}' is missing required fields.`);
    }

    const normalizedId = sanitizeId(program.id);
    if (!normalizedId) {
      throw new Error(`Program id '${program.id}' in conference '${conferenceId}' resolved to empty.`);
    }

    if (seenProgramIds.has(normalizedId)) {
      throw new Error(`Duplicate program id '${normalizedId}' in conference '${conferenceId}'.`);
    }
    seenProgramIds.add(normalizedId);

    return {
      ...program,
      id: normalizedId,
      conference: program.conference || conferenceId,
      aliases: Array.isArray(program.aliases) ? program.aliases : [],
    };
  });
}

function sanitizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listAvailableConferenceIds(): string[] {
  return listSidearmConferences().map((conference) => conference.id);
}
