---
phase: 16-code-decomposition
plan: 02
subsystem: charting-insights
tags: [refactor, decomposition, charting, insights, ui]

# Dependency graph
requires:
  - phase: 16-code-decomposition
    provides: "Phase 16 planning/validation contract and the current charting insights baseline"
  - phase: 16-code-decomposition
    plan: 01
    provides: "Reference decomposition pattern for thin root + feature-local modules"
provides:
  - "LiveAbInsightsExplorer.tsx reduced below the 1000-line ceiling"
  - "Route-local insights explorer modules, each under 500 lines"
  - "Behavior-preserving explorer decomposition with focused validation"
affects:
  - 16-03 (remaining >1000-line audit now starts from a reduced charting insights surface)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route-local composition folder under web/app/charting/insights/_components"
    - "Route-local helper folder under web/app/charting/insights/_lib"
    - "Thin client explorer root with extracted controls, zone canvas, table, empty state, and takeaways panel"

key-files:
  created:
    - web/app/charting/insights/_components/controls.tsx
    - web/app/charting/insights/_components/empty-state.tsx
    - web/app/charting/insights/_components/summary-table.tsx
    - web/app/charting/insights/_components/takeaways-panel.tsx
    - web/app/charting/insights/_components/zone-canvas.tsx
    - web/app/charting/insights/_components/zone-section-region.tsx
    - web/app/charting/insights/_lib/helpers.ts
    - web/app/charting/insights/_lib/takeaways.ts
    - web/app/charting/insights/_lib/types.ts
    - web/app/charting/insights/_lib/zone-display.tsx
  modified:
    - web/app/charting/insights/LiveAbInsightsExplorer.tsx

key-decisions:
  - "Kept the explorer decomposition fully route-local instead of creating a shared comparison-platform abstraction"
  - "Preserved the existing URL/query contract in explorerState.ts and left page.tsx as the server loader boundary"
  - "Split the zone canvas into a main module plus ZoneSectionRegion to satisfy the hard per-file ceiling without changing selection behavior"

requirements-completed:
  - CODE-02

# Metrics
completed: 2026-03-21
root_file_lines: 993
---

# Phase 16 Plan 02: LiveAbInsightsExplorer Decomposition Summary

**Reduced `LiveAbInsightsExplorer.tsx` from 2863 lines to 993 lines by extracting route-local controls, zone-display logic, empty state, summary table, and takeaways helpers under `web/app/charting/insights/` while preserving the current explorer behavior.**

## Verification

- `test $(wc -l < web/app/charting/insights/LiveAbInsightsExplorer.tsx) -lt 1000` -> pass (`993`)
- All files under `web/app/charting/insights/_components` and `web/app/charting/insights/_lib` are under `500` lines
- `npm --prefix web test -- --run lib/charting/explorerState.test.ts lib/charting/playerComparison.test.ts lib/charting/pitcherComparison.test.ts`
- `npm --prefix web run build` exits `0`

## Accomplishments

- Rebuilt `LiveAbInsightsExplorer.tsx` as a thin route-local client composition file
- Extracted search/filter controls, the zone canvas, the summary table, empty state, and takeaways display into route-local `_components`
- Extracted route-local helper modules for explorer types, formatting/query helpers, zone-display constants, and takeaways
- Preserved the current search, filter, URL-backed state, popstate restore, view-switching, zone/cell/row/column selection, pitch mix, summary table, and takeaway behavior

## Issues Encountered

- The repo already had a partially started `_lib` extraction, so the first step was reconciling that work instead of starting from a clean file
- The first decomposition pass still left `LiveAbInsightsExplorer.tsx` at `1010` lines and `zone-canvas.tsx` above the 500-line ceiling; a second pass split out `TakeawaysPanel` and `ZoneSectionRegion`
- `next build` still reports the pre-existing `lib/auth.ts` Edge Runtime warning and middleware/proxy deprecation warning, but the build exits `0`

## User Setup Required

None for `16-02`.

## Next Phase Readiness

- `16-02` is complete and validated locally
- Stop before `16-03` as requested
- Exact next step is `16-03`: audit remaining `web/` files over 1000 lines and decompose any still above the ceiling

---
*Phase: 16-code-decomposition*
*Completed: 2026-03-21*
