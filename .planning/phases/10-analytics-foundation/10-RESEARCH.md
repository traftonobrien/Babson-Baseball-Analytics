# Phase 10: Analytics Foundation - Research

**Researched:** 2026-03-09
**Domain:** TypeScript analytics computation layer over Drizzle/Neon charting data
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stat Engine Scope — Pitcher Side**
- `computeSegmentStats(segmentId)` — computes stats for ONE pitcher's segment (stint) within a game
- Stats: Strike%, Zone%, Whiff%, Chase%, FPS%, pitch mix by type (FB/CB/SL/CH/Split/Other), K%, BB%
- Zone: cells 1-9 = in-zone, cells 10+ = out-of-zone (14-cell Trackman layout)
- `aggregatePitcherStats(playerId, options?)` — aggregates across multiple segments/games
- Filter options: `{ from?: Date, to?: Date, gameIds?: string[] }`

**Stat Engine Scope — Hitter Side**
- `computeHitterStats(hitterName, gameId)` — per-session hitter stats
- Stats: pitches seen, Chase%, contact rate, whiff rate, K%, BB%, zone frequency map (14 cells), pitch-type splits (vs Fastball/Breaking/Offspeed)
- Pitch type grouping: Fastball = "Fastball"; Breaking = "Curveball" | "Slider"; Offspeed = "Changeup" | "Split/Cut" | "Other"
- `aggregateHitterStats(hitterName, options?)` — aggregates across sessions, same filter shape as pitchers

**Data Access Pattern**
- Functions query Drizzle/Neon directly (server-side only) — these are NOT client-side utilities
- Keep functions async, accepting db instance or using the shared `db` import
- Return typed result objects — define clear TypeScript interfaces for all stat shapes

**Reuse Over Inline Computation**
- The existing `calculateStats()` inline in `/charting/games/[id]/page.tsx` computes game-level stats — Phase 10 supersedes this pattern
- Phase 11 will call `computeSegmentStats()` to replace the current inline stats
- Phase 12 will call `aggregatePitcherStats()` and `aggregateHitterStats()` for the leaderboard

**Testing Strategy**
- Unit tests against a known fixture (seeded pitch/PA data) — NOT against live Neon
- Test file at `web/lib/charting/analytics.test.ts`
- Cover edge cases: no pitches, no located pitches, single PA, zero swings

**Stat Definitions (locked)**
- **Strike%**: (called_strike + swinging_strike + foul + in_play + bunt_foul) / total pitches
- **Whiff%**: swinging_strike / (swinging_strike + in_play + foul + bunt_foul) [swings only]
- **Chase%**: out-of-zone swings / total out-of-zone pitches
- **FPS%**: pitches where ballsBefore=0 AND strikesBefore=0 that result in a strike outcome / total first pitches
- **K%**: PAs where resultCode = "K" or "KL" (looking) / total PAs
- **BB%**: PAs where resultCode = "BB" / total PAs
- **Contact%** (hitter): (in_play + foul + bunt_foul) / (in_play + foul + bunt_foul + swinging_strike) [swings that made contact]

**Zone Cell Layout (14-cell Trackman)**
- Cells 1-9: in-zone (3x3 grid, catcher view)
- Cells 10-14: out-of-zone (4 outer corners + additional cells)
- Zone%: pitches with locationCell 1-9 / total located pitches
- Chase%: swings on locationCell > 9 / total out-of-zone pitches

### Claude's Discretion
- Internal helper functions (e.g., categorizing pitch results as strikes, swings, etc.) — structure as needed
- Whether to use a single pass or multiple queries per function
- Whether aggregation does weighted averaging or simple sum-then-divide
- File structure within `web/lib/charting/` — e.g., separate `analytics-pitcher.ts` and `analytics-hitter.ts` vs single file

### Deferred Ideas (OUT OF SCOPE)
- Pitcher profile integration at /player/[playerId] — v3, keep data model clean for it
- Graphics and scouting reports — future milestone
- Count-leverage stats (2-strike%, 3-0 attack, etc.) — v2 of the leaderboard
- Hard contact % from result codes — deferred; result codes are too varied to parse reliably in Phase 10
</user_constraints>

---

## Summary

