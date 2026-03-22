---
phase: 17-multi-tenancy-part-1
plan: "02"
subsystem: database
tags: [schema, migration, multi-tenancy, drizzle, neon]
dependency_graph:
  requires: [17-01]
  provides: [team_id columns on all charting tables, back-filled babson rows]
  affects: [web/db/schema.ts, web/drizzle/0008_add_team_id.sql, live Neon DB]
tech_stack:
  added: []
  patterns: [ADD COLUMN IF NOT EXISTS + UPDATE + SET NOT NULL (safe migration), sql.query() for raw Neon statements]
key_files:
  created:
    - web/drizzle/0008_add_team_id.sql
  modified:
    - web/db/schema.ts
decisions:
  - "Added team_id as second field (after PK) in each charting table — signals scoping intent at a glance"
  - "No FK constraint to teams table — teams table does not exist yet; Phase 18 adds it"
  - "DEFAULT 'babson' on column and in schema — new inserts are auto-scoped without any application code changes in Phase 17"
  - "ADD COLUMN as nullable, back-fill, then SET NOT NULL — avoids table rewrite lock on large tables"
  - "Used sql.query() not tagged template — @neondatabase/serverless version in this repo requires sql.query() for conventional string calls"
metrics:
  duration: "~2 minutes"
  completed: "2026-03-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 17 Plan 02: Add team_id to Charting Tables Summary

**One-liner:** Added `team_id text NOT NULL DEFAULT 'babson'` to all five charting domain tables via hand-written migration 0008_add_team_id.sql, back-filled all existing rows, and confirmed the live Neon DB matches the updated Drizzle schema.

## What Was Built

All five charting domain tables now have a `team_id` scoping column:

- `charting_games`
- `charting_pitcher_segments`
- `charting_plate_appearances`
- `charting_lineup_entries`
- `charting_pitches`

Each column is `text NOT NULL DEFAULT 'babson'`. All pre-existing rows were back-filled to `'babson'`. Zero NULL rows remain in any table.

The Drizzle schema in `web/db/schema.ts` reflects the live DB state. Build exits 0.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add teamId to all five charting tables in schema.ts | 7e2b819 | web/db/schema.ts |
| 2 | Write migration SQL 0008_add_team_id.sql and apply to live DB | 4e54ff1 | web/drizzle/0008_add_team_id.sql |

## Verification Results

1. `grep "team_id" web/db/schema.ts | wc -l` → 5 (one per charting table)
2. `ls web/drizzle/0008_add_team_id.sql` → file exists
3. Live DB information_schema check: all 5 tables have `team_id` column, `is_nullable: NO`, `column_default: 'babson'::text`
4. NULL count check: 0 NULL rows across all 5 tables
5. `npm --prefix web run build` → exits 0, compiled successfully

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed node fallback script — used sql.query() instead of sql()**
- **Found during:** Task 2, first migration attempt
- **Issue:** The plan's fallback node script called `sql(stmt)` but `@neondatabase/serverless` in this repo requires `sql.query(stmt)` for conventional string invocations (tagged template `sql\`...\`` is the primary API)
- **Fix:** Switched to `sql.query(stmt)` in the one-off node script; migration ran successfully on the corrected call
- **Files modified:** None (one-off inline script, not committed)
- **Commit:** N/A (inline fix)

## Self-Check: PASSED

- [x] `web/db/schema.ts` exists and contains exactly 5 `team_id` entries
- [x] `web/drizzle/0008_add_team_id.sql` exists
- [x] Commit 7e2b819 exists
- [x] Commit 4e54ff1 exists
- [x] Live DB: all 5 tables confirmed with NOT NULL, DEFAULT 'babson', zero NULLs
- [x] Build exits 0
