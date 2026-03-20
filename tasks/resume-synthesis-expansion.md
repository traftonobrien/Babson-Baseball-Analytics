# Resume: Synthesis Expansion — Handoff Doc

## Status
Fully researched, ready to implement. All three files have been read and all insertion points identified. No code has been written yet.

## Commit baseline
`b48cbd8` — main and origin/main are aligned here. 374/374 tests passing, clean build.

## What to build (in order)

### 1. LiveAbInsightsExplorer.tsx
File: `web/app/charting/insights/LiveAbInsightsExplorer.tsx`

**Add two helpers before line 1848** (`export default function LiveAbInsightsExplorer`):

```ts
// ---------------------------------------------------------------------------
// Insights Explorer — inline synthesis helpers
// ---------------------------------------------------------------------------

const MIN_EXPLORER_SAMPLE = 15;

function derivePitcherExplorerTakeaways(
  summary: PitcherComparisonSummary,
  pitchMix: ComparisonPitchMixItem[],
): string[] {
  if (summary.totalPitches < MIN_EXPLORER_SAMPLE) return [];
  const takeaways: string[] = [];
  const sorted = [...pitchMix].sort((a, b) => b.share - a.share);
  const top = sorted[0];
  const second = sorted[1];
  const spreadCount = sorted.filter((p) => p.share >= 15).length;

  // Usage (at most 1)
  if (top) {
    if (top.share >= 50) {
      takeaways.push(`Leans on the ${top.label} (${top.share.toFixed(0)}% of pitches in this slice).`);
    } else if (second && top.share + second.share >= 65) {
      takeaways.push(`Works mostly off the ${top.label} and ${second.label} (${(top.share + second.share).toFixed(0)}% combined).`);
    } else if (spreadCount >= 3) {
      takeaways.push(`Spread mix across ${spreadCount} pitch types in this sample.`);
    }
  }

  // Strike-throwing (at most 1)
  if (summary.strikePct !== null) {
    if (summary.strikePct >= 68) {
      takeaways.push(`Strong attack zone — ${summary.strikePct.toFixed(0)}% strike rate in this sample.`);
    } else if (summary.strikePct < 56) {
      takeaways.push(`Elevated ball rate — ${summary.strikePct.toFixed(0)}% strikes in this sample.`);
    }
  }

  // Bat-missing (at most 1)
  if (summary.whiffPct !== null && summary.whiffPct >= 22) {
    takeaways.push(`Generating misses — ${summary.whiffPct.toFixed(0)}% whiff rate on swings.`);
  }

  // Finish rate (only if under 3)
  if (takeaways.length < 3 && summary.kPct !== null && summary.kPct >= 28) {
    takeaways.push(`Strong strikeout rate — ${summary.kPct.toFixed(0)}% of PAs end in a K.`);
  }

  return takeaways.slice(0, 3);
}

function deriveHitterExplorerTakeaways(
  summary: ChartingPlayerComparisonSummary,
  pitchMix: ComparisonPitchMixItem[],
): string[] {
  if (summary.totalPitches < MIN_EXPLORER_SAMPLE) return [];
  const takeaways: string[] = [];
  const sorted = [...pitchMix].sort((a, b) => b.share - a.share);

  // Swing decisions (at most 1)
  if (summary.swingPct !== null) {
    if (summary.swingPct >= 55) {
      takeaways.push(`Aggressive swing decisions — swinging at ${summary.swingPct.toFixed(0)}% of pitches in this slice.`);
    } else if (summary.swingPct < 35) {
      takeaways.push(`Patient approach — swinging at only ${summary.swingPct.toFixed(0)}% of pitches in this slice.`);
    }
  }

  // Contact (at most 1)
  if (summary.whiffPct !== null && summary.whiffPct >= 30) {
    takeaways.push(`Trouble making contact — ${summary.whiffPct.toFixed(0)}% whiff rate when swinging.`);
  }

  // Production (at most 1)
  if (summary.woba !== null && (summary.plateAppearances ?? 0) >= 8) {
    if (summary.woba >= 0.380) {
      takeaways.push(`Strong production in this sample — ${summary.woba.toFixed(3)} wOBA.`);
    } else if (summary.woba < 0.270) {
      takeaways.push(`Limited production in this sample — ${summary.woba.toFixed(3)} wOBA.`);
    }
  }

  // Mix exposure (only if under 3)
  if (takeaways.length < 3 && sorted[0] && sorted[0].share >= 55) {
    takeaways.push(`Mostly sees ${sorted[0].label} in this slice (${sorted[0].share.toFixed(0)}%).`);
  }

  return takeaways.slice(0, 3);
}
```

**Types note:** `ComparisonPitchMixItem` is already defined in the file at line 113:
```ts
type ComparisonPitchMixItem = ReturnType<typeof buildChartingPlayerComparisonPitchMix>[number] | PitcherComparisonPitchMixItem;
```
Both have `share` (0-100) and `label`. Use that type directly in the helpers.

