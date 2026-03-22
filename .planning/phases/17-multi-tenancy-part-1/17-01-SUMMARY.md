---
phase: 17-multi-tenancy-part-1
plan: "01"
subsystem: web-identity
tags: [multi-tenancy, env-config, team-name, parameterization]
dependency_graph:
  requires: []
  provides: [TEAM_NAME_config, team_identity_parameterization]
  affects: [web/lib/teamConfig.ts, web/app/layout.tsx, web/app/HomeContent.tsx, web/app/login/page.tsx]
tech_stack:
  added: [web/lib/teamConfig.ts]
  patterns: [NEXT_PUBLIC_env_var, module-level-constant, server-and-client-compatible-env-read]
key_files:
  created:
    - web/lib/teamConfig.ts
  modified:
    - web/app/layout.tsx
    - web/app/HomeContent.tsx
    - web/app/login/page.tsx
    - "web/app/player/[playerId]/report/page.tsx"
    - web/app/mechanics/page.tsx
    - web/app/mechanics/faq/page.tsx
    - web/app/players/PlayersHubView.tsx
    - web/app/players/faq/page.tsx
    - web/app/trackman/faq/page.tsx
    - web/app/leaderboards/faq/page.tsx
    - web/app/team-stats/faq/page.tsx
    - web/app/charting/faq/page.tsx
    - web/app/charting/insights/_lib/helpers.ts
    - web/app/charting/insights/LiveAbInsightsExplorer.tsx
    - web/app/charting/insights/_components/empty-state.tsx
    - web/app/charting/_components/ChartingEditor.tsx
    - web/app/charting/_components/charting-editor/top-bar.tsx
    - web/app/charting/_components/charting-editor/lineup-editor-modal.tsx
    - web/lib/playerRegistry.ts
decisions:
  - "NEXT_PUBLIC_TEAM_NAME is the single env var — inlined at build for client, runtime for server. One variable, both runtimes."
  - "Default fallback is 'Babson' in teamConfig.ts so existing deployments are unchanged until overridden."
  - "ChartingCreateForm.tsx babsonVenueSide/babsonStartingPitcher variable names left as-is — internal state identifiers, not rendered strings."
  - "api/ routes, pdf.ts, test fixtures, college-stats type names left untouched — not rendered UI strings."
  - "team-stats/leaderboard/page.tsx BabsonPitcherRow/BabsonHitterRow interface names left as-is — TypeScript type identifiers, not rendered text."
metrics:
  duration_minutes: 5
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 19
  completed_date: "2026-03-22"
---

# Phase 17 Plan 01: Team Name Parameterization Summary

One-liner: NEXT_PUBLIC_TEAM_NAME env var replaces all 20+ hardcoded "Babson" rendered strings via a single teamConfig.ts module, leaving the default as "Babson" so existing deployments are unchanged.

## What Was Built

Created `web/lib/teamConfig.ts` as the single source of truth for team identity. It exports:
- `TEAM_NAME: string` — reads `process.env.NEXT_PUBLIC_TEAM_NAME` with `"Babson"` fallback
- `getTeamConfig()` — server-side helper returning `{ name: TEAM_NAME }`, extensible for Phase 18 logo/colors

Replaced all rendered "Babson" literals across 19 files. Every page title, heading, label, placeholder, and description string now reads from `TEAM_NAME`.

## Tasks Completed

| Task | Name | Commit | Key Output |
|------|------|--------|------------|
| 1 | Create web/lib/teamConfig.ts | 0f30935 | New file with TEAM_NAME and getTeamConfig exports |
| 2 | Replace all rendered Babson literals | e7a6e3b | 19 files updated; build exits 0; grep audit passes |

## Verification

**Grep audit:** All remaining "Babson" occurrences are in explicitly excluded categories:
- `web/lib/teamConfig.ts` — the default fallback value itself (correct)
- `ChartingCreateForm.tsx` — internal variable names (`babsonVenueSide`, `babsonStartingPitcher`), no rendered labels
- `api/` routes — TypeScript type names, not rendered strings
- `team-stats/leaderboard/page.tsx` — `BabsonPitcherRow`/`BabsonHitterRow` TypeScript interfaces
- `pdf.ts` — PDF metadata (not in plan scope)
- Test files — fixtures, not rendered
- `babsonPitchers.ts` — NCAA stats module data logic

**Build:** `npm --prefix web run build` exits 0. Pre-existing Edge runtime warning for `lib/auth.ts` is unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `web/lib/teamConfig.ts` exists and exports `TEAM_NAME` and `getTeamConfig`
- [x] All 19 modified files import from `@/lib/teamConfig`
- [x] Grep audit returns zero rendered Babson literals in modified source files
- [x] Build exits 0
- [x] Commits 0f30935 and e7a6e3b exist