Phase 10 is a pure TypeScript computation layer. The data model and query patterns are already established by Phases 1-8. The analytics engine reads from three tables: `charting_pitches`, `charting_plate_appearances`, and `charting_pitcher_segments`. All required stat formulas are locked in CONTEXT.md and the existing `calculateStats()` in `/charting/games/[id]/page.tsx` is a direct reference implementation.

The main engineering decision at discretion level is whether aggregation fetches all raw pitches/PAs across sessions and sums numerators/denominators (correct for rate stats), or averages per-session percentages (incorrect statistically). Sum-then-divide is the right approach: Chase% across 3 games is total chase swings / total out-of-zone opportunities, not the mean of three game-level Chase% values.

The test infrastructure is fully in place. Vitest 4.x runs via `npm --prefix web test`. The existing `fixtures.ts` exports `fixtureGameSnapshot` which already contains two segments, three PAs, and eight pitches — this fixture must be extended with richer data to cover all stat branches (swings, chases, first-pitch strikes). A new larger fixture seeded for analytics is needed at `web/lib/charting/fixtures.ts` or an `analytics-fixtures.ts` alongside.

**Primary recommendation:** Build `analytics.ts` as a single file (or split into `analytics-pitcher.ts` / `analytics-hitter.ts`) under `web/lib/charting/`, use single-pass in-memory computation over pre-fetched pitch + PA arrays, and sum raw counts before dividing for all cross-session aggregation.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 | DB queries — `eq`, `and`, `inArray`, `gte`, `lte` | Already installed; all existing charting queries use it |
| @neondatabase/serverless | ^1.0.2 | Neon HTTP transport | Already wired in `web/db/index.ts` |
| TypeScript | ^5 | Typed interfaces for all stat shapes | Project-wide standard |
| vitest | ^4.0.18 | Unit tests | Already configured in `web/vitest.config.mts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 | Date comparison for filter options (from/to) | Used when filtering by date range in aggregation functions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory computation over fetched arrays | Raw SQL aggregation (COUNT, SUM, GROUP BY) | SQL aggregation is faster at scale but harder to test without a live DB; in-memory is testable with pure fixtures and sufficient for this dataset size |
| Single analytics.ts file | Split analytics-pitcher.ts / analytics-hitter.ts | Split makes PRs cleaner if both halves grow large; single file is simpler for a first pass. Both are at discretion. |

**Installation:** No new packages needed. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure
```
web/lib/charting/
├── analytics.ts          # (new) computeSegmentStats, aggregatePitcherStats,
│                         #        computeHitterStats, aggregateHitterStats
├── analytics.test.ts     # (new) vitest unit tests against fixtures
├── types.ts              # existing — ChartingPitch, ChartingPlateAppearance, etc.
├── domain.ts             # existing — PITCH_TYPES, PITCH_RESULTS, validators
├── snapshot.ts           # existing — loadChartingGameSnapshot (reference for query pattern)
└── fixtures.ts           # existing — fixtureGameSnapshot (extend for analytics tests)
```

### Pattern 1: Load Then Compute (Established in This Codebase)

**What:** Fetch all required rows from the DB up front, then compute stats in-memory over the TypeScript arrays. No raw SQL aggregation.

**When to use:** Always — this matches `loadChartingGameSnapshot` and makes functions unit-testable with fixture data.

**Example:**
```typescript
// Source: web/lib/charting/snapshot.ts (existing pattern)
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { chartingPitches, chartingPlateAppearances, chartingPitcherSegments } from "@/db/schema";

