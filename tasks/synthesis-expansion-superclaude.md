# Synthesis Expansion + Charting UAT — SuperClaude Execution Doc
_Created 2026-03-19. Use this as the focused next-phase handoff after `1cb01da`._

## Objective

The first inline synthesis pass is shipped. The next phase is to expand interpretation into the two richest remaining read surfaces, close the open charting UAT loop, and then decompose the largest charting files so future iteration gets easier instead of harder.

This phase should improve:
- coach-readable output
- interpretation/context quality
- charting workflow confidence
- future implementation speed

## Current Shipped Baseline

Already live on `main`:
- charting resilience and draft preservation
- selected-player continuity
- NCAA freshness/provenance on team stats
- pitcher-side inline synthesis in `LiveAbProfilePanel.tsx`
- NCAA provenance on player profiles
- legacy report/compare bridge to canonical profiles

Do not re-solve those again.

## Required SuperClaude Workflow

Use the existing repo workflow in `CLAUDE.md` and `memory.sh`.

### Session start
1. Run `/sc:load`
2. Read `.claude-memory.md`
3. Read `tasks/lessons.md`
4. Read this doc

### Planning
- Run `/sc:workflow synthesis expansion — insights, comps, hitter pass`
- Write the resulting execution breakdown into `tasks/todo.md` if SuperClaude expects it

### Analysis before touching large files
- Run `/sc:analyze web/app/charting/insights/LiveAbInsightsExplorer.tsx`
- Run `/sc:analyze web/app/trackman/player/[slug]/MLBCompsPanel.tsx`
- Run `/sc:analyze web/app/players/[slug]/LiveAbProfilePanel.tsx`

### Implementation orchestration
- Use `/sc:pm synthesis expansion` for the full multi-file task
- Use subagents for parallel independent analysis/execution after the plan is stable

Recommended subagent split:
- Agent 1: `LiveAbInsightsExplorer.tsx` takeaways and insertion points
- Agent 2: `MLBCompsPanel.tsx` interpretation logic and local helper structure
- Agent 3: `LiveAbProfilePanel.tsx` hitter-side synthesis mirroring the shipped pitcher-side pattern

### Verification
- Run `/sc:test` after implementation
- Run `/sc:reflect` before marking complete

## Hard Constraints

- Do **not** add new sections or new headers for synthesis blocks
- Do **not** add a top-of-page story card/hero block
- Do **not** use population-benchmark language such as “elite” / “above average”
- Do **not** render synthesis text when no signal clears
- Tie all synthesis to the currently visible filtered data
- Keep changes additive and low-risk
- Do not broad-refactor before the synthesis pass is functional

## Priority Order

1. `LiveAbInsightsExplorer.tsx`
2. `MLBCompsPanel.tsx`
3. hitter-side `LiveAbProfilePanel.tsx`
4. manual browser UAT for `origin/codex/game-charting-structure`
5. file decomposition/refactor

## Feature 1 — Inline Synthesis Expansion In `LiveAbInsightsExplorer.tsx`

### Why this is highest value

This module already computes the richest filtered charting story in the product:
- current player
- current filter set
- current zone slice
- filtered summary stats
- filtered pitch mix
- zone bucket summaries

It already has the data. It mostly lacks interpretation.

### File

- `web/app/charting/insights/LiveAbInsightsExplorer.tsx`

### Data already available in the file

For the selected player and current filters:
- `filteredSummary`
- `selectionSummary`
- `selectionPitchMix`
- `zoneBuckets`
- `activeFilterChips`
- current pitcher/hitter view
- selected cell/row/col/bucket context

For pitcher view, current UI already exposes:
- pitch count
- TBF
- Strike%
- Whiff%
- BAA
- K%
- filtered pitch mix

For hitter view, current UI already exposes:
- pitch count
- PA
- Swing%
- Whiff%
- AVG
- wOBA
- filtered pitch mix

### Implementation goal

Add 2-4 “what stands out” takeaways tied to the current filtered/selected data.

### Safe insertion point

In the right-hand column of the selected-player panel:
- after the mini-stat grid
- before `PitchMixPanel`

That placement is strong because it keeps the takeaways attached to the same currently visible sample without introducing a new section heading.

### Recommended implementation shape

- Add a small pure helper layer for synthesis logic
- Prefer local helpers first
- If the logic gets large, extract to a utility under `web/lib/charting/`

Suggested split:
- `derivePitcherExplorerTakeaways(summary, pitchMix, selectionLabel): string[]`
- `deriveHitterExplorerTakeaways(summary, pitchMix, selectionLabel): string[]`

### Example signal categories

Pitcher view:
- swing-and-miss emphasis from Whiff%
- strike-throwing/attack zone emphasis from Strike%
- finish-rate language from K%
- contact-management language from BAA
- mix-shape language from `selectionPitchMix`

Hitter view:
- swing decisions from Swing%
- miss/whiff pressure from Whiff%
- results quality from AVG / wOBA
- mix exposure language from `selectionPitchMix`

### Guardrails

- Only use the filtered selection summary, not global entry-level stats
- Keep each takeaway descriptive and sample-aware
- Max 4 lines
- If the user has drilled into a cell/row/col/bucket, let the language reflect that scope

### Acceptance criteria

- Takeaways update when filters change
- Takeaways update when zone selection changes
- Pitcher and hitter views use different logic
- No output appears for weak/no-signal samples

## Feature 2 — Comp Interpretation In `MLBCompsPanel.tsx`

### Why this is high value

The panel already gives useful comps, but a coach still has to infer what actually matches. This is a classic interpretation gap: the data is already there.

### File

