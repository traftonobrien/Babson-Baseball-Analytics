import type { FallPitcherOutingRecord } from "./pitcherOutings";

export type AvailabilityStatus = "go" | "monitor" | "limited" | "out" | "rest";

export interface PlayerAvailability {
  playerId: string;
  playerName: string;
  lastDate: string | null;
  daysSince: number | null;
  pitches7Day: number;
  pitchesToday: number;
  status: AvailabilityStatus;
  statusLabel: string;
  statusDetail: string;
}

const STATUS_META: Record<AvailabilityStatus, { label: string }> = {
  go: { label: "Ready" },
  monitor: { label: "2-Day Rest" },
  limited: { label: "Yesterday" },
  out: { label: "Threw Today" },
  rest: { label: "No Data" },
};

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

export function deriveAvailability(
  allOutings: FallPitcherOutingRecord[],
  today: string, // YYYY-MM-DD
): PlayerAvailability[] {
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  // Group by player
  const playerMap = new Map<string, FallPitcherOutingRecord[]>();
  for (const o of allOutings) {
    const list = playerMap.get(o.playerId) ?? [];
    list.push(o);
    playerMap.set(o.playerId, list);
  }

  const result: PlayerAvailability[] = [];

  for (const [playerId, outings] of playerMap) {
    const sorted = [...outings].sort((a, b) => b.outingDate.localeCompare(a.outingDate));
    const lastDate = sorted[0]?.outingDate ?? null;
    const daysSince = lastDate ? daysBetween(lastDate, today) : null;

    const pitches7Day = outings
      .filter((o) => o.outingDate >= sevenDaysAgoStr)
      .reduce((sum, o) => sum + o.summary.pitchCount, 0);

    const pitchesToday = outings
      .filter((o) => o.outingDate === today)
      .reduce((sum, o) => sum + o.summary.pitchCount, 0);

    let status: AvailabilityStatus;
    let statusDetail: string;

    if (daysSince === null) {
      status = "rest";
      statusDetail = "No outings logged";
    } else if (daysSince === 0) {
      // threw today
      if (pitchesToday > 45) {
        status = "out";
        statusDetail = `${pitchesToday} pitches today — full rest recommended`;
      } else {
        status = "limited";
        statusDetail = `${pitchesToday} pitches today — light work only`;
      }
    } else if (daysSince === 1) {
      status = "limited";
      statusDetail = `Threw yesterday — evaluate before adding work`;
    } else if (daysSince === 2) {
      status = "monitor";
      statusDetail = `2 days rest — cleared for light session`;
    } else {
      status = pitches7Day > 100 ? "monitor" : "go";
      statusDetail =
        pitches7Day > 100
          ? `${pitches7Day} pitches this week — monitor volume`
          : `${daysSince} days rest — ready`;
    }

    result.push({
      playerId,
      playerName: sorted[0].playerName,
      lastDate,
      daysSince,
      pitches7Day,
      pitchesToday,
      status,
      statusLabel: STATUS_META[status].label,
      statusDetail,
    });
  }

  // Sort: out → limited → monitor → go → rest
  const ORDER: AvailabilityStatus[] = ["out", "limited", "monitor", "go", "rest"];
  result.sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));

  return result;
}