export async function computeSegmentStats(segmentId: string): Promise<SegmentStats | null> {
  // 1. Fetch all PAs for this segment
  const pas = await db
    .select()
    .from(chartingPlateAppearances)
    .where(eq(chartingPlateAppearances.segmentId, segmentId));

  if (pas.length === 0) return null;

  // 2. Fetch all pitches for those PAs
  const paIds = pas.map(pa => pa.id);
  const pitches = await db
    .select()
    .from(chartingPitches)
    .where(inArray(chartingPitches.paId, paIds));

  // 3. Compute in-memory
  return computeStatsFromArrays(pitches, pas);
}
```

### Pattern 2: Pure Computation Helpers (Testability)

**What:** Extract the actual math into pure functions that accept arrays and return stat objects. The async DB-fetching wrapper calls these helpers. Tests cover the helpers directly with fixture data.

**When to use:** Always — this is why the test strategy says "NOT against live Neon". The async wrappers are thin shells; all logic is in pure synchronous functions.

**Example:**
```typescript
// Pure, synchronous — fully testable with fixture arrays
export function computeStatsFromArrays(
  pitches: ChartingPitch[],
  pas: ChartingPlateAppearance[]
): SegmentStats {
  const total = pitches.length;
  if (total === 0) return emptySegmentStats();

  const strikes = pitches.filter(isStrike).length;
  const swings  = pitches.filter(isSwing).length;
  const whiffs  = pitches.filter(p => p.pitchResult === "swinging_strike").length;
  // ...
}
```

### Pattern 3: Cross-Session Aggregation — Sum Numerators/Denominators

**What:** When aggregating across multiple segments/games, collect all raw pitches and PAs from all qualifying segments, then run the same `computeStatsFromArrays()` helper over the combined array. Do NOT average per-session percentages.

**When to use:** In `aggregatePitcherStats` and `aggregateHitterStats`. This is the only statistically correct approach for rate stats.

**Example:**
```typescript
export async function aggregatePitcherStats(
  playerId: string,
  options?: AggregateOptions
): Promise<AggregatedPitcherStats | null> {
  // 1. Find all segments for this player matching filters
  let query = db.select().from(chartingPitcherSegments)
    .where(eq(chartingPitcherSegments.playerId, playerId));
  // apply gameIds or date filters via inner join to chartingGames if needed

  const segments = await query;
  if (segments.length === 0) return null;

  // 2. Fetch all pitches + PAs across all segments (one query each)
  const segIds = segments.map(s => s.id);
  const [allPas, allPitches] = await Promise.all([
    db.select().from(chartingPlateAppearances).where(inArray(chartingPlateAppearances.segmentId, segIds)),
    db.select().from(chartingPitches).where(inArray(chartingPitches.paId, paIds)),
  ]);

  // 3. Run the same pure helper over combined arrays
  return {
    sessions: segments.length,
    ...computeStatsFromArrays(allPitches, allPas),
  };
}
```

### Pattern 4: Date-Range Filtering via Join

**What:** The `from`/`to` date filter in `AggregateOptions` targets `chartingGames.gameDate` (ISO string `yyyy-mm-dd`). Filter by joining through the segments table to games.

**When to use:** When `options.from` or `options.to` are provided.

**Example:**
```typescript
// chartingGames.gameDate is an ISO text column "yyyy-mm-dd"
// Use simple string comparison — ISO dates are lexicographically sortable
import { gte, lte } from "drizzle-orm";

// After fetching segments, inner-join to games to apply date filter:
const games = await db.select()
  .from(chartingGames)
  .where(
    and(
      inArray(chartingGames.id, gameIds),
      options.from ? gte(chartingGames.gameDate, options.from.toISOString().slice(0,10)) : undefined,
      options.to   ? lte(chartingGames.gameDate, options.to.toISOString().slice(0,10))   : undefined,
    )
  );
