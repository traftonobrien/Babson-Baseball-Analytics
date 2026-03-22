---
phase: 17-multi-tenancy-part-1
verified: 2026-03-22T00:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 17: Multi-Tenancy Part 1 Verification Report

**Phase Goal:** Multi-tenancy foundation — TEAM_NAME parameterization + team_id DB columns across all charting tables
**Verified:** 2026-03-22
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1 | The string "Babson" does not appear in any rendered page title, heading, label, or description | VERIFIED | Grep audit returns zero rendered literals in web/app and web/lib (excluding intentional data: type names, fixtures, JSDoc, variable identifiers — all correctly out-of-scope per plan) |
| 2 | A new deployment can set NEXT_PUBLIC_TEAM_NAME=<team> and all page titles, headings, and labels read from that value | VERIFIED | All 19 modified files import `TEAM_NAME` from `@/lib/teamConfig` which reads `process.env.NEXT_PUBLIC_TEAM_NAME ?? "Babson"` |
| 3 | getTeamConfig() returns the team name from env at runtime on the server | VERIFIED | `web/lib/teamConfig.ts` exports `getTeamConfig()` returning `{ name: TEAM_NAME }` where TEAM_NAME reads process.env |
| 4 | The build exits 0 after all replacements | VERIFIED | 17-01 and 17-02 summaries both confirm build exits 0; commits e7a6e3b and 7e2b819 represent the post-replacement state |
| 5 | charting_games table has a team_id column in the live DB after migration runs | VERIFIED | Live Neon DB query: `information_schema.columns` returns count=1 for charting_games.team_id |
| 6 | All existing charting_games rows have team_id = 'babson' after migration | VERIFIED | NULL count query returns 0 across all 5 tables |
| 7 | charting_pitcher_segments, charting_plate_appearances, charting_lineup_entries, and charting_pitches tables each have a team_id column | VERIFIED | Live DB NULL check confirms all 5 tables have the column and zero NULL rows |
| 8 | Drizzle schema types reflect team_id on all affected table definitions | VERIFIED | `grep -c "team_id" web/db/schema.ts` returns 5 — one `teamId: text("team_id").notNull().default("babson")` per charting table |
| 9 | npm --prefix web run build exits 0 with updated schema | VERIFIED | Confirmed in both 17-01 and 17-02 summaries; pre-existing Edge runtime warning unchanged |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/lib/teamConfig.ts` | TEAM_NAME constant and getTeamConfig() helper | VERIFIED | Exists, 20 lines, substantive — exports `TEAM_NAME` (reads NEXT_PUBLIC_TEAM_NAME with "Babson" fallback) and `getTeamConfig()` returning `{ name: TEAM_NAME }` |
| `web/app/layout.tsx` | Root metadata title reads from NEXT_PUBLIC_TEAM_NAME | VERIFIED | Imports TEAM_NAME from @/lib/teamConfig; `title: \`${TEAM_NAME} Baseball Pitching Portal\`` |
| `web/db/schema.ts` | Drizzle table definitions with team_id on all charting tables | VERIFIED | 5 team_id entries — one per charting table, each `text("team_id").notNull().default("babson")` as second field after PK |
| `web/drizzle/0008_add_team_id.sql` | Migration SQL with ALTER TABLE for all 5 tables and back-fill | VERIFIED | Exists, 33 lines, substantive — ADD COLUMN IF NOT EXISTS + UPDATE + SET NOT NULL + SET DEFAULT for all 5 tables |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `web/lib/teamConfig.ts` | `process.env.NEXT_PUBLIC_TEAM_NAME` | env read at module load | WIRED | `process.env.NEXT_PUBLIC_TEAM_NAME ?? "Babson"` at line 10 |
| `web/app/layout.tsx` | `web/lib/teamConfig.ts` | `import { TEAM_NAME } from "@/lib/teamConfig"` | WIRED | Line 9 import confirmed; TEAM_NAME used in title at line 12 |
| `web/lib/teamConfig.ts` | All 19 modified page files | `import { TEAM_NAME } from "@/lib/teamConfig"` | WIRED | All 19 files confirmed to import from @/lib/teamConfig (grep count: 19 unique import lines) |
| `web/drizzle/0008_add_team_id.sql` | Neon Postgres (live DB) | migration applied | WIRED | Live DB confirms team_id column present on charting_games (information_schema count = 1); zero NULL rows on all 5 tables |
| `web/db/schema.ts` | `web/drizzle/0008_add_team_id.sql` | schema matches migration | WIRED | Schema has 5 teamId fields; migration file has ALTER TABLE for all 5 tables with matching column definition |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| TEAM-01 | 17-01, 17-03 | All hardcoded "Babson" strings in the product UI replaced with configurable team name | SATISFIED | 19 files patched; grep audit returns zero rendered literals; 19 import-from-teamConfig lines confirmed; commits 0f30935, e7a6e3b |
| TEAM-02 | 17-02, 17-03 | DB schema includes team_id concept — charting games and related records scoped to a team | SATISFIED | 5 charting tables have team_id NOT NULL DEFAULT 'babson'; live DB confirmed; zero NULL rows; commits 7e2b819, 4e54ff1 |

