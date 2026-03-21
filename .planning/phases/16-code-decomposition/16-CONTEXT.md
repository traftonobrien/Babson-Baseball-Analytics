# Phase 16: Code Decomposition - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 16 breaks the current mega-files into focused modules so the codebase is safely navigable and no single file in `web/` exceeds 1000 lines.

This phase covers:
- decomposing `web/app/charting/_components/ChartingEditor.tsx`,
- decomposing `web/app/charting/insights/LiveAbInsightsExplorer.tsx`,
- auditing the rest of `web/` for any files still over the 1000-line ceiling and splitting them as needed.

This phase does not reopen product scope, redesign the charting/editor UX, or opportunistically rewrite adjacent features. The work is structural first.

</domain>

<decisions>
## Implementation Decisions

### Refactor posture
- Use a strict behavior freeze during decomposition.
- Treat the phase as structural extraction only; do not intentionally change UX or workflow behavior.
- Only make behavior changes when required to preserve the existing experience or keep the extracted code working correctly.

### File organization strategy
- Favor feature colocation over aggressive centralization.
- Keep extracted hooks, utilities, and subcomponents near the surface they belong to instead of turning this phase into a broad shared-library rewrite.
- Avoid using Phase 16 to maximize cross-surface reuse between unrelated feature areas.

### Plan slicing
- Slice execution one major file per plan, then finish with a final ceiling/verification pass.
- Plan 16-01 should center on `ChartingEditor.tsx`.
- Plan 16-02 should center on `LiveAbInsightsExplorer.tsx`.
- Plan 16-03 should audit remaining `web/` ceiling offenders and close verification gaps.

### ChartingEditor split shape
- Decompose `ChartingEditor.tsx` primarily by workflow panels rather than by abstract technical layers first.
- Preserve the existing scorer flow by extracting visible sections around the current experience: top header/top bar, zone workspace, action dock, pitch history, lineup flow, and supporting UI pieces.
- Supporting hooks and helpers may be extracted where needed, but the primary seam should follow the existing operator workflow.

### LiveAbInsightsExplorer split shape
- Decompose `LiveAbInsightsExplorer.tsx` primarily into route-local panels.
- Keep search, filters, zone canvas, summary table, takeaways, and supporting controls local to the `charting/insights` route instead of using this phase to build a wider shared comparison component system.
- Preserve the current route-local query-param behavior and view switching contract.

### Verification threshold
- Use focused verification, not build-only and not an open-ended regression expansion.
- Require targeted tests for the touched charting/profile areas, plus build success and explicit file-size checks.
- The decomposition is only complete when the line-count ceilings are satisfied and the touched surfaces still verify cleanly.

### Claude's Discretion
- Exact file names and folder names inside the chosen feature-local structure.
- Whether small pure helpers live in sibling `utils.ts`, `types.ts`, or dedicated hook/component files, as long as they stay close to the owning feature.
- Which targeted tests are most appropriate for each decomposition pass, as long as verification stays focused and behavior-preserving.

</decisions>

<specifics>
## Specific Ideas

- Preserve the previously locked charting layout baseline: top zone canvas remains primary, bottom/operator controls remain compact, and decomposition should not reshuffle the scoring workflow.
- Preserve the current `LiveAbInsightsExplorer` filter/query UX, including URL-backed state and back/forward behavior.
- The roadmap text naming `web/app/players/[slug]/LiveAbInsightsExplorer.tsx` is stale; the live mega-file is `web/app/charting/insights/LiveAbInsightsExplorer.tsx`.
- This phase is not the place for opportunistic Live AB/profile redesign, shared comparison-platform extraction, or UI polish. Those belong in later phases if needed.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/app/components/leaderboards/LeaderboardChrome.tsx`: established hero/panel/toolbar chrome already used by `LiveAbInsightsExplorer` and should remain the outer UI shell.
- `web/app/charting/insights/explorerState.ts`: existing route-local query parsing/building helper; already a good decomposition seam to preserve.
- `web/lib/charting/playerComparison.ts` and `web/lib/charting/pitcherComparison.ts`: summary/filter/pitch-mix logic already lives outside the explorer and should not be pulled back into UI modules.
- `web/app/charting/_components/ChartingZoneHeatmap.tsx` and `web/app/players/[slug]/PitcherZoneHeatmap.tsx`: examples of charting UI already split into focused visualization components.

### Established Patterns
- Feature-local UI modules already exist under route/component directories such as `web/app/charting/_components/` and `web/app/charting/insights/`.
- Prior phases locked a behavior-preserving charting layout baseline and a preserve-the-existing-profile-chrome bias; decomposition should respect those prior choices.
- `LiveAbInsightsExplorer` already separates some state/query logic from rendering through `explorerState.ts`, which supports further route-local extraction instead of a broad shared rewrite.

### Integration Points
- `web/app/charting/insights/page.tsx` is the server entry point for the explorer and should remain a thin loader around the decomposed client surface.
- `ChartingEditor.tsx` currently mixes state management, optimistic save flow, workflow UI, and many inline helper/presentational components; the natural extraction seams are the visible editor sections plus their directly supporting hooks/helpers.
- `LiveAbInsightsExplorer.tsx` already contains route-local subcomponent candidates such as `SearchResultCard`, `VelocityRangeControl`, `PitchMixPanel`, `ZoneCanvas`, `SummaryTable`, and the inline takeaway helpers.
- The 1000-line audit must also account for additional current offenders beyond the two named roadmap files:
  - `web/lib/charting/live.ts` (1514)
  - `web/app/players/[slug]/PlayerProfileTabs.tsx` (1167)
  - `web/app/players/[slug]/page.tsx` (1040)

</code_context>

<deferred>
## Deferred Ideas

- Broader shared comparison UI reusable across `/charting/insights` and player-profile Live AB surfaces.
- Opportunistic UX polish or workflow changes inside the charting editor.
- Larger refactors to `web/lib/charting/live.ts`, `web/app/players/[slug]/PlayerProfileTabs.tsx`, or `web/app/players/[slug]/page.tsx` beyond what is strictly required to satisfy the Phase 16 ceiling and decomposition goals.

</deferred>

---

*Phase: 16-code-decomposition*
*Context gathered: 2026-03-21*
