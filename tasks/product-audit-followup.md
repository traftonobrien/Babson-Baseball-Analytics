# Product Audit Follow-Up — Claude Execution Doc
_Created 2026-03-19. Use this as the default follow-up plan for the March 19 site/product audit._

## Objective

Improve the product's output quality, continuity, trust, and execution capacity without adding another disconnected module.

The app already has strong breadth:
- player profiles
- charting capture + insights + leaderboard
- Trackman
- Command/outing review
- mechanics sessions
- NCAA-backed team stats
- strong guide/dictionary content

The next stage of value should come from making those surfaces work together better, not from expanding the sitemap.

## Explicit Non-Goals

- Do **not** add a new top-of-profile "player story" hero/summary block.
- Do **not** add another new hub/page family before continuity and synthesis work lands.
- Do **not** reintroduce a separate charting password flow.
- Do **not** start with a broad auth replatform; role-based auth is a later-stage concern.

## Current Audit Conclusions

### What is already strong
- The canonical player profile in `web/app/players/[slug]/page.tsx` is already the best cross-system surface in the product.
- Charting is already a real workflow product, not just a static report.
- Trackman has the strongest model/context explanation on the site.
- Mechanics is already useful for session review and issue tracking.
- The guides/dictionary are materially good and should be reused, not replaced.

### What is currently limiting value
- Cross-surface continuity is weak. `web/lib/selectedPlayer.tsx` is effectively disabled.
- Player workflows are split between `/players/[slug]` and legacy `/player/[playerId]/*`.
- Charting is both the most valuable operational workflow and the biggest fragility.
- NCAA freshness/provenance exists in the pipeline but not clearly enough in the UI.
- The largest product surfaces are also the largest code hotspots, which slows iteration.

## Priority Order

### 1. Harden Charting Workflow First

This is the default first build. Charting drives downstream value in player pages, leaderboards, and insights, so it should be treated as the operational foundation.

#### Goals
- make save/resume more durable
- reduce fragile continuity around lineup/baserunner state
- make interruption and recovery clearer
- make review status more explicit after games are charted
- make conflict handling less blunt than "reload latest and continue"

#### Primary Files
- `web/app/charting/_components/ChartingEditor.tsx`
- `web/lib/charting/live.ts`
- `web/app/charting/page.tsx`
- `web/app/charting/insights/LiveAbInsightsExplorer.tsx`

#### Acceptance Criteria
- a scorer can leave and resume without losing critical lineup/baserunner context
- the UI exposes clearer state around draft/in-progress/review-ready/completed
- write conflicts do not silently erase user intent
- charted games flow more cleanly into review/insights

### 2. Restore Selected-Player Continuity

The repo already has a selected-player pattern, but it is effectively turned off. This is a high-value, relatively contained fix.

#### Goals
- persist selected player state instead of clearing it
- make the active player follow the user across Players, Trackman, Command, Team Stats, and Charting Insights
- use this continuity to reduce redundant searching/filtering

#### Primary Files
- `web/lib/selectedPlayer.tsx`
- `web/app/players/PlayersHubView.tsx`
- `web/app/trackman/page.tsx`
- `web/app/command/page.tsx`
- `web/app/team-stats/leaderboard/page.tsx`
- `web/app/charting/insights/LiveAbInsightsExplorer.tsx`

#### Acceptance Criteria
- selecting a player in one core workflow affects the others predictably
- the selected-player state survives navigation and refresh
- there is a clear way to clear or change the selected player

### 3. Unify Player Workflows Around `/players/[slug]`

The product currently has two player systems: the canonical profile and the legacy command/report world. That split should be reduced.

#### Goals
- make `/players/[slug]` the clear operating center
- reduce reliance on `/player/[playerId]/*` as a separate mental model
- bring command/report actions closer to the canonical player context
- keep legacy routes only as compatibility layers until replacement is complete

#### Primary Files
- `web/app/players/[slug]/page.tsx`
- `web/app/players/[slug]/PlayerProfileTabs.tsx`
- `web/app/player/[playerId]/page.tsx`
- `web/app/player/[playerId]/compare/page.tsx`
- `web/app/player/[playerId]/report/page.tsx`
- `web/app/command/page.tsx`

#### Acceptance Criteria
- the canonical player profile is the main route a coach thinks of first
- command/report actions feel connected to the same player identity model
- legacy routes are reduced or clearly transitional

### 4. Add Inline Synthesis Inside Existing Surfaces

Do this without adding a new top-of-page story block. The point is to improve output and context where users already work.

#### Goals
- add "what stands out" interpretation to existing player/charting/mechanics views
- explain changes, deltas, and development implications inline
- improve comp interpretation and mechanics progression framing
- move the best guide knowledge into the active workflow

