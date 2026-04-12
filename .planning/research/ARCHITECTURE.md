# Architecture Patterns

**Domain:** RE288 Run Expectancy Intelligence — integration into existing Babson Analytics
**Researched:** 2026-04-11
**Milestone:** v4.0 Run Expectancy Intelligence

---

## Recommended Architecture

The new system sits in two layers on top of existing infrastructure:

1. **Offline pipeline** — TypeScript scripts that scrape Sidearm PBP, reconstruct base state, and write static JSON matrices to `web/public/data/run-expectancy/`.
2. **Query layer extension** — new functions in `web/lib/charting/ohtwo.ts` (and a new sibling `runExpectancy.ts`) that join RE matrix values to existing Supabase charting rows.

No new database tables are required. No existing tables are modified. The spray chart pipeline is extended, not replaced.

---

## Component Boundaries

| Component | Responsibility | Status | Communicates With |
|-----------|---------------|--------|-------------------|
| `web/lib/spraychart/pbpParser.ts` | NEW — full-game PBP parser: all plays, both teams, sequential base-state + outs reconstruction | New file | `scraper.ts` (uses `extractPlayLines`, `fetchPlayByPlayHtml`), `web/scripts/build_re_matrix.ts` |
| `web/lib/spraychart/scraper.ts` | Existing spray chart scraper — MODIFIED to export `extractPlayLines` and `fetchPlayByPlayHtml` as named exports so pbpParser can reuse them without duplication | Modified (exports only, no logic change) | `pbpParser.ts`, `scrape_spray_charts.ts` |
| `web/lib/re/matrix.ts` | NEW — RE288 matrix types, builder function, delta-RE lookup | New file | `pbpParser.ts`, `ohtwo.ts` extension |
| `web/scripts/build_re_matrix.ts` | NEW — CLI script: scrapes all games, calls pbpParser, calls matrix builder, writes JSON output | New file | `pbpParser.ts`, `matrix.ts` |
| `web/public/data/run-expectancy/` | NEW — static JSON storage for RE matrices | New directory | consumed at request time by Next.js server components |
| `web/lib/charting/runExpectancy.ts` | NEW — delta-RE lookup wrapper: takes (count, base_state, outs) + PA outcome, returns RE change; joins RE data to ohtwo events | New file | `matrix.ts` (reads JSON), `ohtwo.ts` |
| `web/lib/charting/ohtwo.ts` | MODIFIED — RE-enriched `OhTwoEvent` + `OhTwoReport` fields; `buildOhTwoReport` extended to accept and attach delta-RE values | Modified | `runExpectancy.ts` |
| `web/app/charting/ohtwo/page.tsx` | MODIFIED — renders new RE sections: run value cost, counterfactual simulator, count-progression RE tree | Modified | `ohtwo.ts` (unchanged import path) |

---

## Data Flow

### Matrix build pipeline (offline, run via CLI)

```
discoverGameUrls()                    — existing, in scraper.ts
  → fetchPlayByPlayHtml(url)          — existing, promoted to named export
  → extractPlayLines(html)            — existing, promoted to named export
  → parseFullGamePbp(plays)           — NEW in pbpParser.ts
      returns: ParsedGame { innings: ParsedInning[] }
      each ParsedInning: { half: "top"|"bot", plays: ParsedPlay[] }
      each ParsedPlay: { batter, runners, outsBeforePlay, outsAfterPlay,
                         baseStateBefore, baseStateAfter, runsScored,
                         eventType }
  → buildRe288Matrix(parsedGames[])   — NEW in matrix.ts
      groups plays by (balls, strikes, baseState, outs)
      calculates avgRunsToInningEnd for each cell
      produces: Re288Matrix { cells: Re288Cell[288] }
  → writeFileSync(OUTPUT_JSON)        — static write to web/public/data/run-expectancy/
```

### ohtwo.ts request path (server component, per-request)

```
loadOhTwoReport()                     — existing entry point in ohtwo.ts
  → Supabase query (unchanged)
  → buildOhTwoReport(params)          — existing function signature extended
      for each OhTwoEvent:
        → lookupDeltaRe(               — NEW call into runExpectancy.ts
            matrixBabsonOffense,
            matrixOpponentOffense,
            event.countBefore,
            event.baseStateBefore,
            event.outsBefore,
            event.paResultCode
          )
        attaches: deltaRe, reCountProgression to event
      aggregates: totalRunValueCost, counterfactualDelta per report
```

