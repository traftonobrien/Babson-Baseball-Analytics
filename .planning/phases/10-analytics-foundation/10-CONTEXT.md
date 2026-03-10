# Phase 10: Analytics Foundation - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning
**Source:** /gsd:new-project questioning session

<domain>
## Phase Boundary

Phase 10 delivers a shared analytics engine in `web/lib/charting/analytics.ts` that computes pitch-level stats for both Babson pitchers (per segment) and opposing hitters (per session and cross-session). This is a pure computation layer — no UI, no new routes — consumed by Phase 11 (session overview) and Phase 12 (leaderboard).

The existing `/charting/games/[id]` page already computes aggregate game-level stats inline. Phase 10 replaces/extends that with:
- Per-segment (per-pitcher) stat computation
- Per-hitter stat computation
- Cross-session aggregation with date-range and gameId filters

</domain>

<decisions>
## Implementation Decisions

### Stat Engine Scope — Pitcher Side
- `computeSegmentStats(segmentId)` — computes stats for ONE pitcher's segment (stint) within a game
- Stats: Strike%, Zone%, Whiff%, Chase%, FPS%, pitch mix by type (FB/CB/SL/CH/Split/Other), K%, BB%
- Zone: cells 1-9 = in-zone, cells 10+ = out-of-zone (14-cell Trackman layout)
- `aggregatePitcherStats(playerId, options?)` — aggregates across multiple segments/games
- Filter options: `{ from?: Date, to?: Date, gameIds?: string[] }`

### Stat Engine Scope — Hitter Side
- `computeHitterStats(hitterName, gameId)` — per-session hitter stats
- Stats: pitches seen, Chase%, contact rate, whiff rate, K%, BB%, zone frequency map (14 cells), pitch-type splits (vs Fastball/Breaking/Offspeed)
- Pitch type grouping: Fastball = "Fastball"; Breaking = "Curveball" | "Slider"; Offspeed = "Changeup" | "Split/Cut" | "Other"
- `aggregateHitterStats(hitterName, options?)` — aggregates across sessions, same filter shape as pitchers

### Data Access Pattern
- Functions query Drizzle/Neon directly (server-side only) — these are NOT client-side utilities
- Keep functions async, accepting db instance or using the shared `db` import
- Return typed result objects — define clear TypeScript interfaces for all stat shapes

### Reuse Over Inline Computation
- The existing `calculateStats()` inline in `/charting/games/[id]/page.tsx` computes game-level stats — Phase 10 supersedes this pattern
- Phase 11 will call `computeSegmentStats()` to replace the current inline stats
- Phase 12 will call `aggregatePitcherStats()` and `aggregateHitterStats()` for the leaderboard

### Testing Strategy
- Unit tests against a known fixture (seeded pitch/PA data) — NOT against live Neon
- Test file at `web/lib/charting/analytics.test.ts`
- Cover edge cases: no pitches, no located pitches, single PA, zero swings

### Claude's Discretion
- Internal helper functions (e.g., categorizing pitch results as strikes, swings, etc.) — structure as needed
- Whether to use a single pass or multiple queries per function
- Whether aggregation does weighted averaging or simple sum-then-divide
- File structure within `web/lib/charting/` — e.g., separate `analytics-pitcher.ts` and `analytics-hitter.ts` vs single file

</decisions>

<specifics>
## Specific Ideas

### Zone Cell Layout (14-cell Trackman)
- Cells 1-9: in-zone (3x3 grid, catcher view)
- Cells 10-14: out-of-zone (4 outer corners + PO cell 17 or similar)
- Zone%: pitches with locationCell 1-9 / total located pitches
- Chase%: swings on locationCell > 9 / total out-of-zone pitches

### Stat Definitions (locked)
- **Strike%**: (called_strike + swinging_strike + foul + in_play + bunt_foul) / total pitches
- **Whiff%**: swinging_strike / (swinging_strike + in_play + foul + bunt_foul) [swings only]
- **Chase%**: out-of-zone swings / total out-of-zone pitches
- **FPS%**: pitches where ballsBefore=0 AND strikesBefore=0 that result in a strike outcome / total first pitches
- **K%**: PAs where resultCode = "K" or "KL" (looking) / total PAs
- **BB%**: PAs where resultCode = "BB" / total PAs
- **Contact%** (hitter): (in_play + foul + bunt_foul) / (in_play + foul + bunt_foul + swinging_strike) [swings that made contact]

### Existing Code to Reference
- `web/lib/charting/types.ts` — ChartingPitch, ChartingPlateAppearance, ChartingPitcherSegment types
- `web/lib/charting/snapshot.ts` — existing data loading patterns (loadChartingGameSnapshot)
- `web/db/schema.ts` — chartingPitches, chartingPlateAppearances, chartingPitcherSegments tables
- `/charting/games/[id]/page.tsx` — existing `calculateStats()` for reference (game-level)

</specifics>

<deferred>
## Deferred Ideas

- Pitcher profile integration at /player/[playerId] — v3, keep data model clean for it
- Graphics and scouting reports — future milestone
- Count-leverage stats (2-strike%, 3-0 attack, etc.) — v2 of the leaderboard
- Hard contact % from result codes — deferred; result codes are too varied to parse reliably in Phase 10

</deferred>

---

*Phase: 10-analytics-foundation*
*Context gathered: 2026-03-09 via /gsd:new-project questioning session*
