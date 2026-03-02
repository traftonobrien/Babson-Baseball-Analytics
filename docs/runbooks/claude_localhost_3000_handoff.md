# Claude Handoff: Command+ / Stuff+ Local Changes

This document captures the local-only frontend changes that were made in this workspace so they can be replicated into the `localhost:3000` session later.

Nothing in this handoff has been pushed to GitHub.

## Goal

The work in this session focused on two things:

1. Make `Command+` a clean, live season-relative grading layer built on the existing command measurement data.
2. Tighten the UI so `Command+` is more understandable and visually aligned with `Stuff+`.

This did **not** change the manual command measurement workflow (target click, arrival click, miss-distance generation).

## Core Behavior Changes

### 1. Command+ is now a shared, live season-relative metric

`Command+` is now computed from one shared engine instead of being rederived inconsistently in multiple UI surfaces.

Definition:

- Per-pitch-type `Command+ = season baseline avg miss / subject avg miss * 100`
- Overall `Command+ = exact pitch-count-weighted average of qualifying pitch-type scores`
- `100` = current team average for that season
- Higher is better

It is **live season-relative**, which means:

- current-season baselines are rebuilt from the currently loaded season dataset
- values will move as new outings are added
- the same repo state produces the same score

### 2. Command+ excludes bad pitch labels correctly

Official `Command+` excludes pitch rows whose original raw pitch type is:

- blank
- unknown / `UNK` / `UNKNOWN`
- `OTHER`

This is enforced by preserving `raw_pitch_type` from the original CSV before pitch-type normalization runs.

### 3. No more fake fallback average for Command+

The old hardcoded fallback baseline (`15.0`) was removed from the grading path.

If a pitch type has no valid season baseline, that pitch type is ineligible instead of being assigned an invented average.

### 4. Low-sample outings still show context

If a pitcher or outing does not yet qualify for an official overall `Command+` score:

- the `Command+` card still renders
- the score shows `--`
- the live team baseline context still shows
- the card explains that a pitch type needs at least 3 tracked pitches to qualify

This prevents the entire `Command+` card from disappearing on low-sample outings.

### 5. Team benchmark context is back

The old static MLB miss-distance context bar was replaced with a live team benchmark context block:

- `Your Avg`
- `Team Benchmark`
- live current-season team miss by pitch type

`Team Benchmark` means the team-average miss for the **same pitch mix visible on the page**.

This updates dynamically as new outings enter the season.

## UI / UX Changes

### 1. Leaderboards now default to Command+

The command leaderboard now opens sorted by:

- `Command+` descending

instead of `On-target %`.

### 2. Command+ moved next to On-target %

On the command leaderboard, the column order was updated so `Command+` appears immediately to the right of `On-target %`.

This was also mirrored in CSV export order.

### 3. Outing leaderboard rows go to the actual outing page

Clicking an outing on the command leaderboard now routes to:

- `/player/[playerId]?outingId=...&from=leaderboards`

instead of the report route.

The whole outing row is clickable and keyboard-accessible.

### 4. Badge styling was upgraded

The leaderboard KPI badges were redesigned to be more visually prominent:

- slightly larger / more legible
- stronger rounded shape
- richer fill
- stronger contrast
- glow / highlight for more pop

### 5. Command+ and Stuff+ now share the same plus-metric visual language

A shared plus-metric badge style now powers both `Command+` and `Stuff+`.

The shared behavior:

- same 100-centered band logic
- same glowing badge treatment
- same polished gradient / highlight structure

### 6. Plus-metric colors now flow *within* each band

The plus-metric badge colors are no longer flat per range.

They now keep the same four bands, but shade dynamically within each one:

- blue band: darker-to-lighter within low scores
- zinc band: lighter-to-darker within neutral scores
- orange band: lighter-to-deeper within the 100s
- rose band: lighter-to-deeper within 110+

That means values in the same bucket still share the same color family, but not the exact same shade.

## Files Added

### Command+ logic

- `web/lib/commandPlus.ts`
  - shared `Command+` scoring engine
  - builds baselines
  - computes exact weighted scores
  - handles qualification and ineligibility

- `web/lib/pitchCsv.ts`
  - shared CSV parser
  - preserves `raw_pitch_type`

### New UI

- `web/app/components/TeamAveragesBar.tsx`
  - live team benchmark context block used inside the `Command+` card

### New docs

- `docs/runbooks/command_plus.md`
  - user-facing explanation of the current `Command+` definition

- `docs/runbooks/claude_localhost_3000_handoff.md`
  - this handoff document

### New tests

- `web/lib/commandPlus.test.ts`
- `web/lib/pitchCsv.test.ts`
- `web/lib/stuffPlusUtils.test.ts`

## Files Modified

### Command+ data flow / parsing

- `web/app/types.ts`
  - added `raw_pitch_type`

- `web/app/hooks/usePitchData.ts`
  - now uses the shared pitch CSV parser