```

### Anti-Patterns to Avoid

- **Averaging percentages across sessions:** Chase% aggregated = sum(chase swings) / sum(out-of-zone). Never mean(perGameChasePct).
- **Computing stats client-side:** All four functions are server-side only (they import `db`). Do not export them as utilities usable in Client Components.
- **Querying pitches by gameId directly for segment stats:** Pitches link to PAs via `paId`, not to segments directly. Correct traversal: segmentId → PA ids → pitch ids.
- **Treating `locationCell > 9` as always out-of-zone:** locationCell can be null (not recorded). Always filter to non-null before computing zone-based stats. Denominator for Zone% and Chase% is located pitches only.
- **Including `hit_by_pitch` in swing counts:** HBP is not a swing, not a strike (for whiff purposes). It is a ball-equivalent for swing stats.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| DB querying with filters | Custom SQL string builder | Drizzle `eq`, `and`, `inArray`, `gte`, `lte` from `drizzle-orm` |
| Date parsing for filter options | Custom date parser | `date-fns` `parseISO` or native `.toISOString().slice(0,10)` |
| Test runner | Custom test harness | Vitest (already configured at `web/vitest.config.mts`) |
| Fixture data management | Fetch from live DB in tests | Extend `web/lib/charting/fixtures.ts` with an analytics-scale fixture |

**Key insight:** The hardest part of this phase is not the math — the formulas are locked. It is getting the traversal right (segment → PA → pitch) and ensuring every denominator guards against divide-by-zero and null locationCell.

---

## Common Pitfalls

### Pitfall 1: Null locationCell in Zone/Chase Denominators
**What goes wrong:** `zonePct = inZone / pitches.length` counts unlocated pitches in the denominator, deflating Zone%.
**Why it happens:** Not all pitches are given a locationCell during charting.
**How to avoid:** Always filter to `locationCell !== null` before computing any zone-based stat. Use `locatedPitches.length` as the denominator for Zone%, and `locatedOutOfZone.length` for Chase%.
**Warning signs:** Zone% below 20% even for known strike-throwers.

### Pitfall 2: Divide-by-Zero on Empty Sub-Populations
**What goes wrong:** `whiffPct = whiffs / swings` throws NaN when there are zero swings (all pitches are balls/HBP/called strikes).
**Why it happens:** Edge case: new pitcher who threw only one pitch (HBP), or test fixtures with no swings.
**How to avoid:** Guard every rate with `denominator > 0 ? (numerator / denominator) * 100 : null`. Return null, not 0, to distinguish "no data" from "truly 0%".
**Warning signs:** NaN appearing in stat cards downstream in Phase 11/12.

### Pitfall 3: PA resultCode = null (Open PA)
**What goes wrong:** Including open (in-progress) PAs in K% / BB% denominators inflates or deflates rates.
**Why it happens:** `resultCode` is null while a PA is still live. Fixtures include one open PA (PA_3).
**How to avoid:** Filter PAs to `resultCode !== null` before computing K% and BB%. Only closed PAs count toward outcomes.
**Warning signs:** K%+BB% do not sum near expected range; suspiciously low numbers.

### Pitfall 4: Pitch Traversal — Pitches Don't Link to Segments Directly
**What goes wrong:** Querying `chartingPitches WHERE gameId = X` returns all pitches in the game, not just pitches for a specific pitcher's segment.
**Why it happens:** The schema has no direct `segmentId` on `chartingPitches`. The link is: segment → PA (via `segmentId`) → pitch (via `paId`).
**How to avoid:** For `computeSegmentStats(segmentId)`: first fetch PAs where `segmentId = segmentId`, collect PA ids, then fetch pitches where `paId IN [pa ids]`.
**Warning signs:** Stats for pitcher A include pitches thrown by pitcher B.

### Pitfall 5: K% Includes "KL" (Looking Strikeout)
**What goes wrong:** Only counting `resultCode === "K"` misses looking strikeouts which are stored as `"KL"` per CONTEXT.md.
**Why it happens:** K and KL are both strikeout outcomes but stored as separate codes in `PAResultCode`.
**How to avoid:** `K% = pas.filter(pa => pa.resultCode === "K" || pa.resultCode === "KL").length / closedPAs`.
**Warning signs:** K% suspiciously low compared to expected strikeout rate.

### Pitfall 6: Aggregation Date Filter Needs a Game Join
**What goes wrong:** `aggregatePitcherStats` with a `from/to` filter has no date on the `chartingPitcherSegments` table — dates live on `chartingGames`.
**Why it happens:** The segment table only has `gameId`, not `gameDate`.
**How to avoid:** When date filters are present, first query `chartingGames` filtered by date range to get matching game IDs, then filter segments to those game IDs. Or join segments to games in one query.
**Warning signs:** Date filters silently return all-time data instead of the requested range.

---

## Code Examples

Verified patterns from the existing codebase:

### Drizzle `inArray` Pattern (required for pitch traversal)
```typescript
// Source: drizzle-orm (installed at ^0.45.1)
import { eq, and, inArray } from "drizzle-orm";

const paIds = pas.map(pa => pa.id);
const pitches = await db
  .select()
  .from(chartingPitches)
  .where(inArray(chartingPitches.paId, paIds));
```

### Existing `calculateStats` Reference (game-level — Phase 10 extends this per-segment)
```typescript
// Source: web/app/charting/games/[id]/page.tsx lines 33-68
// Key patterns already proven correct in production:

const strikes = pitches.filter(p =>
  ["called_strike", "swinging_strike", "foul", "in_play", "bunt_foul"].includes(p.pitchResult)
).length;

const swings = whiffs + inPlay + pitches.filter(p =>
  ["foul", "bunt_foul"].includes(p.pitchResult)
).length;

const swingsOZone = locatedPitches.filter(p =>
  p.locationCell > 9 &&
  ["swinging_strike", "foul", "in_play", "bunt_foul"].includes(p.pitchResult)
).length;
const totalOZone = locatedPitches.filter(p => p.locationCell > 9).length;

const firstPitches = pitches.filter(p => p.ballsBefore === 0 && p.strikesBefore === 0);
```

### Typed Stat Interface Pattern (consistent with existing types.ts style)
```typescript
// Source: pattern from web/lib/charting/types.ts conventions

export interface SegmentStats {
  totalPitches: number;
  strikePct: number | null;
  zonePct: number | null;
  whiffPct: number | null;
  chasePct: number | null;
  fpsPct: number | null;
  kPct: number | null;
  bbPct: number | null;
  pitchMix: Record<PitchType, number>;   // count per pitch type
  pitchMixPct: Record<PitchType, number>; // percent per pitch type
}

export interface HitterStats {
  totalPitches: number;
  totalPAs: number;
  chasePct: number | null;
  contactPct: number | null;
  whiffPct: number | null;
  kPct: number | null;
  bbPct: number | null;
  zoneFrequency: Partial<Record<number, number>>;  // cell 1-14 → count
  vsFastball: PitchGroupStats;
  vsBreaking: PitchGroupStats;
  vsOffspeed: PitchGroupStats;
}
```

### Vitest Test Pattern (matches existing charting.test.ts style)
```typescript
// Source: web/lib/charting/charting.test.ts (existing pattern)
import { describe, it, expect } from "vitest";
import { computeSegmentStats } from "./analytics";   // new
import { fixtureAnalyticsSnapshot } from "./fixtures"; // extended fixture

