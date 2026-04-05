/**
 * Aggregates raw spray chart events into per-player, per-zone stats
 * for the spray chart component.
 */

import { SPRAY_ZONES, type SprayDepth, type PlayerSprayProfile, type SprayChartEvent, type SprayZone, type ZoneStats } from "./types";

export const SPRAY_DEPTHS: SprayDepth[] = ["infield", "outfield"];

// ── Per-zone aggregation ──────────────────────────────────────────────

function aggregateSegment(events: SprayChartEvent[], zone: SprayZone, depth: SprayDepth, totalBip: number): ZoneStats {
  const zoneEvents = events.filter((e) => {
    if (e.zone !== zone || e.isHomeRun) return false;
    const isGb = e.battedBallType === "ground_ball" || e.battedBallType === "popup";
    return depth === "infield" ? isGb : !isGb;
  });
  const bip = zoneEvents.length;
  const hits = zoneEvents.filter((e) => e.isHit).length;
  const outs = bip - hits;
  const singles = zoneEvents.filter((e) => e.result === "single").length;
  const doubles = zoneEvents.filter((e) => e.result === "double").length;
  const triples = zoneEvents.filter((e) => e.result === "triple").length;
  const homeRuns = 0; // HRs tracked separately in the arc
  const xbh = doubles + triples;
  const totalBases = zoneEvents.reduce((sum, e) => sum + e.totalBases, 0);

  const groundBalls = zoneEvents.filter((e) => e.battedBallType === "ground_ball").length;
  const lineDrives = zoneEvents.filter((e) => e.battedBallType === "line_drive").length;
  const flyBalls = zoneEvents.filter((e) => e.battedBallType === "fly_ball").length;
  const popups = zoneEvents.filter((e) => e.battedBallType === "popup").length;

  return {
    zone,
    depth,
    bip,
    hits,
    outs,
    singles,
    doubles,
    triples,
    homeRuns,
    xbh,
    totalBases,
    avg: bip > 0 ? hits / bip : null,
    slg: bip > 0 ? totalBases / bip : null,
    zonePct: totalBip > 0 ? (bip / totalBip) * 100 : 0,
    gbPct: bip > 0 ? (groundBalls / bip) * 100 : null,
    ldPct: bip > 0 ? (lineDrives / bip) * 100 : null,
    fbPct: bip > 0 ? (flyBalls / bip) * 100 : null,
    puPct: bip > 0 ? (popups / bip) * 100 : null,
  };
}

// ── Player profile aggregation ────────────────────────────────────────

export function aggregatePlayerProfile(
  name: string,
  events: SprayChartEvent[],
): PlayerSprayProfile {
  const nonHrEvents = events.filter((e) => !e.isHomeRun);
  const totalBip = nonHrEvents.length;
  const totalHr = events.filter((e) => e.isHomeRun).length;

  const segments = SPRAY_ZONES.flatMap((zone) => 
    SPRAY_DEPTHS.map((depth) => aggregateSegment(events, zone, depth, totalBip))
  );

  const allBip = events.length;
  const allHits = events.filter((e) => e.isHit).length;
  const allTotalBases = events.reduce((sum, e) => sum + e.totalBases, 0);
  const groundBalls = events.filter((e) => e.battedBallType === "ground_ball").length;
  const lineDrives = events.filter((e) => e.battedBallType === "line_drive").length;
  const flyBalls = events.filter((e) => e.battedBallType === "fly_ball").length;

  const gameCount = new Set(events.map((e) => `${e.gameDate}_${e.opponent}`)).size;

  return {
    name,
    totalBip,
    totalHr,
    segments,
    overallAvg: allBip > 0 ? allHits / allBip : null,
    overallSlg: allBip > 0 ? allTotalBases / allBip : null,
    overallGbPct: allBip > 0 ? (groundBalls / allBip) * 100 : null,
    overallLdPct: allBip > 0 ? (lineDrives / allBip) * 100 : null,
    overallFbPct: allBip > 0 ? (flyBalls / allBip) * 100 : null,
    gameCount,
  };
}

// ── Aggregate all players from raw data ───────────────────────────────

export function aggregateAllPlayers(
  events: SprayChartEvent[],
): Map<string, PlayerSprayProfile> {
  const byPlayer = new Map<string, SprayChartEvent[]>();

  for (const event of events) {
    const key = event.batter;
    if (!byPlayer.has(key)) byPlayer.set(key, []);
    byPlayer.get(key)!.push(event);
  }

  const profiles = new Map<string, PlayerSprayProfile>();
  for (const [name, playerEvents] of byPlayer) {
    profiles.set(name, aggregatePlayerProfile(name, playerEvents));
  }

  return profiles;
}

// ── Heat tier for zone coloring ───────────────────────────────────────

export type HeatTier = "empty" | "low" | "medium" | "high" | "max";

export function zonePctToHeatTier(pct: number): HeatTier {
  if (pct <= 0) return "empty";
  if (pct <= 10) return "low";
  if (pct <= 20) return "medium";
  if (pct <= 30) return "high";
  return "max";
}