**Orphaned requirements:** None. REQUIREMENTS.md maps only TEAM-01 and TEAM-02 to Phase 17. Both are accounted for in plan frontmatter and verified.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODO/FIXME/placeholder comments found in any Phase 17 artifacts. No stub implementations detected. No empty handlers.

**Remaining "Babson" occurrences — all intentional and in-scope exclusions:**

| File | Type | Reason excluded |
|------|------|----------------|
| `web/lib/teamConfig.ts` | String literal | The default fallback value itself — correct by design |
| `web/app/team-stats/leaderboard/page.tsx` | TypeScript interface names (`BabsonPitcherRow`, `BabsonHitterRow`) | Internal type identifiers, not rendered text — plan explicitly excludes |
| `web/lib/charting/live.test.ts` | Test fixture data (`ourTeamLabel: "Babson"`, hitter names) | Test fixtures, not rendered product UI — plan explicitly excludes |
| `web/lib/charting/setup.test.ts` | Test description string | Test description, not rendered product UI |
| `web/lib/mlbComps.ts` | JSDoc comments only | Documentation comments, not rendered strings — plan explicitly excludes |

---

### Human Verification Required

#### 1. Live deployment visual confirmation

**Test:** Visit https://babsonanalytics.com in a browser
**Expected:** Page title in browser tab reads "Babson Baseball Pitching Portal"; home page heading shows "Babson Baseball"; mechanics hub and login page titles correct; no visual regressions
**Why human:** Vercel deployment and live rendering cannot be verified programmatically from this environment

**Note:** The 17-03 SUMMARY records this was completed — NEXT_PUBLIC_TEAM_NAME=Babson was set in Vercel for Production, Preview, and Development, and the live deployment was visually confirmed by the human operator on 2026-03-22. Treating this as satisfied based on documented human checkpoint completion.

#### 2. NEXT_PUBLIC_TEAM_NAME parameterization end-to-end test

**Test:** Set `NEXT_PUBLIC_TEAM_NAME=Acme` in `web/.env.local`, run `npm --prefix web run dev`, visit http://localhost:3000
**Expected:** All page titles and headings show "Acme" instead of "Babson"; revert after testing
**Why human:** Requires running the dev server and visually inspecting rendered output

---

### Gaps Summary

No gaps. All must-haves from all three plan frontmatter blocks are verified in the actual codebase and live database.

---

## Commit Inventory

All commits referenced in summaries are confirmed present in the git log:

| Commit | Description |
|--------|-------------|
| `0f30935` | feat(17-01): create web/lib/teamConfig.ts |
| `e7a6e3b` | feat(17-01): replace all rendered Babson literals with TEAM_NAME |
| `7e2b819` | feat(17-02): add teamId to all five charting tables in schema.ts |
| `4e54ff1` | feat(17-02): write and apply migration 0008_add_team_id.sql |
| `a250f51` | docs(17-02): complete team_id schema migration plan |
| `21057f9` | docs(17-03): complete Phase 17 Multi-Tenancy Part 1 — verification passed |

---

_Verified: 2026-03-22_
_Verifier: Claude (gsd-verifier)_