**Insert synthesis render block** between the closing `</div>` of the mini-stat grid and `<PitchMixPanel` (~line 2676). Exact anchor:

```tsx
                </div>

                <PitchMixPanel
```

Insert between those two:

```tsx
                {/* Inline synthesis takeaways */}
                {(() => {
                  const takeaways = isPitcher
                    ? derivePitcherExplorerTakeaways(
                        selectionSummary as PitcherComparisonSummary,
                        selectionPitchMix,
                      )
                    : deriveHitterExplorerTakeaways(
                        selectionSummary as ChartingPlayerComparisonSummary,
                        selectionPitchMix,
                      );
                  if (takeaways.length === 0) return null;
                  return (
                    <div className="rounded-[1.7rem] border border-zinc-800/50 bg-zinc-950/40 px-5 py-4">
                      <ul className="space-y-1.5">
                        {takeaways.map((t) => (
                          <li key={t} className="text-sm leading-relaxed text-zinc-400">
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

```

---

### 2. MLBCompsPanel.tsx
File: `web/app/trackman/player/[slug]/MLBCompsPanel.tsx`

**Delta direction confirmed:** `deltas.ivb = input.ivb - comp.pitch.avgIvb` (positive = Babson has more ride). `deltas.velo` is always null — compute velo gap locally.

**Add two helpers after line 55** (after the existing `DeltaBadge` component, before `// Sub-components`):

```ts
// ---------------------------------------------------------------------------
// Comp interpretation helpers
// ---------------------------------------------------------------------------

function describePerPitchComp(
  input: CompInput,
  topComp: MLBCompResult,
): string[] {
  const parts: string[] = [];

  // IVB — vertical movement
  if (topComp.deltas.ivb !== null) {
    const d = topComp.deltas.ivb;
    if (Math.abs(d) < 1.5) {
      parts.push(`Similar vertical movement to ${topComp.pitcher.name}.`);
    } else if (d > 0) {
      parts.push(`More ride than ${topComp.pitcher.name} (+${d.toFixed(1)}″).`);
    } else {
      parts.push(`Less rise than ${topComp.pitcher.name} (${d.toFixed(1)}″).`);
    }
  }

  // HB — only note if meaningfully different
  if (topComp.deltas.hb !== null && Math.abs(topComp.deltas.hb) >= 1.5) {
    const d = topComp.deltas.hb;
    parts.push(
      d > 0
        ? `More horizontal break toward first (+${d.toFixed(1)}″ HB).`
        : `More horizontal break toward third (${d.toFixed(1)}″ HB).`,
    );
  }

  // Velo — compute locally (deltas.velo is always null by design)
  if (input.velo != null && topComp.pitch.avgVelo != null) {
    const diff = Math.round((input.velo - topComp.pitch.avgVelo) * 10) / 10;
    if (Math.abs(diff) >= 1.5) {
      parts.push(
        diff > 0
          ? `Throws harder than the comp (+${diff.toFixed(1)} mph).`
          : `Softer than the comp (${diff.toFixed(1)} mph).`,
      );
    }
  }

  return parts;
}

function describeArsenalComp(
  arsenalSize: number,
  topComp: ArsenalCompResult,
): string[] {
  const parts: string[] = [];

  const n = topComp.matchedPitches;
  const pitchWord = n === 1 ? "pitch type" : "pitch types";
  if (topComp.avgDistance < 1.5) {
    parts.push(`Very close full-arsenal match across ${n} ${pitchWord}.`);
  } else if (topComp.avgDistance < 3.0) {
    parts.push(`Reasonable arsenal shape match across ${n} ${pitchWord}.`);
  } else {
    parts.push(`Loose shape match — ${n} ${pitchWord} overlapping.`);
  }

  // Closest individual pitch type
  if (topComp.pitchBreakdown.length > 0) {
    const closest = [...topComp.pitchBreakdown].sort((a, b) => a.distance - b.distance)[0];
    if (closest.distance < 1.5) {
      parts.push(`Closest individual match on the ${closest.pitchType}.`);
    }
  }

  return parts;
}
```

**Per-pitch insertion:** After the "Your {pitch}" border-b row block ends (`</div>` after `{fmt(input.velo)} mph`) and before the Legend div (`{/* Legend */}`). Exact anchor in the IIFE at line ~319:

```tsx
                    )}

                    {/* Legend */}
```

Insert between them:

```tsx
                    {/* Per-pitch comp interpretation */}
                    {input && comps.length > 0 && (() => {
                      const lines = describePerPitchComp(input, comps[0]);
                      if (lines.length === 0) return null;
                      return (
                        <div className="mb-3 rounded-[1.1rem] border border-zinc-800/50 bg-zinc-950/40 px-4 py-3">
                          <ul className="space-y-1">
                            {lines.map((l) => (
                              <li key={l} className="text-[12px] leading-relaxed text-zinc-400">{l}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

```

**Arsenal insertion:** After the intro `<p>` closing tag and before the empty-check. Exact anchor:

```tsx
              <p className="text-[11px] text-zinc-500 mb-3">
                Closest full-arsenal matches across {arsenal.length} pitch{arsenal.length !== 1 ? "es" : ""}
              </p>
              {arsenalComps.length === 0 ? (
```

Insert between `</p>` and `{arsenalComps.length === 0 ?`:

```tsx
              {/* Arsenal comp interpretation */}
              {arsenalComps.length > 0 && (() => {
                const lines = describeArsenalComp(arsenal.length, arsenalComps[0]);
                if (lines.length === 0) return null;
                return (
                  <div className="mb-3 rounded-[1.1rem] border border-zinc-800/50 bg-zinc-950/40 px-4 py-3">
                    <ul className="space-y-1">
                      {lines.map((l) => (
                        <li key={l} className="text-[12px] leading-relaxed text-zinc-400">{l}</li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
```

---

### 3. LiveAbProfilePanel.tsx
File: `web/app/players/[slug]/LiveAbProfilePanel.tsx`

**Add helper after `derivePitchingSynthesis`** (around line 218, before `const PITCH_TYPE_ORDER`). The hitter stats type is `AggregatedHitterStats` from `@/lib/charting/analytics` — but do NOT add a new import since the component uses the type implicitly via `hitter.stats`. Use an inline type:

```ts
function deriveHittingSynthesis(stats: {
  totalPAs: number | null;
  contactPct: number | null;
  chasePct: number | null;
  kPct: number | null;
  bbPct: number | null;
} | null): string[] {
  if (!stats) return [];
  const { totalPAs, contactPct, chasePct, kPct, bbPct } = stats;
  if (!totalPAs || totalPAs < 15) return [];
  const takeaways: string[] = [];

  // Zone discipline (at most 1)
  if (chasePct !== null) {
    if (chasePct >= 35) {
      takeaways.push(`Chasing pitches out of the zone often (${chasePct.toFixed(0)}% chase rate).`);
    } else if (chasePct < 20) {
      takeaways.push(`Disciplined approach — rarely chases outside the zone (${chasePct.toFixed(0)}% chase rate).`);
    }
  }

  // Contact reliability (at most 1)
  if (contactPct !== null) {
    if (contactPct >= 80) {
      takeaways.push(`Makes contact consistently (${contactPct.toFixed(0)}% contact rate).`);
    } else if (contactPct < 65) {
      takeaways.push(`Trouble making contact when swinging (${contactPct.toFixed(0)}% contact rate).`);
    }
  }

  // Strikeout pressure (at most 1)
  if (kPct !== null && kPct >= 28) {
    takeaways.push(`High strikeout rate — ${kPct.toFixed(0)}% K% in this sample.`);
  }

  // Patience (only if under 3)
  if (takeaways.length < 3 && bbPct !== null && bbPct >= 12) {
    takeaways.push(`Draws walks at a solid rate (${bbPct.toFixed(0)}% BB%).`);
  }

  return takeaways.slice(0, 3);
}
```

**Insert render block** after second stat grid (line ~751) and before `<SessionList title="Hitting Sessions">`. Exact anchor:

```tsx
          </div>

          <SessionList title="Hitting Sessions" sessions={hitter.sessions} />
```

Insert between them:

```tsx
          {/* Inline hitter synthesis takeaways */}
          {(() => {
            const takeaways = deriveHittingSynthesis(hitter.stats);
            if (takeaways.length === 0) return null;
            return (
              <div className="rounded-[1.7rem] border border-zinc-800/50 bg-zinc-950/40 px-5 py-4">
                <ul className="space-y-1.5">
                  {takeaways.map((t) => (
                    <li key={t} className="text-sm leading-relaxed text-zinc-400">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

```

---

## After implementing all three

1. `npm --prefix web run build` — must be clean
2. Run tests — expect 374/374
3. Browser-check three routes:
   - `/players/burk_bobby` (charting panel + hitter synthesis)
   - `/charting/insights` (pitcher view, then hitter view)
   - `/trackman/player/<any-slug>` (per-pitch comps, then arsenal mode)
4. Update `.claude-memory.md`

## Hard constraints (do not violate)
- No new section headers
- No population-benchmark language ("elite", "above average")
- Render nothing when no signal clears
- Do not touch: `CLAUDE.md`, `memory.sh`, `tasks/todo.md`, `.planning/phases/12.2-*`, `Babson Analytics/`

## Commit message template
```
feat: synthesis expansion — insights explorer, MLB comps, hitter profile

- LiveAbInsightsExplorer: derivePitcherExplorerTakeaways /
  deriveHitterExplorerTakeaways; render 0-3 takeaways between mini-stat
  grid and PitchMixPanel; tied to current filtered/selected data
- MLBCompsPanel: describePerPitchComp / describeArsenalComp; renders
  below "Your {pitch}" row and below arsenal intro line respectively;
  velo gap computed locally (deltas.velo is always null by design)
- LiveAbProfilePanel: deriveHittingSynthesis mirroring pitcher-side
  pattern; renders after second hitter stat grid, before session list

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
