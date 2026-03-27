"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import {
  normalizePitch,
  normalizePitchTypeRow,
  normalizeSessionSummary,
  uniquePitchTypes,
  type TrackmanPitch,
  type TrackmanPitchTypeSummary,
  type TrackmanSessionSummary,
} from "@/lib/trackman/metrics";
import KpiCards from "./KpiCards";
import MovementScatter from "./MovementScatter";
import VeloByPitch from "./VeloByPitch";
import SpinByPitch from "./SpinByPitch";
import TrackmanPitchTable from "./TrackmanPitchTable";
import PitchTypeFilter from "./PitchTypeFilter";
import PitchTypeTable from "./PitchTypeTable";
import MovementScatterByType from "./MovementScatterByType";
import PitchArsenalCards from "./PitchArsenalCards";
import { mergeRenamedPitchTypes } from "@/lib/mergePitchTypes";
import { getStuffPlusDisplayPitchType } from "@/lib/stuffPlusPitchOverrides";
import { getCanonicalName, getSlugForPlayerId } from "@/lib/canonicalPlayers";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import {
  LeaderboardHero,
  LeaderboardPageFrame,
  LeaderboardPill,
  LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";

interface PitchPayload {
  format: "pitch";
  meta?: Record<string, unknown> | null;
  rows: Record<string, unknown>[];
}

interface AggregatePayload {
  format: "aggregate";
  meta?: Record<string, unknown> | null;
  pitchTypes: Record<string, unknown>[];
  summary?: Record<string, unknown> | null;
}

type SessionPayload = PitchPayload | AggregatePayload;

async function fetchJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** "2026_02_13" → "2/13/26", range → "1/1/26 — 2/13/26" */
function formatDateLabel(raw: string): string {
  const toShort = (slug: string): string => {
    const parts = slug.replace(/_/g, "-").replace(/\//g, "-").split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const shortYear = y.length === 4 ? y.slice(2) : y;
      return `${parseInt(m)}/${parseInt(d)}/${shortYear}`;
    }
    return slug;
  };
  if (raw.includes("__")) {
    const [start, end] = raw.split("__");
    return `${toShort(start)} \u2014 ${toShort(end)}`;
  }
  return toShort(raw);
}

/** Try multiple paths to find the session data. */
async function fetchSessionData(
  playerId: string,
  date: string,
  playerSlug?: string,
): Promise<SessionPayload> {
  const lookupSlugs = Array.from(
    new Set([playerSlug, getSlugForPlayerId(playerId)].filter(Boolean) as string[]),
  );

  // Candidate paths: legacy canonical, PDF pipeline (with various session slugs)
  const pitchCandidates = [
    `/data/${playerId}/${date}/trackman/pitches.json`,
    ...lookupSlugs.flatMap((slug) => [
      `/trackman/sessions/${slug}/${date}/session/pitches.json`,
      `/trackman/sessions/${slug}/${date}/live_ab/pitches.json`,
      `/trackman/sessions/${slug}/${date}/bullpen/pitches.json`,
    ]),
    `/trackman/sessions/${playerId}/${date}/session/pitches.json`,
    `/trackman/sessions/${playerId}/${date}/live_ab/pitches.json`,
    `/trackman/sessions/${playerId}/${date}/bullpen/pitches.json`,
  ];
  const aggregateCandidates = [
    ...lookupSlugs.flatMap((slug) => [
      `/trackman/sessions/${slug}/${date}/session/pitch_types.json`,
      `/trackman/sessions/${slug}/${date}/live_ab/pitch_types.json`,
      `/trackman/sessions/${slug}/${date}/bullpen/pitch_types.json`,
    ]),
    `/trackman/sessions/${playerId}/${date}/session/pitch_types.json`,
    `/trackman/sessions/${playerId}/${date}/live_ab/pitch_types.json`,
    `/trackman/sessions/${playerId}/${date}/bullpen/pitch_types.json`,
  ];

  // Also try looking up the index to find the exact path
  try {
    const indexRes = await fetch("/trackman/index.json");
    if (indexRes.ok) {
      const index = await indexRes.json();
      if (Array.isArray(index)) {
        const match = index.find(
          (e: Record<string, unknown>) =>
            (
              (e.playerSlug as string) === playerId ||
              lookupSlugs.includes((e.playerSlug as string) ?? "") ||
              (e.playerId as string) === playerId
            ) &&
            ((e.date as string) === date ||
              (e.date as string)?.replace(/-/g, "_") === date ||
              date.replace(/_/g, "-") === (e.date as string)),
        );
        if (match?.pitchesPath) {
          const raw = await fetchJson(match.pitchesPath as string);
          if (raw) {
            if (Array.isArray(raw)) {
              return { format: "pitch", rows: raw, meta: null };
            }
            const rows = (raw as Record<string, unknown>).pitches ?? (raw as Record<string, unknown>).rows ?? [];
            if (Array.isArray(rows)) {
              return { format: "pitch", rows, meta: asRecord((raw as Record<string, unknown>).meta) };
            }
          }
        }
        if (match?.pitchTypesPath) {
          const raw = await fetchJson(match.pitchTypesPath as string);
          if (raw) {
            const rows = Array.isArray(raw)
              ? raw
              : (raw as Record<string, unknown>).pitch_types ?? (raw as Record<string, unknown>).rows ?? [];
            if (Array.isArray(rows)) {
              const summary = match.summaryPath ? await fetchJson(match.summaryPath as string) : null;
              const meta = match.metaPath ? await fetchJson(match.metaPath as string) : null;
              return {
                format: "aggregate",
                pitchTypes: rows,
                summary: asRecord(summary),
                meta: asRecord(meta),
              };
            }
          }
        }
      }
    }
  } catch {
    // Index lookup failed, continue with candidates
  }

  for (const path of pitchCandidates) {
    const raw = await fetchJson(path);
    if (!raw) continue;
    if (Array.isArray(raw)) {
      return { format: "pitch", rows: raw, meta: null };
    }
    const rows = (raw as Record<string, unknown>).pitches ?? (raw as Record<string, unknown>).rows ?? [];
    if (Array.isArray(rows)) {
      return { format: "pitch", rows, meta: asRecord((raw as Record<string, unknown>).meta) };
    }
  }

  for (const path of aggregateCandidates) {
    const raw = await fetchJson(path);
    if (!raw) continue;
    const rows = Array.isArray(raw)
      ? raw
      : (raw as Record<string, unknown>).pitch_types ?? (raw as Record<string, unknown>).rows ?? [];
    if (Array.isArray(rows)) {
      const base = path.replace(/pitch_types\.json$/, "");
      const summary = await fetchJson(`${base}session_summary.json`);
      const meta = await fetchJson(`${base}meta.json`);
      return {
        format: "aggregate",
        pitchTypes: rows,
        summary: asRecord(summary),
        meta: asRecord(meta),
      };
    }
  }

  throw new Error(`No session data found for ${playerId}/${date}. Tried ${pitchCandidates.length + aggregateCandidates.length} paths.`);
}

export default function TrackmanSessionView({
  playerId,
  date,
  from,
  slug,
}: {
  playerId: string;
  date: string;
  from?: string;
  slug?: string;
}) {
  const profileSlug = slug ?? playerId;
  const backHref =
    from === "profile" ? `/players/${profileSlug}?tab=trackman` :
    from === "player" ? `/trackman/player/${profileSlug}` :
    "/trackman";
  const backLabel =
    from === "profile" ? "Back to profile" :
    from === "player" ? "Back to overview" :
    "Back to sessions";
  const [sessionStuffPlus, setSessionStuffPlus] = useState<Map<string, number>>(new Map());
  const [sessionState, setSessionState] = useState<{
    key: string;
    pitches: TrackmanPitch[];
    pitchTypes: TrackmanPitchTypeSummary[];
    summary: TrackmanSessionSummary | null;
    meta: Record<string, unknown> | null;
    viewMode: "pitch" | "aggregate" | null;
    error: string | null;
  } | null>(null);
  const sessionKey = `${playerId}:${date}:${profileSlug ?? ""}`;

  // Filters
  const [activePitchTypes, setActivePitchTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    fetchSessionData(playerId, date, profileSlug)
      .then((data) => {
        if (!active) return;
        if (data.format === "pitch") {
          const normalized = data.rows.map((row, i) => normalizePitch(row, i));
          setSessionState({
            key: sessionKey,
            pitches: normalized,
            pitchTypes: [],
            summary: null,
            meta: data.meta ?? null,
            viewMode: "pitch",
            error: null,
          });
        } else {
          const normalized = data.pitchTypes
            .filter((row) => (row as Record<string, unknown>)?.is_valid !== false)
            .map((row) => normalizePitchTypeRow(row))
            .filter((row) => row.pitchType !== "Other");
          setSessionState({
            key: sessionKey,
            pitches: [],
            pitchTypes: normalized,
            summary: normalizeSessionSummary(data.summary ?? null),
            meta: data.meta ?? null,
            viewMode: "aggregate",
            error: null,
          });
        }
      })
      .catch((err) => {
        if (!active) return;
        setSessionState({
          key: sessionKey,
          pitches: [],
          pitchTypes: [],
          summary: null,
          meta: null,
          viewMode: null,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      });

    // Fetch Stuff+ for this specific session
    const dateNorm = date.replace(/-/g, "_");
    fetch(`/api/stuff-plus/outings?playerId=${playerId}&date=${dateNorm}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!active || !res?.points) return;
        const map = new Map<string, number>();
        for (const p of res.points) {
          map.set(p.pitchType, p.stuffPlus);
          const displayType = getStuffPlusDisplayPitchType(playerId, p.pitchType);
          if (displayType !== p.pitchType) map.set(displayType, p.stuffPlus);
        }
        setSessionStuffPlus(map);
      });

    return () => {
      active = false;
    };
  }, [date, playerId, profileSlug, sessionKey]);

  const isCurrentSession = sessionState?.key === sessionKey;
  const pitches = isCurrentSession ? sessionState.pitches : [];
  const pitchTypes = isCurrentSession ? sessionState.pitchTypes : [];
  const summary = isCurrentSession ? sessionState.summary : null;
  const meta = isCurrentSession ? sessionState.meta : null;
  const viewMode = isCurrentSession ? sessionState.viewMode : null;
  const loading = !isCurrentSession;
  const error = isCurrentSession ? sessionState.error : null;

  // Header info
  const playerName = getCanonicalName(
    (meta?.player as string) ??
    (meta?.player_name as string) ??
    (meta?.playerName as string) ??
    playerId,
  );
  const metaDate = (meta?.session_date as string) ?? (meta?.sessionDate as string) ?? null;
  const dateLabel = formatDateLabel(metaDate ?? date);
  const sessionLabel =
    (meta?.session_label as string) ??
    (meta?.sessionLabel as string) ??
    null;
  const rawHand =
    (meta?.handedness as string) ??
    (meta?.hand as string) ??
    (meta?.pitcher_hand as string) ??
    (meta?.throws as string) ??
    null;
  const hand: "R" | "L" | undefined =
    rawHand?.toUpperCase().startsWith("R") ? "R" :
    rawHand?.toUpperCase().startsWith("L") ? "L" :
    undefined;

  // Merge pitch types that auto-rename resolves to the same canonical pitch
  const mergedPitchTypes = useMemo(() => {
    let result = pitchTypes;
    if (hand && pitchTypes.length > 0) {
      result = mergeRenamedPitchTypes(pitchTypes, hand);
    }
    // Merge session-specific Stuff+ grades
    if (sessionStuffPlus.size > 0) {
      result = result.map((p) => ({
        ...p,
        meanStuffPlus: sessionStuffPlus.get(p.pitchType) ?? p.meanStuffPlus,
      }));
    }
    // Apply per-player pitch type display overrides (e.g. Slider -> Curveball for chou_colin)
    result = result.map((p) => {
      const displayType = getStuffPlusDisplayPitchType(playerId, p.pitchType);
      return displayType !== p.pitchType ? { ...p, pitchType: displayType } : p;
    });
    return result;
  }, [pitchTypes, hand, sessionStuffPlus, playerId]);

  // All pitch types
  const allTypes = useMemo(() => {
    if (viewMode === "aggregate") {
      return Array.from(new Set(mergedPitchTypes.map((p) => p.pitchType))).sort();
    }
    return uniquePitchTypes(pitches);
  }, [pitches, mergedPitchTypes, viewMode]);

  // Filtered pitches
  const filtered = useMemo(() => {
    if (viewMode === "aggregate") {
      let result = mergedPitchTypes;
      if (activePitchTypes.size > 0) {
        result = result.filter((p) => activePitchTypes.has(p.pitchType));
      }
      return result;
    }
    let result = pitches;
    if (activePitchTypes.size > 0) {
      result = result.filter((p) => activePitchTypes.has(p.pitchType));
    }
    return result;
  }, [pitches, mergedPitchTypes, activePitchTypes, viewMode]);

  const filteredPitches = viewMode === "pitch" ? (filtered as TrackmanPitch[]) : [];
  const filteredPitchTypes =
    viewMode === "aggregate" ? (filtered as TrackmanPitchTypeSummary[]) : [];
  const countsMissing =
    viewMode === "aggregate" && (!summary?.totalPitches || !summary?.pitchMixPct);

  if (loading) {
    return (
      <LeaderboardPageFrame maxWidth="max-w-7xl">
        <div className="flex min-h-[60vh] items-center justify-center text-zinc-400">
          Loading Trackman data...
        </div>
      </LeaderboardPageFrame>
    );
  }

  if (error) {
    return (
      <LeaderboardPageFrame maxWidth="max-w-7xl">
        <div className="mt-12 rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-center">
          <p className="text-sm text-red-300">{error}</p>
          <Link
            href={backHref}
            className="mt-4 inline-flex rounded-2xl border border-zinc-800 bg-zinc-950/75 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
          >
            {backLabel}
          </Link>
        </div>
      </LeaderboardPageFrame>
    );
  }

  if (viewMode === "pitch" && pitches.length === 0) {
    return (
      <LeaderboardPageFrame maxWidth="max-w-7xl">
        <div className="mt-12 rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-6 text-center text-zinc-400">
          <p className="text-sm">No pitches found in this session.</p>
          <Link
            href={backHref}
            className="mt-4 inline-flex rounded-2xl border border-zinc-800 bg-zinc-950/75 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
          >
            {backLabel}
          </Link>
        </div>
      </LeaderboardPageFrame>
    );
  }

  if (viewMode === "aggregate" && pitchTypes.length === 0) {
    return (
      <LeaderboardPageFrame maxWidth="max-w-7xl">
        <div className="mt-12 rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-6 text-center text-zinc-400">
          <p className="text-sm">No pitch-type summary was found in this session.</p>
          <Link
            href={backHref}
            className="mt-4 inline-flex rounded-2xl border border-zinc-800 bg-zinc-950/75 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
          >
            {backLabel}
          </Link>
        </div>
      </LeaderboardPageFrame>
    );
  }

  return (
    <LeaderboardPageFrame maxWidth="max-w-7xl">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Trackman", href: "/trackman" },
          { label: playerName, href: backHref },
          { label: "Session" },
        ]}
      />

      <LeaderboardHero
        tone="blue"
        icon={Activity}
        eyebrow="Trackman Session"
        title={<>{playerName}</>}
        description="Single-session Trackman view with pitch-level and aggregate splits."
        meta={(
          <>
            <LeaderboardPill tone="blue">{dateLabel}</LeaderboardPill>
            {sessionLabel ? <LeaderboardPill tone="neutral">{sessionLabel}</LeaderboardPill> : null}
            {hand ? <LeaderboardPill tone="neutral">Throws {hand === "L" ? "LHP" : "RHP"}</LeaderboardPill> : null}
          </>
        )}
        side={(
          <div className="grid gap-3">
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/75 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
            >
              {backLabel}
            </Link>
          </div>
        )}
      />

      <LeaderboardToolbar>
        <div className="space-y-3">
          <PitchTypeFilter
            allTypes={allTypes}
            activePitchTypes={activePitchTypes}
            onToggleType={(type) => {
              setActivePitchTypes((prev) => {
                const next = new Set(prev);
                if (next.has(type)) next.delete(type);
                else next.add(type);
                return next;
              });
            }}
            onClearTypes={() => setActivePitchTypes(new Set())}
          />
          {countsMissing ? (
            <div className="text-xs text-zinc-500">
              Pitch counts were not included in this PDF export.
            </div>
          ) : null}
        </div>
      </LeaderboardToolbar>

      <div className="mt-6 space-y-6">
        {viewMode === "pitch" ? (
          <>
            <KpiCards pitches={filteredPitches} />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <MovementScatter pitches={filteredPitches} />
              <VeloByPitch pitches={filteredPitches} />
            </div>

            <SpinByPitch pitches={filteredPitches} />
            <TrackmanPitchTable pitches={filteredPitches} />
          </>
        ) : (
          <>
            <PitchTypeTable pitchTypes={filteredPitchTypes} summary={summary} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px] items-stretch">
              <MovementScatterByType pitchTypes={filteredPitchTypes} hand={hand} />
              <PitchArsenalCards pitchTypes={filteredPitchTypes} />
            </div>
          </>
        )}
      </div>
    </LeaderboardPageFrame>
  );
}
