---
phase: 15-ops-foundations
plan: 02
subsystem: ui
tags: [react, nextjs, error-boundaries, app-router]

# Dependency graph
requires:
  - phase: 15-ops-foundations
    provides: middleware.ts running as Next.js auth gate (15-01)
provides:
  - Six Next.js App Router error boundaries covering all major page surfaces
  - Segment-level recovery: header/nav stays intact when inner component throws
  - Root layout boundary (global-error.tsx) for catastrophic failures
affects:
  - 15-03 (human checkpoint will verify error boundary behavior in production)
  - 16-code-health (error.tsx established before component decomposition)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js error.tsx convention: 'use client' + props: { error: Error & { digest?: string }; reset: () => void }"
    - "Segment error.tsx re-exports app/error.tsx default — single UI definition, scoped recovery per route group"
    - "global-error.tsx includes own html/body wrapper (required by Next.js when root layout itself crashes)"

key-files:
  created:
    - web/app/error.tsx
    - web/app/global-error.tsx
    - web/app/charting/error.tsx
    - web/app/mechanics/error.tsx
    - web/app/command/error.tsx
    - web/app/players/error.tsx
  modified: []

key-decisions:
  - "Segment error.tsx files re-export from app/error.tsx rather than duplicate — one UI definition, consistent retry experience"
  - "global-error.tsx includes own html/body (zinc-950 dark) — required when root layout crashes and layout.tsx is unavailable"
  - "Error card shows error.message when available plus error.digest for traceability — no sensitive stack traces exposed"

patterns-established:
  - "Error boundary pattern: 'use client' + ErrorBoundaryProps interface + retry button"
  - "Segment re-export: one-liner 'export { default } from @/app/error' keeps segments DRY"

requirements-completed:
  - OPS-02

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 15 Plan 02: Error Boundaries Summary

**Six Next.js App Router error boundaries added — segment-level recovery UI with retry button across charting, mechanics, command, and players routes**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T19:22:02Z
- **Completed:** 2026-03-21T19:23:32Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created app-level error.tsx with consistent zinc dark UI and retry button
- Created global-error.tsx with own html/body wrapper for root layout crash recovery
- Added segment error.tsx to charting, mechanics, command, and players (re-export pattern)
- Build confirmed passing after all changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create app-level error.tsx and global-error.tsx** - `f19a602` (feat)
2. **Task 2: Add segment-level error boundaries** - `f706555` (feat)

## Files Created/Modified
- `web/app/error.tsx` - App-level error boundary; zinc dark card with retry button; Next.js props signature
- `web/app/global-error.tsx` - Root layout boundary; includes own html/body tags for catastrophic failures
- `web/app/charting/error.tsx` - Re-exports ErrorBoundary; scopes recovery to charting segment
- `web/app/mechanics/error.tsx` - Re-exports ErrorBoundary; scopes recovery to mechanics segment
- `web/app/command/error.tsx` - Re-exports ErrorBoundary; scopes recovery to command segment
- `web/app/players/error.tsx` - Re-exports ErrorBoundary; scopes recovery to players segment

## Decisions Made
- Used re-export pattern for segment files (`export { default } from "@/app/error"`) — single UI definition avoids four copies of the same component
- global-error.tsx includes full html/body wrapper with zinc-950 background matching app theme — required by Next.js when root layout is unavailable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing Ecmascript warning in build output (crypto import in auth.ts for Edge Runtime). This is unrelated to error boundaries, was present before this plan, and the build still compiled successfully. Out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OPS-02 resolved: all major page surfaces have error boundaries
- Ready for 15-03 human checkpoint (visual verification in production)
- Error boundary pattern established before Phase 16 component decomposition

## Self-Check: PASSED

All 6 error boundary files confirmed present. Both task commits (f19a602, f706555) confirmed in git log.

---
*Phase: 15-ops-foundations*
*Completed: 2026-03-21*
