import newmacBaseballPrograms from "../config/data_sources/newmac_baseball_programs.json" with { type: "json" };
import nescacBaseballPrograms from "../config/data_sources/nescac_baseball_programs.json" with { type: "json" };
import libertyLeagueBaseballPrograms from "../config/data_sources/liberty_league_baseball_programs.json" with { type: "json" };
import type { SidearmBaseballProgram } from "./scraper.ts";

export interface SidearmConferenceDefinition {
  id: string;
  name: string;
  programs: SidearmBaseballProgram[];
}

const conferenceDefinitions: SidearmConferenceDefinition[] = [
  {
    id: "newmac",
    name: "NEWMAC",
    programs: newmacBaseballPrograms as SidearmBaseballProgram[],
  },
  {
    id: "nescac",
    name: "NESCAC",
    programs: nescacBaseballPrograms as SidearmBaseballProgram[],
  },
  {
    id: "liberty-league",
    name: "Liberty League",
    programs: libertyLeagueBaseballPrograms as SidearmBaseballProgram[],
  },
];

export const SIDEARM_CONFERENCE_REGISTRY = new Map(
  conferenceDefinitions.map((definition) => [definition.id, definition]),
);

export function listSidearmConferences(): SidearmConferenceDefinition[] {
  return conferenceDefinitions.slice();
}

export function getSidearmConferenceDefinition(
  conferenceId: string,
): SidearmConferenceDefinition {
  const definition = SIDEARM_CONFERENCE_REGISTRY.get(conferenceId.toLowerCase());
  if (!definition) {
    const available = listSidearmConferences()
      .map((conference) => conference.id)
      .join(", ");
    throw new Error(`Unsupported conference '${conferenceId}'. Available conferences: ${available}`);
  }

  return definition;
}