#### Good Targets
- `web/app/players/[slug]/LiveAbProfilePanel.tsx`
- `web/app/players/[slug]/HitterPerformanceInsights.tsx`
- `web/app/charting/insights/LiveAbInsightsExplorer.tsx`
- `web/app/trackman/player/[slug]/MLBCompsPanel.tsx`
- `web/app/mechanics/player/[slug]/MechanicsPlayerView.tsx`
- `web/app/mechanics/session/[playerSlug]/[sessionSlug]/MechanicsSessionView.tsx`
- `web/app/team-stats/leaderboard/page.tsx`
- `web/app/dictionary/page.tsx`

#### Acceptance Criteria
- users can see interpretation inside the section they are already reading
- comp views explain what matches and what does not
- mechanics views explain session-over-session progression
- charting insights generate clearer takeaways from the existing delta/baseline logic

### 5. Surface NCAA Freshness And Provenance

Trust should not depend on the user knowing how the nightly workflow works.

#### Goals
- show last sync time/source/degraded status in product
- flag stale or partial NCAA data more clearly
- expose provenance in team stats and any player surfaces backed by NCAA cache

#### Primary Files
- `web/app/api/team-stats/route.ts`
- `web/lib/collegeStats.ts`
- `web/app/team-stats/leaderboard/page.tsx`
- `web/app/players/[slug]/page.tsx`
- `.github/workflows/sync-college-stats-nightly.yml`

#### Acceptance Criteria
- users can tell when stats were last refreshed
- degraded or partial data states are visible in the UI
- NCAA-backed sections clearly communicate source/trust context

### 6. Harden Mechanics Identity Linkage

Mechanics is useful now, but identity linkage is still weaker than it should be.

#### Goals
- make `profile_slug` the standard for mechanics linkage
- reduce reliance on normalized-name fallback matching
- push mechanics summaries more reliably into player pages

#### Primary Files
- `web/lib/mechanics/registry.ts`
- `web/app/mechanics/page.tsx`
- `web/app/mechanics/MechanicsHubView.tsx`
- `web/app/mechanics/session/[playerSlug]/[sessionSlug]/MechanicsSessionView.tsx`
- `web/app/players/[slug]/PlayerProfileTabs.tsx`

#### Acceptance Criteria
- new mechanics sessions attach to canonical player identity more reliably
- fallback matching is legacy-only, not the primary strategy
- player pages can trust mechanics linkage more directly

## Refactor Track

Do not treat refactoring as separate from product work. Use each feature phase to carve down the worst hotspots.

### Highest-Priority Hotspots
- `web/app/charting/_components/ChartingEditor.tsx` — 2803 lines
- `web/app/charting/insights/LiveAbInsightsExplorer.tsx` — 2749 lines
- `web/lib/charting/live.ts` — 1514 lines
- `web/app/players/[slug]/PlayerProfileTabs.tsx` — 1149 lines
- `web/app/players/[slug]/page.tsx` — 1024 lines
- `web/app/command/page.tsx` — 807 lines
- `web/app/team-stats/leaderboard/page.tsx` — 712 lines

### Decomposition Guidance
- extract domain utilities before extracting UI
- move state machines and derivation logic out of large components first
- extract sub-panels/hooks only after domain boundaries are clearer
- avoid broad "rewrite everything" refactors
- refactor in service of the priority phases above

## Suggested Execution Sequence

1. Charting resilience and review-state hardening
2. Selected-player persistence
3. Player-workflow unification around `/players/[slug]`
4. Inline synthesis inside existing surfaces
5. NCAA freshness/provenance UI
6. Mechanics identity-link hardening

## Validation Expectations

For each phase:
- run focused tests where coverage exists
- run `npm --prefix web run build`
- do browser UAT on the touched workflow
- verify auth-gated routes still behave correctly
- avoid regressing existing player/charting/mechanics flows

## Key Files To Read First

```text
web/lib/selectedPlayer.tsx
web/app/HomeContent.tsx
web/app/components/Header.tsx
web/app/players/[slug]/page.tsx
web/app/players/[slug]/PlayerProfileTabs.tsx
web/app/charting/page.tsx
web/app/charting/_components/ChartingEditor.tsx
web/app/charting/insights/LiveAbInsightsExplorer.tsx
web/lib/charting/live.ts
web/app/command/page.tsx
web/app/player/[playerId]/page.tsx
web/app/team-stats/leaderboard/page.tsx
web/app/api/team-stats/route.ts
web/lib/collegeStats.ts
web/lib/mechanics/registry.ts
```

## Default Instruction To Future Claude

Start with Priority 1 unless the user explicitly redirects you.

If you are asked to improve "output, content, and context," prefer:
- inline interpretation
- continuity across workflows
- provenance/trust signals
- reductions in fragmentation

Do **not** interpret this doc as permission to add a new top player-summary hero block.