- `web/app/hooks/useAllPitchData.ts`
  - now uses the shared pitch CSV parser

- `web/lib/leaderboards/load.ts`
  - now uses shared CSV parser
  - builds live season baselines for `Command+`
  - computes exact aggregated player `Command+`

- `web/lib/leaderboards/metrics.ts`
  - routes `Command+` through the shared engine
  - removes fake fallback logic

- `web/lib/leaderboards/types.ts`
  - `commandPlus` fields now support `null` where appropriate

- `web/lib/leaderboards/metrics.test.ts`
  - updated to match the current shared scoring behavior

### Command+ UI

- `web/app/components/CommandPlusSection.tsx`
  - now renders from shared `Command+` engine
  - shows `TeamAveragesBar`
  - keeps rendering when overall score is not qualified
  - uses the shared plus-metric badge styling

- `web/app/player/[playerId]/PlayerDashboard.tsx`
  - removed the old commented MLB averages hook point
  - uses the upgraded `Command+` card flow

- `web/app/player/[playerId]/report/page.tsx`
  - uses shared `Command+` computation instead of local duplicated logic

- `web/app/leaderboards/faq/LeaderboardsFaqView.tsx`
  - updated copy to match the actual `Command+` logic

- `web/app/leaderboards/page.tsx`
  - default sort is now `Command+`
  - `Command+` column moved beside `On-target %`
  - outing rows route to the outing dashboard
  - whole outing rows are clickable
  - badges were restyled
  - `Command+` now uses shared plus-metric badge styling

### Stuff+ shared styling

- `web/lib/stuffPlusUtils.ts`
  - now owns the shared plus-metric badge style
  - includes:
    - `stuffPlusBadgeTone(...)`
    - `plusMetricBadgeStyle(...)`

- `web/app/trackman/leaderboards/page.tsx`
  - Stuff+ leaderboard badges now use `plusMetricBadgeStyle(...)`

- `web/app/trackman/player/[slug]/StuffPlusHeroCard.tsx`
  - total hero and per-pitch chips now use `plusMetricBadgeStyle(...)`

- `web/app/trackman/player/[slug]/StuffPlusSummaryCard.tsx`
  - hero total badge now uses `plusMetricBadgeStyle(...)`

- `web/app/trackman/player/[slug]/StuffPlusSavantCard.tsx`
  - hero total badge now uses `plusMetricBadgeStyle(...)`

- `web/app/trackman/session/[playerId]/[date]/PitchTypeTable.tsx`
  - Stuff+ cells now use `plusMetricBadgeStyle(...)`

### Removed

- `web/app/components/MLBAveragesBar.tsx`
  - removed in favor of live team benchmark context

## Validation Already Run

The following commands were run successfully in this workspace:

```bash
npm --prefix web run test -- \
  lib/stuffPlusUtils.test.ts \
  lib/pitchCsv.test.ts \
  lib/commandPlus.test.ts \
  lib/leaderboards/metrics.test.ts \
  lib/reportModel.test.ts
```

```bash
npm --prefix web run build
```

## Local Runtime Note

The updated app was repeatedly validated on:

- `http://localhost:3001`

Port `3000` was already occupied during this session, so the production build was run on `3001` instead.

## How Claude Can Bring This Into The localhost:3000 Session

If the `localhost:3000` session is a separate local process and just needs the same code applied:

1. Make sure that session is using this same workspace / branch state.
2. Rebuild the web app:

```bash
npm --prefix web run build
```

3. Restart the web app on port 3000:

```bash
npm --prefix web run start -- --port 3000
```

4. Sanity-check these pages:

- `/leaderboards`
- `/player/JClark1?outingId=JClark1/2026_02_27&from=command`
- `/trackman/leaderboards`
- a Trackman player page with Stuff+ cards

## Recommended Smoke Checks For Claude

### Command leaderboard

Confirm:

- default sort shows `Command+▼`
- `Command+` is immediately right of `On-target %`
- clicking an outing row goes to the outing dashboard, not the report page
- `Command+` badges use flowing within-band gradients

### Player outing page

Confirm:

- `Command+` card is visible
- `Team Benchmark` is visible
- low-sample outings still show the card with `--` instead of disappearing

### Trackman

Confirm:

- Stuff+ hero cards use the same glowing plus-metric badge style
- Stuff+ table badges use the same shared style

## Important Constraints To Preserve

These should not be changed accidentally when carrying the work over:

- Do **not** change the underlying command measurement pipeline
- Keep `Command+` live season-relative
- Keep `OTHER` / blank / unknown pitch types excluded from official `Command+`
- Keep `Command+` exact pitch-count-weighted
- Keep `Team Benchmark` tied to the visible pitch mix
- Keep the shared plus-metric badge system centralized in `web/lib/stuffPlusUtils.ts`

## Status

This work is local only.

- Not pushed
- Not committed in this handoff
- Ready for review and eventual push later