- `web/app/trackman/player/[slug]/MLBCompsPanel.tsx`

### Data already available

Per-pitch mode:
- Babson pitch input: `pitchType`, `ivb`, `hb`, `velo`
- comp result: `distance`, `deltas.ivb`, `deltas.hb`
- comp pitch metadata: `avgIvb`, `avgHb`, `avgVelo`, `pitchTypeName`, `pitchTypeCode`

Arsenal mode:
- `avgDistance`
- `matchedPitches`
- `pitchBreakdown`

### Implementation goal

Add a short interpretation block that explains what aligns and what diverges.

### Safe insertion points

Per-pitch mode:
- below the “Your {pitch}” context row
- above the comp list

Arsenal mode:
- below the intro line
- above the arsenal comp list

### Recommended helper structure

- `describePerPitchComp(input, topComp): string[]`
- `describeArsenalComp(inputArsenal, topComp): string[]`

### Suggested interpretation categories

Per-pitch:
- closest shape match
- more / less ride from IVB delta
- more / less arm-side or glove-side movement from HB delta
- firmer / softer from local velo delta computed as `input.velo - comp.pitch.avgVelo`

Arsenal:
- how many pitch types meaningfully matched
- whether the comp is tight or loose from `avgDistance`
- which pitch families are closest / farthest from `pitchBreakdown`

### Guardrails

- Keep interpretation descriptive, not evaluative
- Use the top comp only for the first pass unless the UI strongly benefits from more
- Do not add a new section header
- Do not turn this into a full scouting report

### Acceptance criteria

- Each view has a compact interpretation block when there is enough signal
- No interpretation renders for missing/weak comp data
- Velocity delta is computed locally rather than pretending `deltas.velo` exists

## Feature 3 — Hitter-Side Synthesis In `LiveAbProfilePanel.tsx`

### Why this is the right follow-on

The pitcher-side pass is already shipped in this file. Hitter-side synthesis should mirror its structure so the component stays consistent.

### File

- `web/app/players/[slug]/LiveAbProfilePanel.tsx`

### Current shipped state

- `derivePitchingSynthesis(stats)` exists
- takeaways render below the pitcher Pitch Mix panel
- there is no hitter-side synthesis yet

### Data already available in the hitter section

- `OPS`
- `contactPct`
- `chasePct`
- `zoneSwingPct`
- `K%`
- `BB%`
- session count / PA count

### Implementation goal

Add 0-3 hitter-side takeaways inside the existing hitter section.

### Safe insertion point

- after the second hitter stat grid
- before the hitter session list

### Recommended helper structure

- add `deriveHittingSynthesis(hitter.stats): string[]`
- keep the pattern parallel to `derivePitchingSynthesis`

### Suggested signal categories

- zone-discipline language from `chasePct`
- contact reliability from `contactPct`
- outcome pressure from `K%`
- patience / free-pass language from `BB%`
- optional overall production language from `OPS`

### Guardrails

- descriptive language only
- if stats are null or weak, render nothing
- keep the hitter pass separate from the pitcher helper

### Acceptance criteria

- hitter-side synthesis mirrors the pitcher-side UX pattern
- no new section header is introduced
- no synthesis renders on insufficient data

## Feature 4 — Charting Branch UAT + Merge

### Branch

- `origin/codex/game-charting-structure` @ `8ddd3c8`

### Why it matters

This branch has been build/test-clean for over a week. The only thing blocking merge is manual browser UAT.

### UAT checklist

- create new game
- record pitches through an inning
- close a plate appearance
- use lineup editor
- use baserunner entry
- edit history
- test export / PDF if present

### If it passes

- merge to `main`

### If it fails

- record the exact failing step
- fix the minimal issue
- rerun the failing path before merge

## Feature 5 — Decompose The Large Files

Do this after the synthesis pass is functional, not before.

### Highest-value targets

- `web/app/charting/_components/ChartingEditor.tsx`
- `web/app/charting/insights/LiveAbInsightsExplorer.tsx`

### SuperClaude workflow for this phase

- `/sc:analyze web/app/charting/_components/ChartingEditor.tsx`
- `/sc:analyze web/app/charting/insights/LiveAbInsightsExplorer.tsx`
- `/sc:design charting insights/util split`
- `/sc:pm charting decomposition`

### Refactor guidance

- extract pure derivation utilities before extracting UI
- move synthesis helpers out first if they start growing
- avoid “rewrite the whole file” refactors

## Validation Expectations

For the synthesis features:
- run focused tests if you extract pure helpers
- run `npm --prefix web run build`
- do browser checks on:
  - player profile charting panel
  - charting insights explorer
  - Trackman player page comps panel

For the branch UAT:
- manual browser verification is required

## Suggested Claude Prompt

Use SuperClaude workflow for this task.

1. `/sc:load`
2. `/sc:workflow synthesis expansion — insights, comps, hitter pass`
3. `/sc:analyze web/app/charting/insights/LiveAbInsightsExplorer.tsx`
4. `/sc:analyze web/app/trackman/player/[slug]/MLBCompsPanel.tsx`
5. `/sc:analyze web/app/players/[slug]/LiveAbProfilePanel.tsx`
6. `/sc:pm synthesis expansion`

Then implement in this order:
- `LiveAbInsightsExplorer.tsx` takeaways tied to current filtered/selected data
- `MLBCompsPanel.tsx` interpretation blocks in per-pitch and arsenal modes
- hitter-side synthesis in `LiveAbProfilePanel.tsx`
- manual UAT for `origin/codex/game-charting-structure`

Do not add new sections or headers. Do not use population benchmark language. Render nothing when no signal clears.
