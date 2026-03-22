import { readFile } from "fs/promises";
import path from "path";
import type { Metadata } from "next";
import MechanicsHubView from "./MechanicsHubView";
import type { MechanicsIndex } from "@/lib/mechanics/hub";
import { TEAM_NAME } from "@/lib/teamConfig";

export const metadata: Metadata = {
  title: `Mechanics Hub — ${TEAM_NAME} Baseball`,
};

export default async function MechanicsHubPage() {
  let index: MechanicsIndex = { players: [] };
  try {
    const filePath = path.join(process.cwd(), "public", "mechanics", "index.json");
    const raw = await readFile(filePath, "utf-8");
    index = JSON.parse(raw) as MechanicsIndex;
  } catch {
    // index.json absent — render empty hub
  }

  return <MechanicsHubView index={index} />;
}