describe("computeSegmentStats", () => {
  it("returns null for a segment with no pitches", () => {
    expect(computeSegmentStats_pure([], [])).toBeNull();
  });

  it("computes Strike% correctly from known fixture", () => {
    const stats = computeSegmentStats_pure(
      fixtureAnalyticsSnapshot.pitchesForSegA,
      fixtureAnalyticsSnapshot.pasForSegA
    );
    expect(stats?.strikePct).toBeCloseTo(66.7, 1);
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline `calculateStats()` in game page | Shared `computeSegmentStats()` in `analytics.ts` | Phase 10 | Phase 11 and 12 can consume without duplicating math |
| Game-level aggregate only | Per-segment + cross-session aggregation | Phase 10 | Enables per-pitcher leaderboard in Phase 12 |

**Deprecated/outdated:**
- `calculateStats()` in `/charting/games/[id]/page.tsx`: will be replaced by `computeSegmentStats()` calls from Phase 11 onward. Do NOT delete it in Phase 10 — Phase 11 owns that migration.

---

## Open Questions

1. **Zone cells 10-14 vs. 10-17**
   - What we know: CONTEXT.md says "Cells 10+ = out-of-zone". The schema allows `locationCell` up to 17 (`LOCATION_CELL_MAX = 17` in domain.ts). The fixture uses cells 11, 14, 15, 16, 17.
   - What's unclear: Are cells 15-17 also out-of-zone? Based on the code `locationCell > 9` they are — but the zone frequency map for hitters should record ALL captured cells (1-17) to avoid silently dropping real data.
   - Recommendation: For Zone%/Chase%, use `locationCell > 9` as the out-of-zone test (consistent with existing `calculateStats`). For the hitter zone frequency map, record counts for all non-null cells. The CONTEXT.md phrase "14-cell Trackman layout" refers to the labeled zones 1-14; cells 15-17 are overflow/PO cells that appear in the DB.

2. **Aggregation with gameIds filter — resolver approach**
   - What we know: `aggregatePitcherStats(playerId, { gameIds: ["abc"] })` must filter to specific games. Segments don't store the date — they store `gameId`.
   - What's unclear: Should `gameIds` filter be applied at the segment query level (fastest) or after fetching segments then cross-referencing?
   - Recommendation: Apply `inArray(chartingPitcherSegments.gameId, options.gameIds)` directly in the segment query. This is straightforward with Drizzle and avoids a second round-trip.

3. **Fixture richness for analytics tests**
   - What we know: The existing `fixtureGameSnapshot` has 8 pitches across 3 PAs — sufficient for existence checks but not enough to verify percentage calculations with meaningful precision.
   - What's unclear: Whether to extend `fixtures.ts` or create a dedicated `analytics-fixtures.ts`.
   - Recommendation: Create a second export `fixtureAnalyticsSnapshot` inside `fixtures.ts` (or a new `analytics-fixtures.ts`). The analytics fixture needs at minimum: 15+ pitches per segment, out-of-zone pitches with swings, first-pitch strikes and balls, and at least 4 closed PAs (1K, 1BB, 2 in-play) per segment to make all stat branches reachable.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `web/vitest.config.mts` (includes `lib/**/*.test.ts`) |
| Quick run command | `npm --prefix web test -- --reporter=verbose web/lib/charting/analytics.test.ts` |
| Full suite command | `npm --prefix web test` |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `computeSegmentStats` returns correct Strike%, Whiff%, Zone%, Chase%, FPS%, K%, BB%, pitch mix | unit | `npm --prefix web test -- web/lib/charting/analytics.test.ts` | Wave 0 |
| `computeSegmentStats` returns null on empty pitch array | unit | same | Wave 0 |
| `aggregatePitcherStats` sums numerators/denominators across sessions | unit | same | Wave 0 |
| `aggregatePitcherStats` applies gameIds filter | unit | same | Wave 0 |
| `aggregatePitcherStats` applies from/to date filter | unit | same | Wave 0 |
| `computeHitterStats` returns Chase%, Contact%, Whiff%, K%, BB%, zone map, pitch-type splits | unit | same | Wave 0 |
| `computeHitterStats` excludes open PAs from K%/BB% | unit | same | Wave 0 |
| `aggregateHitterStats` sums across multiple sessions | unit | same | Wave 0 |
| All stat functions return null (not NaN/0) for divide-by-zero branches | unit | same | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm --prefix web test -- web/lib/charting/analytics.test.ts`
- **Per wave merge:** `npm --prefix web test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `web/lib/charting/analytics.ts` — new file, covers all four public functions
- [ ] `web/lib/charting/analytics.test.ts` — new file, covers all stat branches listed above
- [ ] Analytics-scale fixture data — extend `web/lib/charting/fixtures.ts` with `fixtureAnalyticsSnapshot` (15+ pitches per segment, all result types represented)

---

## Sources

### Primary (HIGH confidence)
- `web/lib/charting/types.ts` — canonical ChartingPitch, ChartingPlateAppearance, ChartingPitcherSegment shapes
- `web/lib/charting/snapshot.ts` — established Drizzle query pattern (eq, asc, Promise.all)
- `web/db/schema.ts` — table definitions; confirmed `chartingPitches` has no direct segmentId (traverse via paId)
- `web/lib/charting/domain.ts` — PITCH_TYPES, PITCH_RESULTS constants; LOCATION_CELL_MAX=17
- `web/app/charting/games/[id]/page.tsx` lines 33-68 — production `calculateStats()` reference implementation
- `web/lib/charting/fixtures.ts` — existing `fixtureGameSnapshot` structure (2 segments, 3 PAs, 8 pitches)
- `web/vitest.config.mts` — test includes `lib/**/*.test.ts`, alias `@` to project root
- `.planning/phases/10-analytics-foundation/10-CONTEXT.md` — locked stat definitions and scope

### Secondary (MEDIUM confidence)
- `web/lib/charting/charting.test.ts` — test style conventions (describe/it/expect from vitest)
- `web/app/api/charting/games/[id]/route.ts` — `and`, `eq` from drizzle-orm are available and in use

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed, patterns verified in existing code
- Architecture: HIGH — schema is fixed, traversal path confirmed, stat formulas locked in CONTEXT.md
- Pitfalls: HIGH — null locationCell and PA traversal verified by reading actual schema and existing calculateStats code
- Test infrastructure: HIGH — vitest config confirmed, test pattern confirmed from charting.test.ts

**Research date:** 2026-03-09
**Valid until:** 2026-05-09 (stable schema; no external dependencies changing)
