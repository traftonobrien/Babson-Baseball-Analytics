# Phase 11: Session Overview Enhancements - Research

**Researched:** 2026-03-10
**Domain:** Next.js charting game detail UI over the shared Phase 10 analytics engine
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keep the work on `web/app/charting/games/[id]/page.tsx`; no new route belongs to this phase.
- Add the new pitcher and hitter review sections below the existing summary stat row and above the pitch log.
- Reuse the shared analytics engine from Phase 10 instead of duplicating formulas inline.
- Build a reusable 14-cell catcher-view heat map component that works for both pitcher and hitter sections.
- Show explicit empty states when there are no pitches or no relevant PAs.
- Preserve the current charting/leaderboard visual language rather than introducing a disconnected dashboard style.

### Claude's Discretion
- Route-local vs shared component organization
- Exact card composition and responsive layout
- Whether the current top summary row is migrated to the shared analytics engine in this phase

### Deferred Ideas
- New leaderboard routes or cross-session filters
- Pitcher/hitter drill-down links
- Advanced scouting overlays beyond the required per-game review stats
</user_constraints>

---

## Summary

The existing `/charting/games/[id]` route is already a server-rendered review surface with consistent Babson-branded chrome and a dense, readable panel layout. Phase 11 should extend that page rather than restructure it. The core implementation challenge is not data access; the page already receives the full game snapshot. The main work is building stable per-segment and per-hitter view models, a reusable 14-cell zone-frequency component, and a card layout that remains legible on both desktop and narrower widths.

The Phase 10 analytics engine already computes the rate stats needed for the new breakdowns. For this phase, the best integration path is to reuse the pure analytics helpers against the already-loaded snapshot instead of re-querying the database through the async wrappers. That avoids N+1 database access inside the route while keeping one source of truth for the math.

**Primary recommendation:** add a small charting session-overview helper module for derived view models, add a reusable `ChartingZoneHeatmap` component under charting UI, then wire two new sections into `web/app/charting/games/[id]/page.tsx` in plan order: pitcher cards first, heat map second, hitter cards third.

---

## Current Codebase Findings

### Existing route structure
- `web/app/charting/games/[id]/page.tsx` already loads one `ChartingGameSnapshot`, renders game metadata panels, a five-card summary row, and a pitch log.
- The page is server-rendered and already groups pitches to PAs with `paById`, so no new route data layer is required.

### Existing analytics/data layer
- `web/lib/charting/analytics.ts` now exposes `computeSegmentStats_pure`, `computeHitterStats_pure`, and the async wrappers.
- `web/lib/charting/snapshot.ts` remains the canonical snapshot loader.
- `web/lib/charting/live.ts` already encodes PA result semantics (`K`, `BB`, `HBP`, hit codes, outs), which is a good reference for bucketizing outcome summaries.

### Existing UI primitives
- `web/app/components/leaderboards/LeaderboardChrome.tsx` provides the current page frame and panel styling patterns.
- There is no existing 14-cell charting heat map component. The site does have generic `Heatmap`, `MissHeatmap`, and `ZoneOverlay` components, but those are continuous-location visualizations, not discrete charting-cell frequency maps.

---

## Architecture Recommendations

### 1. Use view-model helpers over raw JSX logic

Create a small helper file under `web/lib/charting/` or `web/app/charting/_components/` that:
- filters pitches/PAs per segment
- groups hitter PAs by `hitterName`
- computes outcome buckets
- computes cell-frequency maps
- returns rendering-ready objects for the route

This keeps `page.tsx` from becoming an unreadable wall of filtering and math.

### 2. Reuse pure analytics helpers from Phase 10

Preferred pattern:
```ts
const segmentStats = computeSegmentStats_pure(segmentPitches, segmentPas);
const hitterStats = computeHitterStats_pure(hitterPitches, hitterPas);
```

This is better than calling `computeSegmentStats(segmentId)` in a loop because:
- the snapshot is already in memory
- it avoids repeated DB work
- it keeps the stats formula contract centralized

### 3. Add a charting-specific 14-cell heat map

The heat map should:
- accept `Partial<Record<number, number>>`
- render the 3x3 in-zone core plus the outer cells used by the charting model
- color by relative frequency, not absolute thresholds
- show an empty shell when all counts are zero

This component should be reusable for both:
- pitcher frequency heat maps
- hitter zone coverage maps

### 4. Outcome summarization should be bucket-based

Pitcher cards need readable outcomes rather than raw result-code lists. Recommended buckets:
- `K` / `KL` → strikeouts
- `BB` → walks
- `HBP` → hit by pitch
- `1B` / `2B` / `3B` / `HR` → hits
- everything else with a non-null result code → outs

That summary is enough for Phase 11 and keeps the cards compact.

### 5. Keep layout card-based, not table-based

The roadmap asks for breakdown sections, not another data table. Recommended structure:
- section header with short description
- responsive card grid
- each card: identity band, stat row(s), compact pitch mix or split row, heat map block

This preserves the “game review” feel of the current page.

---

## Testing Strategy

Vitest is already sufficient.

Recommended tests:
- unit tests for any new session-overview helper module
- render-level tests for the reusable heat map component and graceful empty states if needed
- route-level smoke via helper tests rather than full browser automation

Best quick command for this phase:
`npm --prefix web test -- --run lib/charting`

Full safety net:
`npm --prefix web test -- --run`

Build gate:
`npm --prefix web run build`

---

## Validation Architecture

Phase 11 can stay Nyquist-compliant without browser automation if:
- every new derived view-model helper is covered by unit tests
- the heat map component is tested for empty and non-empty rendering states
- the full web suite and Next build remain green

Because the work lands on an existing server route, the highest-value validation is deterministic helper coverage plus a clean production build.

---

## Recommended File Layout

```text
web/app/charting/_components/
  ChartingZoneHeatmap.tsx          # new reusable 14-cell frequency map

web/lib/charting/
  sessionOverview.ts               # new helper/view-model builder(s)
  sessionOverview.test.ts          # new tests for grouping + outcomes + zone maps

web/app/charting/games/[id]/page.tsx
  # wires the new sections into the existing route
```

If the route gets too large, the section cards can be factored into route-local components later. The important part is keeping the data shaping out of the page body.

---

## Risks and Mitigations

| Risk | Why it matters | Mitigation |
|------|----------------|------------|
| Reintroducing formula drift | Phase 10 intentionally centralized analytics math | Use only Phase 10 pure helpers for rates |
| Overgrown route component | The page already has multiple panels and a pitch log | Move grouping/bucketing into a helper module |
| Heat map ambiguity | Existing site heat maps are continuous, not cell-based | Build a charting-specific discrete component |
| Misleading empty stats | Null rates can look like 0% if formatted carelessly | Render explicit “No located pitches” / “No completed PAs” states |

---

## Recommendation

Plan the phase in three waves exactly as the roadmap suggests:
- `11-01`: view models + pitcher breakdown section
- `11-02`: reusable 14-cell heat map
- `11-03`: hitter breakdown section + full route polish/tests

That sequence keeps the page shippable after each plan and minimizes rework.
