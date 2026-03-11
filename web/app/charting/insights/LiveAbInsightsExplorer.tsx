"use client";

import Link from "next/link";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardList,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import HitterPerformanceInsights from "@/app/players/[slug]/HitterPerformanceInsights";
import {
  LeaderboardHero,
  LeaderboardIntro,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardStatBlock,
  LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";
import type { ChartingHitterInsightsDirectoryEntry } from "@/lib/charting/playerProfile";
import type { HitterInsightPitchRecord } from "@/lib/charting/hitterInsights";
import { useSelectedPlayer } from "@/lib/selectedPlayer";

type ResultLensId =
  | "all"
  | "hits"
  | "xbh"
  | "strikeouts"
  | "walks"
  | "whiffs"
  | "chases";

const RESULT_LENSES: Array<{
  id: ResultLensId;
  label: string;
  note: string;
}> = [
  {
    id: "all",
    label: "All",
    note: "Every charted pitch in scope.",
  },
  {
    id: "hits",
    label: "Hits",
    note: "Terminal pitches that ended in a hit.",
  },
  {
    id: "xbh",
    label: "Damage",
    note: "Terminal doubles, triples, and homers.",
  },
  {
    id: "strikeouts",
    label: "K",
    note: "Terminal pitches that finished strikeouts.",
  },
  {
    id: "walks",
    label: "Free Pass",
    note: "Terminal walks and hit-by-pitches.",
  },
  {
    id: "whiffs",
    label: "Whiffs",
    note: "Swing-and-miss events only.",
  },
  {
    id: "chases",
    label: "Chases",
    note: "Swings at pitches outside the zone.",
  },
];

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function countUniqueGames(entries: ChartingHitterInsightsDirectoryEntry[]): number {
  return new Set(entries.flatMap((entry) => entry.insights.games.map((game) => game.id))).size;
}

function parseResultLens(raw: string | null | undefined): ResultLensId {
  return RESULT_LENSES.some((lens) => lens.id === raw) ? (raw as ResultLensId) : "all";
}

function applyResultLens(
  pitches: HitterInsightPitchRecord[],
  resultLens: ResultLensId
): HitterInsightPitchRecord[] {
  switch (resultLens) {
    case "hits":
      return pitches.filter((pitch) => pitch.terminalHit);
    case "xbh":
      return pitches.filter((pitch) => pitch.terminalExtraBaseHit);
    case "strikeouts":
      return pitches.filter((pitch) => pitch.outcomeCategory === "strikeout");
    case "walks":
      return pitches.filter(
        (pitch) =>
          pitch.outcomeCategory === "walk" || pitch.outcomeCategory === "hitByPitch"
      );
    case "whiffs":
      return pitches.filter((pitch) => pitch.isWhiff);
    case "chases":
      return pitches.filter((pitch) => pitch.isSwing && pitch.isInZone === false);
    case "all":
    default:
      return pitches;
  }
}

function BlankZonePlaceholder({
  pinnedSlug,
  onOpenPinned,
}: {
  pinnedSlug: string | null;
  onOpenPinned: (() => void) | null;
}) {
  return (
    <LeaderboardPanel className="overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(45,212,191,0.12),transparent_28%),radial-gradient(circle_at_84%_20%,rgba(34,197,94,0.08),transparent_22%),linear-gradient(180deg,rgba(12,18,17,0.76),rgba(9,9,11,0.95))]" />
      <div className="relative grid gap-6 xl:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)] xl:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
            <Target className="h-3.5 w-3.5" />
            Insights Explorer
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-zinc-50">
            Pick a hitter to open the zone.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">
            Search the roster, choose a result lens, and load the full hitter
            performance workspace with zone, pitch type, velocity, and chase detail.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                1. Search
              </div>
              <div className="mt-2 text-sm font-semibold text-zinc-100">
                Find a roster hitter
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                2. Lens
              </div>
              <div className="mt-2 text-sm font-semibold text-zinc-100">
                Focus on hits, damage, chase, or whiffs
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                3. Click
              </div>
              <div className="mt-2 text-sm font-semibold text-zinc-100">
                Drill into the zone and supporting detail
              </div>
            </div>
          </div>
          {pinnedSlug && onOpenPinned ? (
            <button
              type="button"
              onClick={onOpenPinned}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-sm font-semibold text-zinc-200 transition-smooth hover:border-emerald-400/25 hover:text-emerald-200"
            >
              Reopen pinned player
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mx-auto aspect-square w-full max-w-[26rem] rounded-[2.3rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.08),_transparent_48%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="grid h-full grid-cols-3 grid-rows-3 gap-3">
            {[
              "High Inner",
              "High Heart",
              "High Away",
              "Mid Inner",
              "Heart",
              "Mid Away",
              "Low Inner",
              "Low Heart",
              "Low Away",
            ].map((label) => (
              <div
                key={label}
                className="rounded-[1.4rem] border border-zinc-800/80 bg-zinc-950/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  {label}
                </div>
                <div className="mt-6 text-2xl font-black tracking-tight text-zinc-700">
                  --
                </div>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-4 rounded-[1.9rem] border border-white/5" />
        </div>
      </div>
    </LeaderboardPanel>
  );
}

export default function LiveAbInsightsExplorer({
  entries,
}: {
  entries: ChartingHitterInsightsDirectoryEntry[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { slug: pinnedSlug, setSelectedPlayer } = useSelectedPlayer();
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput);

  const selectedPlayerSlug = searchParams.get("player");
  const resultLens = parseResultLens(searchParams.get("result"));
  const entryBySlug = useMemo(
    () => new Map(entries.map((entry) => [entry.playerSlug, entry])),
    [entries]
  );
  const selectedEntry = selectedPlayerSlug ? entryBySlug.get(selectedPlayerSlug) ?? null : null;

  useEffect(() => {
    if (selectedPlayerSlug) {
      setSelectedPlayer(selectedPlayerSlug);
    }
  }, [selectedPlayerSlug, setSelectedPlayer]);

  const filteredEntries = useMemo(() => {
    const query = normalizeQuery(deferredSearch);
    if (!query) return entries;

    return entries.filter((entry) => {
      const haystack = [
        entry.displayName,
        entry.playerSlug,
        ...entry.matchedHitterNames,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredSearch, entries]);

  const scopedEntry = useMemo(() => {
    if (!selectedEntry) return null;
    return {
      ...selectedEntry,
      insights: {
        ...selectedEntry.insights,
        pitches: applyResultLens(selectedEntry.insights.pitches, resultLens),
      },
    };
  }, [resultLens, selectedEntry]);

  const totalGames = useMemo(() => countUniqueGames(entries), [entries]);
  const totalPitches = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.pitchCount, 0),
    [entries]
  );

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    const query = next.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(href);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <LeaderboardIntro
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Charting", href: "/charting" },
          { label: "Insights" },
        ]}
      >
        <LeaderboardHero
          tone="emerald"
          icon={ClipboardList}
          eyebrow="Charting"
          title={<>Hitter Performance Insights</>}
          description="Search Babson hitters, apply a result lens, and open the premium zone-performance workspace directly inside the charting hub."
          meta={
            <>
              <LeaderboardPill tone="emerald">
                {entries.length} hitter{entries.length === 1 ? "" : "s"} with charted data
              </LeaderboardPill>
              <LeaderboardPill tone="neutral">
                {totalGames} session{totalGames === 1 ? "" : "s"} loaded
              </LeaderboardPill>
              <LeaderboardPill tone="neutral">
                {totalPitches.toLocaleString()} charted pitches
              </LeaderboardPill>
              <LeaderboardPill tone="neutral">
                {RESULT_LENSES.find((lens) => lens.id === resultLens)?.label ?? "All"} lens
              </LeaderboardPill>
            </>
          }
          summary={
            <LeaderboardStatBlock
              label="Explorer"
              value={String(entries.length)}
              detail="hitters available for interactive zone review"
              emphasisClassName="text-emerald-300"
            />
          }
          side={
            <div className="grid gap-3">
              <Link href="/charting/leaderboard?tab=hitters" className="block">
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 transition-smooth hover:border-emerald-400/35">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/20 bg-zinc-950/70 text-emerald-300">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
                        Compare
                      </div>
                      <div className="mt-1 text-sm font-semibold text-emerald-50">
                        Open Hitter Leaderboard
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              <Link href="/charting/faq" className="block">
                <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/75 p-4 transition-smooth hover:border-emerald-400/25">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 text-zinc-300">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Reference
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-100">
                        Live AB FAQ & metrics
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          }
        />
      </LeaderboardIntro>

      <LeaderboardToolbar>
        <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search hitters by name, slug, or charted alias"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/80 py-3 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-smooth focus:border-emerald-500/30"
            />
          </div>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Result lens
              </span>
              {RESULT_LENSES.map((lens) => (
                <button
                  key={lens.id}
                  type="button"
                  onClick={() => updateParams({ result: lens.id === "all" ? null : lens.id })}
                  className={joinClasses(
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-smooth",
                    resultLens === lens.id
                      ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.10)]"
                      : "border-zinc-800 bg-zinc-950/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
                  )}
                >
                  {lens.label}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-zinc-500">
              {RESULT_LENSES.find((lens) => lens.id === resultLens)?.note}
            </div>
          </div>
        </div>
      </LeaderboardToolbar>

      <div className="grid gap-6 xl:grid-cols-[minmax(19rem,0.62fr)_minmax(0,1.38fr)]">
        <LeaderboardPanel className="overflow-hidden p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Roster Hitters
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                {filteredEntries.length} player
                {filteredEntries.length === 1 ? "" : "s"} match the current search.
              </div>
            </div>
            {selectedEntry ? (
              <LeaderboardPill tone="emerald">
                <Sparkles className="h-3.5 w-3.5" />
                Active
              </LeaderboardPill>
            ) : null}
          </div>

          <div className="mt-4 grid max-h-[72vh] gap-3 overflow-y-auto pr-1">
            {filteredEntries.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center rounded-[1.4rem] border border-dashed border-zinc-800 bg-zinc-950/60 px-5 text-center text-sm text-zinc-500">
                No hitters match this search.
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const active = selectedPlayerSlug === entry.playerSlug;
                return (
                  <button
                    key={entry.playerSlug}
                    type="button"
                    onClick={() => updateParams({ player: entry.playerSlug })}
                    className={joinClasses(
                      "rounded-[1.5rem] border px-4 py-4 text-left transition-smooth",
                      active
                        ? "border-emerald-400/35 bg-emerald-500/10 shadow-[0_22px_48px_rgba(16,185,129,0.10)]"
                        : "border-zinc-800 bg-zinc-950/75 hover:border-zinc-700 hover:bg-zinc-950/90"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-zinc-100">
                          {entry.displayName}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          {entry.batterHand ? `${entry.batterHand}HH` : "Hand unknown"}
                          {entry.matchedHitterNames.length > 1
                            ? ` • ${entry.matchedHitterNames.length} aliases`
                            : ""}
                        </div>
                      </div>
                      <ArrowRight
                        className={joinClasses(
                          "mt-0.5 h-4 w-4 shrink-0",
                          active ? "text-emerald-300" : "text-zinc-600"
                        )}
                      />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-3 py-2.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Sessions
                        </div>
                        <div className="mt-1 text-lg font-black tracking-tight text-zinc-100">
                          {entry.sessionCount}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-3 py-2.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Pitches
                        </div>
                        <div className="mt-1 text-lg font-black tracking-tight text-zinc-100">
                          {entry.pitchCount}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </LeaderboardPanel>

        <div className="space-y-5">
          {selectedEntry ? (
            <>
              <LeaderboardPanel className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Current hitter
                    </div>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-50">
                      {selectedEntry.displayName}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Result lens:{" "}
                      {RESULT_LENSES.find((lens) => lens.id === resultLens)?.label ?? "All"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/players/${selectedEntry.playerSlug}?tab=live-ab`}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-sm font-semibold text-zinc-200 transition-smooth hover:border-zinc-700 hover:text-white"
                    >
                      Open player page
                    </Link>
                    <button
                      type="button"
                      onClick={() => updateParams({ player: null })}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-sm font-semibold text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
                    >
                      Clear player
                    </button>
                  </div>
                </div>
              </LeaderboardPanel>

              <HitterPerformanceInsights
                key={`${selectedEntry.playerSlug}-${resultLens}`}
                data={scopedEntry!.insights}
              />
            </>
          ) : (
            <BlankZonePlaceholder
              pinnedSlug={pinnedSlug}
              onOpenPinned={
                pinnedSlug && entryBySlug.has(pinnedSlug)
                  ? () => updateParams({ player: pinnedSlug })
                  : null
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
