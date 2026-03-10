# Phase 11: Session Overview Enhancements - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning
**Source:** Derived from ROADMAP.md, Phase 10 outputs, and current `/charting/games/[id]` implementation

<domain>
## Phase Boundary

Phase 11 enriches the existing `web/app/charting/games/[id]/page.tsx` session overview page with two new review sections:
- A per-pitcher breakdown section for every Babson pitcher segment in the game
- A per-hitter breakdown section for every opposing hitter who batted in the game

This phase is presentation-focused. It consumes the shared analytics engine from Phase 10 and keeps the work inside the existing game-detail route. No new top-level route belongs to this phase.

The current page already renders:
- Game details
- Pitchers used
- Starting lineup
- One row of game-level summary stat cards
- A play-by-play pitch log

Phase 11 extends that page below the existing summary row and above the pitch log.

</domain>

<decisions>
## Implementation Decisions

### Route and Placement
- Keep the overview on `/charting/games/[id]`; do not introduce a separate analytics page in this phase.
- Insert the new pitcher and hitter sections below the current stat-card row and above the play-by-play pitch log.

### Reuse Phase 10 Analytics
- Use the shared analytics engine in `web/lib/charting/analytics.ts` for all derived pitcher and hitter stats.
- Do not duplicate the same formulas inline in the page component.
- The existing page-level `calculateStats()` can remain for the current top summary row unless replacing it is clearly simpler during implementation.

### Pitcher Section Scope
- Each Babson pitcher segment shown on the page gets a breakdown card.
- Each pitcher card shows pitch mix, Strike%, Zone%, Whiff%, Chase%, FPS%, and plate-appearance outcomes.
- Plate-appearance outcomes should be readable at a glance and cover at least K, BB, HBP, hits, and outs.

### Hitter Section Scope
- Every hitter who appears in a charted plate appearance should receive a breakdown card.
- Each hitter card shows pitches seen, Chase%, Contact%, K/BB result, and pitch-type split context from the Phase 10 hitter engine.

### Heat Map Component
- Build a reusable 14-cell catcher-view zone heat map component for both pitcher and hitter sections.
- The component should visualize cell frequency, degrade gracefully when there are no located pitches, and fit the existing charting page chrome.

### Visual Direction
- Preserve the existing charting portal visual language: dark Babson-branded panels, rounded card shapes, compact uppercase labels, and dense but readable baseball review UI.
- Avoid generic dashboard-table treatment; the page should still feel like a game-review surface, not a spreadsheet.

### Degraded States
- If no pitches or no relevant PAs exist for a section, render an explicit empty state instead of blank cards or misleading zeroes.
- Null/undefined rates from the analytics engine should display as unavailable rather than `NaN`, `0.0`, or empty markup.

### Claude's Discretion
- Exact card composition, responsive layout, and stat grouping are implementation choices as long as the phase success criteria remain satisfied.
- Whether to factor the new UI into route-local subcomponents or shared charting components is open.
- Whether the game-level summary row switches to the Phase 10 analytics engine during this phase is discretionary.

</decisions>

<specifics>
## Specific Ideas

### Existing Files To Reuse
- `web/app/charting/games/[id]/page.tsx` — current overview page and existing stat-card placement
- `web/lib/charting/snapshot.ts` — game snapshot loading
- `web/lib/charting/analytics.ts` — per-segment and per-hitter analytics
- `web/app/components/leaderboards/LeaderboardChrome.tsx` — page frame and panel styles

### Likely Data Derivations
- Pitcher section can iterate over `snapshot.segments`, matching each segment to its PAs and pitches before calling the Phase 10 analytics helpers.
- Hitter section can group plate appearances by `hitterName`, match pitches via `paId`, then render cards in lineup order or first-seen order.
- Pitcher outcome summaries likely need a lightweight PA result categorizer for `K`, `BB`, `HBP`, hit codes, and generic outs.

### Heat Map Notes
- The charting data already uses catcher-view `locationCell` values.
- The heat map should reflect the 14-cell charting layout rather than the existing generic strike-zone overlays used elsewhere in the site.
- The same component should be able to render both pitcher frequency and hitter zone coverage without branching into separate implementations.

</specifics>

<deferred>
## Deferred Ideas

- Cross-session comparisons and filters belong to Phase 12 leaderboard work, not this phase.
- Clicking cards through to pitcher/hitter history pages belongs to Phase 13.
- Advanced scouting layers such as count-leverage splits, hard-hit summaries, and sequence callouts remain out of scope here.

</deferred>

---

*Phase: 11-session-overview-enhancements*
*Context gathered: 2026-03-10 from roadmap, shipped analytics engine, and current charting detail page*
