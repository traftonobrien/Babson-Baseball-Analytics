---
phase: 16-code-decomposition
plan: 01
subsystem: charting-editor
tags: [refactor, decomposition, charting, ui]

# Dependency graph
requires:
  - phase: 16-code-decomposition
    provides: "Phase 16 planning/validation contract and the existing charting editor baseline"
provides:
  - "ChartingEditor.tsx reduced below the 1000-line ceiling"
  - "Feature-local charting-editor composition modules, each under 500 lines"
  - "Behavior-preserving charting editor decomposition with focused validation"
affects:
  - 16-02 (same decomposition pattern applies to LiveAbInsightsExplorer)
  - 16-03 (remaining >1000-line audit now starts from a reduced charting surface)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Feature-local composition folder under web/app/charting/_components/charting-editor"
    - "Thin root editor container with extracted workspace/footer/modal components"

key-files:
  created:
    - web/app/charting/_components/charting-editor/bottom-bar.tsx
    - web/app/charting/_components/charting-editor/history-edit-modal.tsx
    - web/app/charting/_components/charting-editor/in-play-modal.tsx
    - web/app/charting/_components/charting-editor/lineup-editor-modal.tsx
    - web/app/charting/_components/charting-editor/workspace.tsx
  modified:
    - web/app/charting/_components/ChartingEditor.tsx
    - web/app/charting/_components/charting-editor/constants.ts
    - web/app/charting/_components/charting-editor/drafts.ts
    - web/app/charting/_components/charting-editor/history.ts
    - web/app/charting/_components/charting-editor/matchup.ts
    - web/app/charting/_components/charting-editor/pitch-utils.ts
    - web/app/charting/_components/charting-editor/top-bar.tsx
    - web/app/charting/_components/charting-editor/top-header.tsx
    - web/app/charting/_components/charting-editor/types.ts
    - web/app/charting/_components/charting-editor/ui.tsx

key-decisions:
  - "Kept optimistic save / conflict reload orchestration in ChartingEditor.tsx and only extracted composition seams for this pass"
  - "Preserved the charting API contract and live-state helpers in web/lib/charting/live.ts"
  - "Used feature-local modules instead of shared cross-app abstractions to keep the decomposition scoped"

requirements-completed:
  - CODE-01

# Metrics
completed: 2026-03-21
root_file_lines: 941
---

# Phase 16 Plan 01: ChartingEditor Decomposition Summary

**Reduced `ChartingEditor.tsx` from 2913 lines to 941 lines by extracting workflow composition modules under `web/app/charting/_components/charting-editor/` while preserving the live charting flow.**

## Verification

- `wc -l web/app/charting/_components/ChartingEditor.tsx` -> `941`
- All files under `web/app/charting/_components/charting-editor/` are under `500` lines
- `npm --prefix web test -- --run lib/charting/live.test.ts lib/charting/charting.test.ts lib/charting/setup.test.ts`
- `npm --prefix web run build` exits `0`

## Accomplishments

- Rebuilt `ChartingEditor.tsx` as a thin orchestration/composition shell
- Wired the already-extracted top header/top bar/helpers into the root editor
- Added new feature-local components for the workspace, bottom action bar, lineup modal, history edit modal, and in-play modal
- Removed the duplicate inline helper/component block that the stuck worker left in the root file

## Issues Encountered

- The first delegated `16-01` worker extracted files but never rewired the root editor, so the root file stayed at 2913 lines and `tasks/todo.md` was polluted with stray plan bullets
- A stale `next build` lock briefly blocked verification; waiting for the older build process to exit resolved it without deleting build artifacts
- `next build` still reports the pre-existing `lib/auth.ts` Edge Runtime warning and the middleware/proxy deprecation warning, but the build exits `0`

## User Setup Required

None for `16-01`.

## Next Phase Readiness

- `16-01` is complete and validated locally
- Phase 16 should continue with `16-02` (`LiveAbInsightsExplorer.tsx` decomposition)

---
*Phase: 16-code-decomposition*
*Completed: 2026-03-21*
