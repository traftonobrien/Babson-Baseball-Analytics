"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Pitch } from "../types";
import { useAllPitchData } from "../hooks/useAllPitchData";
import { computeCommandPlus } from "@/lib/commandPlus";
import {
  computePitchingPlus,
  PITCHING_PLUS_COMMAND_WEIGHT,
  PITCHING_PLUS_EQUAL_SHARE_WEIGHT,
  PITCHING_PLUS_STUFF_WEIGHT,
  PITCHING_PLUS_USAGE_WEIGHT,
  type PitchingPlusStuffPitch,
} from "@/lib/pitchingPlus";
import { globalCommandPlusBaselines, loadAllOutingData } from "@/lib/leaderboards/load";
import { seasonFromDateId } from "@/lib/season";
import type { SeasonFilter } from "@/lib/leaderboards/types";
import { plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import { getSlugForPlayerId } from "@/lib/canonicalPlayers";
import { pitchColor } from "@/lib/pitchColors";
import {
  buildStuffPlusLookupCandidates,
  fetchStuffPlusByCandidates,
} from "@/lib/stuffPlusLookup";

interface Props {
  playerId: string;
  outingId: string;
  currentOutingPitches: Pitch[];
  otherSeasonCsvPaths: string[];
}

interface StuffState {
  loading: boolean;
  error: string | null;
  lookupPlayerId: string | null;
  pitches: PitchingPlusStuffPitch[];
}

function readinessCopy(reason: string | null): string {
  switch (reason) {
    case "missing_live_command":
      return "Missing live command variable. Pitching+ appears after tracked live outings produce a qualified Command+ and pitch-usage mix.";
    case "missing_stuff":
      return "Missing Stuff+ variable. This score appears once matching Stuff+ rows are available for the live arsenal.";
    case "no_overlap":
      return "No clean pitch-type overlap yet between live command and Stuff+ for this player.";
    case "command_load_error":
      return "Unable to load live command data right now, so the Pitching+ blend is not ready.";
    case "stuff_load_error":
      return "Unable to load Stuff+ data right now, so the Pitching+ blend is not ready.";
    default:
      return "Pitching+ is building from the current season command sample and Stuff+ mix.";
  }
}

export default function PitchingPlusSection({
  playerId,
  outingId,
  currentOutingPitches,
  otherSeasonCsvPaths,
}: Props) {
  const season = seasonFromDateId(outingId.split("/")[1]) ?? null;
  const {
    pitches: otherSeasonPitches,
    loading: otherSeasonLoading,
    error: otherSeasonError,
  } = useAllPitchData(otherSeasonCsvPaths, playerId);
  const [baselinesLoaded, setBaselinesLoaded] = useState(false);
  const [commandLoadError, setCommandLoadError] = useState<string | null>(null);
  const [stuffState, setStuffState] = useState<StuffState>({
    loading: true,
    error: null,
    lookupPlayerId: null,
    pitches: [],
  });

  useEffect(() => {
    let active = true;

    if (!season) {
      setBaselinesLoaded(true);
      setCommandLoadError(null);
      return () => {
        active = false;
      };
    }

    if (globalCommandPlusBaselines[season]) {
      setBaselinesLoaded(true);
      setCommandLoadError(null);
      return () => {
        active = false;
      };
    }

    setBaselinesLoaded(false);
    setCommandLoadError(null);

    loadAllOutingData({ seasonFilter: season as SeasonFilter })
      .then(() => {
        if (!active) return;
        setBaselinesLoaded(true);
      })
      .catch((err) => {
        if (!active) return;
        setBaselinesLoaded(true);
        setCommandLoadError(err instanceof Error ? err.message : "command_load_error");
      });

    return () => {
      active = false;
    };
  }, [season]);

  useEffect(() => {
    let active = true;

    const loadStuff = async () => {
      setStuffState({
        loading: true,
        error: null,
        lookupPlayerId: null,
        pitches: [],
      });

      const candidates = buildStuffPlusLookupCandidates(
        [getSlugForPlayerId(playerId), playerId],
      );
      const lookup = await fetchStuffPlusByCandidates(candidates);

      if (!active) return;

      setStuffState({
        loading: false,
        error: lookup.error,
        lookupPlayerId: lookup.lookupPlayerId ?? playerId,
        pitches: lookup.pitches,
      });
    };

    void loadStuff();

    return () => {
      active = false;
    };
  }, [playerId]);

  const seasonPitches = useMemo(
    () => [...otherSeasonPitches, ...currentOutingPitches],
    [otherSeasonPitches, currentOutingPitches],
  );

  const loading = !season || !baselinesLoaded || otherSeasonLoading || stuffState.loading;

  const baselines = season ? globalCommandPlusBaselines[season] ?? null : null;

  const commandError =
    commandLoadError || otherSeasonError || (!baselinesLoaded ? null : season && !baselines ? "missing_baseline" : null);

  const data = useMemo(() => {
    if (!season || !baselines || loading || commandError) return null;

    const commandResult = computeCommandPlus(seasonPitches, baselines);
    const pitchingResult = computePitchingPlus(
      stuffState.lookupPlayerId ?? playerId,
      commandResult,
      stuffState.pitches,
    );

    return {
      commandResult,
      pitchingResult,
    };
  }, [
    baselines,
    commandError,
    loading,
    playerId,
    season,
    seasonPitches,
    stuffState.lookupPlayerId,
    stuffState.pitches,
  ]);

  if (!season) return null;

  const pitchResult = data?.pitchingResult ?? null;
  const ready = Boolean(pitchResult?.ready && pitchResult.overall !== null);

  const tierClass = !ready
    ? {
        borderClass: "border-zinc-800",
        bgClass: "bg-zinc-900/55",
        pillClass: "bg-zinc-800 text-zinc-300",
      }
    : (pitchResult?.overall ?? 0) >= 110
      ? {
          borderClass: "border-rose-500/50",
          bgClass: "bg-rose-950/10",
          pillClass: "bg-rose-500/15 text-rose-300",
        }
      : (pitchResult?.overall ?? 0) >= 100
        ? {
            borderClass: "border-orange-500/50",
            bgClass: "bg-orange-950/10",
            pillClass: "bg-orange-500/15 text-orange-300",
          }
        : (pitchResult?.overall ?? 0) >= 90
          ? {
              borderClass: "border-zinc-700",
              bgClass: "bg-zinc-900/50",
              pillClass: "bg-zinc-800 text-zinc-300",
            }
          : {
              borderClass: "border-sky-500/50",
              bgClass: "bg-sky-950/10",
              pillClass: "bg-sky-500/15 text-sky-300",
            };

  const displayReason = commandError
    ? "command_load_error"
    : stuffState.error && stuffState.pitches.length === 0
      ? "stuff_load_error"
      : pitchResult?.reason ?? null;

  return (
    <div
      className={`mt-2 rounded-xl border ${tierClass.borderClass} ${tierClass.bgClass} p-4 flex flex-col gap-3`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest flex items-center gap-2 flex-wrap">
            Pitching+
            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${tierClass.pillClass}`}>
              {season} Live Season
            </span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Complete pitching grade combining team-centered Stuff+ with live Command+.
            {" "}
            100 is team average.
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-zinc-500">
            <span>{Math.round(PITCHING_PLUS_STUFF_WEIGHT * 100)}% Stuff / {Math.round(PITCHING_PLUS_COMMAND_WEIGHT * 100)}% Command</span>
            <span>{Math.round(PITCHING_PLUS_EQUAL_SHARE_WEIGHT * 100)}% Pure Mix / {Math.round(PITCHING_PLUS_USAGE_WEIGHT * 100)}% Live Usage</span>
            <Link
              href="/pitching-plus"
              className="text-cyan-400 hover:text-cyan-300 transition-smooth"
            >
              Plus Models
            </Link>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1.5">
            {readinessCopy(displayReason)}
          </p>
        </div>
        {loading ? (
          <div className="inline-flex min-w-[7rem] items-center justify-center rounded-xl bg-zinc-800 px-4 py-3 font-mono text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
            Loading
          </div>
        ) : ready ? (
          <div
            className="inline-flex min-w-[6.5rem] items-center justify-center rounded-xl px-4 py-2.5 font-mono text-4xl font-extrabold tracking-tight"
            style={plusMetricBadgeStyle(pitchResult?.overall ?? 100)}
          >
            {pitchResult?.overall?.toFixed(0)}
          </div>
        ) : (
          <div className="inline-flex min-w-[7rem] items-center justify-center rounded-xl bg-zinc-800 px-4 py-3 font-mono text-base font-bold uppercase tracking-[0.12em] text-zinc-300">
            Not Ready
          </div>
        )}
      </div>

      {ready && pitchResult && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Stuff Core</p>
              <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">
                {pitchResult.stuffComponent?.toFixed(1)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Command Core</p>
              <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">
                {pitchResult.commandComponent?.toFixed(1)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Live Overlap</p>
              <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">
                {pitchResult.overlapPitchTypeCount}
                <span className="ml-1 text-sm text-zinc-500">types</span>
              </p>
              <p className="text-[11px] text-zinc-500">
                {pitchResult.overlapPitchCount} tracked pitches
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-700/50">
            {pitchResult.pitchTypeRows.map((row) => (
              <div
                key={row.commandPitchType}
                className={`min-w-[172px] rounded-xl border px-3 py-2 ${
                  row.included
                    ? "border-zinc-800/80 bg-zinc-950/40"
                    : "border-zinc-800/60 bg-zinc-950/20 opacity-60"
                }`}
                title={
                  row.stuffPitchTypes.length > 0
                    ? `Stuff match: ${row.stuffPitchTypes.join(", ")}`
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: row.included
                          ? pitchColor(row.commandPitchType)
                          : "#52525b",
                      }}
                    />
                    <span className="font-mono text-[12px] font-bold text-zinc-200">
                      {row.commandPitchType}
                    </span>
                  </div>
                  {row.pitchingPlus === null ? (
                    <span className="font-mono text-sm font-bold text-zinc-500">--</span>
                  ) : (
                    <span
                      className="inline-flex min-w-[52px] items-center justify-center rounded-md px-2 py-0.5 font-mono text-sm font-extrabold tracking-tight"
                      style={plusMetricBadgeStyle(row.pitchingPlus)}
                    >
                      {row.pitchingPlus.toFixed(0)}
                    </span>
                  )}
                </div>
                {row.included ? (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    S {row.stuffPlus?.toFixed(1)} · C {row.commandPlus?.toFixed(0)} · W{" "}
                    {(row.hybridWeight * 100).toFixed(0)}%
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-zinc-600">
                    {row.reason === "ambiguous_stuff_match"
                      ? "Ambiguous Stuff+ match"
                      : "Missing Stuff+ match"}
                  </p>
                )}
              </div>
            ))}
          </div>

          {pitchResult.excludedPitchTypeCount > 0 && (
            <p className="text-[11px] text-zinc-500">
              {pitchResult.excludedPitchTypeCount} eligible live command pitch
              {pitchResult.excludedPitchTypeCount === 1 ? " type is" : " types are"} currently excluded from Pitching+ because the Stuff+ side does not have a clean match yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}
