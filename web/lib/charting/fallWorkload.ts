import { listFallChartingSessions, type FallChartingSession } from "./fallSessions";
import { loadChartingGameSnapshot } from "./snapshot";
import { scoreFallWorkloadStress, type FallWorkloadStress } from "@/lib/fall/workload";

export interface FallChartingSessionWorkload extends FallChartingSession {
  pitchCount: number;
  stress: FallWorkloadStress;
}

async function hydrateFallSessionWorkload(
  session: FallChartingSession,
): Promise<FallChartingSessionWorkload> {
  const snapshot = await loadChartingGameSnapshot(session.id);
  const ourSegmentIds = new Set(
    snapshot?.segments
      .filter((segment) => segment.teamSide === "our")
      .map((segment) => segment.id) ?? [],
  );
  const ourPaIds = new Set(
    snapshot?.plateAppearances
      .filter((pa) => ourSegmentIds.has(pa.segmentId))
      .map((pa) => pa.id) ?? [],
  );
  const pitchCount =
    snapshot?.pitches.filter((pitch) => ourPaIds.has(pitch.paId)).length ??
    0;

  return {
    ...session,
    pitchCount,
    stress: scoreFallWorkloadStress({
      sessionType: session.sessionType,
      pitchCount,
    }),
  };
}

export async function listFallChartingSessionWorkloads(): Promise<
  FallChartingSessionWorkload[]
> {
  const sessions = await listFallChartingSessions();
  return Promise.all(sessions.map(hydrateFallSessionWorkload));
}

export async function listFallChartingSessionWorkloadsForPitcher(
  pitcherName: string,
): Promise<FallChartingSessionWorkload[]> {
  const lower = pitcherName.trim().toLowerCase();
  const sessions = await listFallChartingSessionWorkloads();
  return sessions.filter((session) => session.pitcher?.trim().toLowerCase() === lower);
}