---

## Patterns to Follow

### Pattern 1: Extend scraper.ts by promoting internal functions to named exports

**What:** `extractPlayLines` and `fetchPlayByPlayHtml` are currently unexported functions in `scraper.ts`. Promote them to named exports.

**When:** The new `pbpParser.ts` needs to call them. Do not duplicate the HTML-fetch and play-extraction logic.

**Rationale:** Zero risk to the spray chart pipeline — `scrape_spray_charts.ts` imports from `scraper.ts` by name and will not notice new exports. The only change to `scraper.ts` is adding `export` keywords to two functions.

```typescript
// Before (scraper.ts line 26, 46)
async function fetchPlayByPlayHtml(url: string): Promise<string> { ... }
function extractPlayLines(html: string): string[] { ... }

// After
export async function fetchPlayByPlayHtml(url: string): Promise<string> { ... }
export function extractPlayLines(html: string): string[] { ... }
```

### Pattern 2: Store RE matrices as committed static JSON

**What:** `web/public/data/run-expectancy/matrix-babson-offense-2026.json` and `web/public/data/run-expectancy/matrix-opponent-offense-2026.json`. Both are small (<50 KB each) and deterministic from source data.

**When:** Always for this project. The existing pattern in this repo is static JSON for aggregated analytics data (spray-charts.json, Arsenals.csv, college-stats/*.json). RE matrices fit the same model: computed offline, committed, served statically.

**Why not Supabase:** RE matrices are read-only aggregates computed from public PBP data. Supabase is reserved for mutable live charting records (charting_games, charting_pitches, etc.). Storing RE matrices there would add a round-trip for data that never changes within a season and would require an extra Supabase query on every `/charting/ohtwo` load.

```typescript
// matrix.ts — JSON shape
export interface Re288Cell {
  balls: number;          // 0-3
  strikes: number;        // 0-2
  baseState: number;      // 0-7 (bitmask: bit0=1B, bit1=2B, bit2=3B)
  outs: number;           // 0-2
  avgRunsToInningEnd: number;
  sampleSize: number;     // number of plays this cell was observed
}
export interface Re288Matrix {
  builtAt: string;
  season: number;
  perspective: "babson_offense" | "opponent_offense";
  gamesUsed: number;
  cells: Re288Cell[];     // exactly 288 entries: 4×3×8×3
}
```

### Pattern 3: Base-state as a 3-bit bitmask integer

**What:** Represent which bases are occupied as a single integer 0–7 where bit 0 = runner on 1B, bit 1 = runner on 2B, bit 2 = runner on 3B.

**When:** Everywhere in the RE system — state machine tracking, matrix cell keys, delta-RE lookups.

**Why:** Makes cell indexing arithmetic instead of string-keying. `baseState = 0` means bases empty, `baseState = 7` means bases loaded. Compact for JSON storage. Deterministic equality.

```typescript
const RUNNER_ON_1B = 1; // 0b001
const RUNNER_ON_2B = 2; // 0b010
const RUNNER_ON_3B = 4; // 0b100

function hasRunnerOn1B(state: number): boolean { return (state & RUNNER_ON_1B) !== 0; }
```

### Pattern 4: Reconstruct base state as a sequential state machine inside parseFullGamePbp

**What:** Walk the `playLines` array in order, maintaining a mutable `GameState` struct. Each recognized play type mutates the struct. Reset on 3 outs.

**When:** Inside `pbpParser.ts`, called once per game.

**State struct:**

```typescript
interface GameState {
  inning: number;
  half: "top" | "bot";
  outs: number;       // 0-2
  bases: number;      // 0-7 bitmask
  runsThisInning: number;
  runsFromHere: number; // accumulated for trailing runs calc
}
```

**Transition rules (applied in order to each play line):**

| Play pattern | Outs change | Bases change | Runs |
|---|---|---|---|
| `struck out`, `grounded out`, `flied out`, `lined out`, `popped out` | +1 | no change | 0 |
| `singled` | 0 | set 1B; advance existing runners by 1 | count "scored" tokens |
| `doubled` | 0 | set 2B; advance existing by 2 | count "scored" |
| `tripled` | 0 | set 3B; clear 1B/2B | count "scored" |
| `homered` | 0 | clear all | count batter + runners |
| `walked`, `hit by pitch` | 0 | push runners: 1B forced advance chain | 0 |
| `reached on error`, `reached on fielder's choice` | 0 | set 1B | 0 |
| `stole` | 0 | advance named runner one base | 0 |
| `caught stealing`, `picked off`, `out at` | +1 | remove named runner | 0 |
| `advanced` | 0 | advance named runner | 0 |
| `scored` suffix | 0 | remove runner from base | +1 run |
| 3-out detection | reset outs=0, bases=0, flip half, runsThisInning=0 | — | — |

**Inning header detection:** The existing `scraper.ts` pattern already handles `"Nth inning"` prefixes. Keep the same match. Use the inning flip as a double-check against the state machine's out count.

**Key simplification:** Runner advancement on singles/doubles does not need to be exact (runner on 1B vs 2B after a single with a runner already on 2B). For RE matrix purposes, accuracy of the binary "is base occupied" state after the play is what matters, not the exact runner identity. Parse "scored" tokens to count runs rather than tracking individual runner movement.

### Pattern 5: Wire delta-RE into ohtwo.ts without changing its Supabase query

**What:** The `buildOhTwoReport` function currently accepts pre-fetched data structs and builds the report in memory. Add an optional `reMatrices` parameter. When provided, each `OhTwoEvent` gets a `deltaRe` field added before the events array is returned.

**When:** The Next.js page (`ohtwo/page.tsx`) will read the JSON matrices at build/request time and pass them in. The Supabase query itself is unchanged.

```typescript
// ohtwo.ts — extended signature
export function buildOhTwoReport(params: {
  games: ...;
  segments: ...;
  plateAppearances: ...;
  pitches: ...;
  reMatrices?: {         // NEW optional param
    babsonOffense: Re288Matrix;
    opponentOffense: Re288Matrix;
  };
}): OhTwoReport { ... }
```

```typescript
// ohtwo/page.tsx — read matrices at request time
import babsonMatrix from "@/../public/data/run-expectancy/matrix-babson-offense-2026.json";
import opponentMatrix from "@/../public/data/run-expectancy/matrix-opponent-offense-2026.json";
// or: fs.readFileSync at request time — either works for a force-dynamic page
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing RE matrices in Supabase

**What:** Putting RE cells in a new Supabase table and querying them per-request.

**Why bad:** Adds latency to every `/charting/ohtwo` load for data that changes at most once a week. Creates a Supabase dependency for data that is public, deterministic, and well under 100 KB. The static JSON pattern already works for spray-charts.json (347 BIP events).

**Instead:** Commit the JSON to `web/public/data/run-expectancy/`. The rebuild script produces new files; commit them when games are added.

### Anti-Pattern 2: Duplicating HTML fetch/parse logic in pbpParser.ts

**What:** Copy-pasting `fetchPlayByPlayHtml` and `extractPlayLines` from `scraper.ts` into the new parser.

**Why bad:** Two sources of truth for the Sidearm HTML parsing logic. Any future Sidearm markup change requires two fixes.

**Instead:** Promote those two functions to named exports in `scraper.ts` and import them in `pbpParser.ts`.

### Anti-Pattern 3: Rebuilding the entire state machine per pitch

**What:** Starting base-state reconstruction from the beginning of a game for every pitch lookup.

**Why bad:** O(n²) when iterating all events in a game. Unnecessary since plays are already sequential.

**Instead:** The state machine runs once per game during the build script, emitting a `baseStateBefore` and `baseStateAfter` on each `ParsedPlay`. The resulting array is what gets aggregated into the matrix.

### Anti-Pattern 4: Adding count state to the base-state reconstruction

**What:** Tracking balls/strikes as part of the PBP-derived state machine.

**Why bad:** Sidearm PBP play text does not reliably encode the count at each play. The existing `extractCountAndSequence` in `zoneMapper.ts` only works for BIP events with a pitch sequence string. For the RE matrix, count state at the start of a PA comes from the charting Supabase data (which has `ballsBefore`, `strikesBefore` on each `ChartingPitch`), not from the PBP scraper.

**Instead:** The RE matrix needs 12 count states (4 balls × 3 strikes = 0-0 through 3-2). Use the charting pitch data for count-state when computing delta-RE for individual 0-2 fastballs. The PBP scraper only needs to produce (baseStateBefore, outsBeforePlay, runsToInningEnd) per PA for the matrix cells. Count-state in the matrix is an RE-table dimension that gets looked up using the charting data, not reconstructed from PBP text.

**Practical scope reduction:** For v4.0, the RE matrix can be indexed by (baseState, outs) only — 24 cells — and count-state lookup can be a separate RE24 extension in v4.1. This aligns with standard baseball RE tables (RE24 = 24 base×out states) and avoids the unsolvable problem of inferring count from Sidearm text. The PROJECT.md says RE288 (12 counts × 8 base states × 3 out states), which is the full table; start with RE24 for the scraper-derived matrix and add count-dimension from charting data for the ohtwo-specific delta-RE.

---

## Scalability Considerations

| Concern | Current (19 games) | Season end (~35 games) | Multi-season |
|---------|-------------------|----------------------|--------------|
| JSON matrix size | ~20 KB | ~35 KB | One file per season, named by year |
| PBP scrape time | ~10s | ~18s | Run from scripts/; not a request path |
| Supabase query | Unchanged | Unchanged | Unchanged |
| Matrix cell sample size | Some cells thin (<5 plays) | Better coverage | Merge seasons for thin cells |

---

## Build Order for Phases

The dependency graph is strictly sequential. Each phase produces a working deliverable the next phase builds on.

### Phase 1 — Extend scraper.ts exports + scaffold pbpParser.ts (RE-01 prerequisite)

**What to build:**
- Promote `fetchPlayByPlayHtml` and `extractPlayLines` to named exports in `scraper.ts`
- Create `web/lib/spraychart/pbpParser.ts` with `GameState` struct, `parseFullGamePbp(playLines: string[]): ParsedGame`, and the transition rule table
- Create `web/lib/spraychart/pbpParser.test.ts` with fixture play sequences: empty inning, single-runner advance, walk force, home run, 3-out reset

**Why first:** Everything downstream depends on the base-state reconstruction being correct. Unit tests here catch logic errors before the matrix builder amplifies them across 19 games.

**Risk:** Sidearm PBP play text patterns may have edge cases not covered by `isPlayDescription`. Specifically: `reached on fielder's choice`, `intentional walk`, `sacrifice fly`, double-play text (`grounded into double play`). These need to be added to the state machine and tested against real play lines from the existing box scores.

### Phase 2 — RE24 matrix builder + JSON output (RE-02)

**What to build:**
- Create `web/lib/re/matrix.ts` with `Re288Cell`, `Re288Matrix` types and `buildReMatrix(parsedGames[], perspective)` function
- Create `web/scripts/build_re_matrix.ts` CLI: calls `discoverGameUrls`, `fetchPlayByPlayHtml`, `extractPlayLines`, `parseFullGamePbp`, then `buildReMatrix`, writes to `web/public/data/run-expectancy/`
- Commit the first generated JSON files as reference output

**Why second:** Requires Phase 1. Matrix builder is simple aggregation once parsed plays are correct.

**Note on count dimension:** Build RE24 (base × outs, 24 cells) first from the PBP data. The count dimension for RE288 comes from the charting Supabase data in Phase 3. The matrix JSON can include count=null cells initially and be extended.

### Phase 3 — delta-RE lookup + ohtwo.ts extension (RE-03, RE-04)

**What to build:**
- Create `web/lib/charting/runExpectancy.ts` with `lookupRe(matrix, baseState, outs): number | null` and `computeDeltaRe(matrix, baseStateBefore, outsBefore, baseStateAfter, outsAfter, runsScored): number`
- Extend `OhTwoEvent` with `deltaRe: number | null` and `baseStateBefore: number | null`
- Extend `OhTwoReport` with `runValueSummary: OhTwoRunValueSummary` (totalRunValueCost, avgDeltaRePerEvent)
- Extend `buildOhTwoReport` with optional `reMatrices` param
- Extend `ohtwo/page.tsx` to read JSON matrices and pass to `buildOhTwoReport`
- Add run value section to the ohtwo UI

**Why third:** Requires Phase 2 (matrices must exist to look up). The Supabase query and existing ohtwo logic are unchanged — this is additive.

**Key integration point:** The base state for a given 0-2 fastball PA is not stored in Supabase — it must come from the PBP-derived data matched by (gameDate, inning, lineupSlot or hitterName). This is the hardest integration seam. Options:
- Option A: Match by (gameDate, opponent, inning, approx PA order) — fuzzy, may misalign
- Option B: Store base state in a new static JSON keyed by (gameId, inning, paApproxOrder) alongside the matrix JSON — the build script emits this as a game-event index
- **Recommendation: Option B.** The build script already knows game dates and opponents. It can emit `web/public/data/run-expectancy/game-base-states-2026.json` mapping `{gameDate, opponent, inning, halfInning, paOrder} → {baseStateBefore, outsBefore}`. The ohtwo query has `game.gameDate`, `game.opponent`, `event.inning`, and `event.paOrder` — enough to do the lookup with reasonable confidence.

### Phase 4 — Counterfactual simulator + count-progression RE tree (RE-05, RE-06)

**What to build:**
- Extend `OhTwoReport` with `counterfactual: OhTwoCounterfactualSummary` (if X% of ball outcomes became strikeouts, total run value changes by Y)
- Extend `OhTwoReport` with `countProgressionRe: OhTwoCountProgressionTree` (expected runs after 0-2 K vs ball vs in-play, using RE matrix lookups)
- Extend `ohtwo/page.tsx` with counterfactual slider UI and RE tree visualization

**Why last:** Pure computation on top of Phase 3 data. No new scraping or schema changes.

### Phase 5 — Refresh script hardening (RE-07)

**What to build:**
- Add `--season` flag and incremental mode to `build_re_matrix.ts` (only re-scrape games not in existing JSON)
- Add to `package.json` scripts: `"re:rebuild": "npx tsx web/scripts/build_re_matrix.ts"`
- Document the refresh workflow in `docs/runbooks/`

**Why last:** The script works from Phase 2. Hardening is polish, not a blocker for the coaching dashboard.

---

## New vs. Modified Files Summary

| File | Status | Description |
|------|--------|-------------|
| `web/lib/spraychart/scraper.ts` | Modified | Export `fetchPlayByPlayHtml` and `extractPlayLines` (2-line change) |
| `web/lib/spraychart/pbpParser.ts` | New | Full-game base-state state machine |
| `web/lib/spraychart/pbpParser.test.ts` | New | State machine unit tests |
| `web/lib/re/matrix.ts` | New | RE matrix types + builder + delta-RE lookup |
| `web/scripts/build_re_matrix.ts` | New | CLI: scrape → parse → build → write JSON |
| `web/public/data/run-expectancy/matrix-babson-offense-2026.json` | New (generated) | RE24 matrix for Babson as offense |
| `web/public/data/run-expectancy/matrix-opponent-offense-2026.json` | New (generated) | RE24 matrix for opponent as offense |
| `web/public/data/run-expectancy/game-base-states-2026.json` | New (generated) | PA-level base state index for ohtwo join |
| `web/lib/charting/runExpectancy.ts` | New | Delta-RE lookup wrapper |
| `web/lib/charting/ohtwo.ts` | Modified | RE fields on OhTwoEvent/OhTwoReport; optional reMatrices param |
| `web/app/charting/ohtwo/page.tsx` | Modified | Read matrices, render run value sections |

**Unchanged:** `web/lib/spraychart/zoneMapper.ts`, `web/lib/spraychart/aggregate.ts`, `web/lib/spraychart/types.ts`, `web/scripts/scrape_spray_charts.ts`, all Supabase schema files, all charting API routes.

---

## Sources

- Direct code inspection: `web/lib/spraychart/scraper.ts`, `web/lib/charting/ohtwo.ts`, `web/lib/spraychart/types.ts`, `web/scripts/scrape_spray_charts.ts`
- Project constitution: `.planning/PROJECT.md`
- Standard RE24/RE288 matrix theory: well-established baseball analytics concept (Tom Tango, The Book)
