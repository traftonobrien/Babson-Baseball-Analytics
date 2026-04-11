# Codex Handoff — v4.0 Run Expectancy Intelligence

**Date:** 2026-04-11  
**Branch:** main  
**Last commit:** 50a0bd9 (docs: create milestone v4.0 roadmap)

---

## What This Milestone Builds

A self-updating run expectancy matrix (RE288) built entirely from Babson's own
Sidearm play-by-play data, integrated into the existing `/charting/ohtwo` coaching
dashboard to quantify the run-value cost of the 0-2 fastball strategy.

No new npm packages. No external data sources. Everything derived from game data
already available at babsonathletics.com box scores.

---

## How to Start

```bash
/clear
/gsd:plan-phase 21
```

This will read .planning/STATE.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md
and generate a detailed execution plan for Phase 21 before any code is written.

---

## The Data Format (critical — read before touching any code)

Sidearm PBP play lines look like this:

```
Robert Christensen doubled to left field, RBI (2-2 BKFB); Gabe Cushner advanced to third; Ryan Grace scored.
Ryan Hvozdovic hit by pitch (3-2 KFBBH).
```

Key facts:
1. The parenthetical `(2-2 BKFB)` is the FINAL count + pitch sequence of that PA
2. Walk the sequence letter-by-letter to get count at each pitch step:
   B=ball, K=called strike, S=swinging strike, F=foul, H=HBP, X=in-play
3. Multiple sub-events are semicolon-separated within ONE `<td>` row
4. Each semicolon event must update the base-state machine independently

---

## Phase 21 — What to Build

**Goal:** Trust every PA from every Sidearm box score is parsed into a correctly
sequenced `(count, base_state, outs)` record with validated run totals.

**Gate:** ≥15 of the ~19 known 2026 Babson games pass half-inning run-total
validation before Phase 22 begins.

**New files:**
- `web/lib/runExpectancy/pbpParser.ts` — state machine (new)
- `web/lib/runExpectancy/types.ts` — shared types (new)
- `web/lib/runExpectancy/pbpParser.test.ts` — unit tests (new)
- `web/public/data/run-expectancy/re_game_map.json` — gameId map (new)

**Modified files (minimal):**
- `web/lib/spraychart/scraper.ts` — add `export` to 2 existing functions only

**DO NOT modify:**
- `web/scripts/scrape_spray_charts.ts` — spray chart pipeline must stay unchanged
- `web/lib/charting/ohtwo.ts` — Phase 24 only
- `web/app/charting/ohtwo/page.tsx` — Phase 24 only

**Plans:**
- 21-01: Core PBP scraper — fetch all Sidearm game URLs, parse HTML into raw play
  lines per half-inning (both teams)
- 21-02: Base-state machine — compound semicolon sub-event parsing, outs tracking,
  half-inning reset, run-total validation against box score `r` column
- 21-03: Per-pitch count snapshots (walk pitch sequence string), re_game_map.json,
  edge-case unit tests (DP, sac fly, IBB, HBP)

---

## Critical Pitfalls (from research — do not skip)

### 1. Semicolon compound plays
One `<td>` row = multiple events. Must split on `;` and process each sub-event
sequentially to update base state correctly.

### 2. Dedup key must include inning
The existing scraper uses `new Set(plays)` on plain play text. Two identical play
strings in different innings will be silently dropped. Fix: key dedup by
`(inning, halfInning, playText)`.

### 3. Run-total validation is a hard gate
After parsing each half-inning, sum the runs scored and compare against the box
score `r` column. If they don't match → exclude that inning from matrix computation
and log it. Do not silently include corrupted innings.

### 4. re_game_map.json must cover doubleheaders
Sidearm uses gameIds like 16027. Babson's charting system strips `(G1)/(G2)` suffixes
(commit b776bde). The map must link gameId → `{date, opponent, homeAway, suffix}` so
Phase 23 can join correctly.

### 5. Count is FINAL count of PA, not pre-pitch
`(2-2 BKFB)` = the count when the PA ended (2 balls, 2 strikes). To get per-pitch
count: start at 0-0 and advance through the sequence character by character.
For delta-RE at the 0-2 fastball: the relevant state is just before the last pitch.

---

## Phase 22-24 Preview

**Phase 22 — RE Matrix Builder:**
- `web/scripts/build_re_matrix.ts` reads PBP corpus → groups by (count, base_state, outs)
- Produces RE24 (24 cells) and RE288 (288 cells) + Out Probability matrix
- Writes `web/public/data/run-expectancy/re-matrix-2026.json`
- `npm run re:rebuild` added to `web/package.json`
- n < 5 → null (no false precision)

**Phase 23 — Delta-RE + PA Join:**
- `game-base-states-2026.json` index keyed by (gameDate, opponent, inning, halfInning, paOrder)
- Join to Supabase charting PAs for 0-2 fastball events
- delta-RE = RE(post_state) - RE(pre_state) + runs_scored
- Gate: ≥80% of charted 0-2 fastball PAs matched

**Phase 24 — 0-2 Dashboard Integration:**
- Additive changes to `web/lib/charting/ohtwo.ts` (optional reMatrices param)
- Additive changes to `web/app/charting/ohtwo/page.tsx`
- Four new panels: total run value, counterfactual simulator, count-progression RE tree,
  out probability delta

---

## Useful Commands

```bash
# Run existing tests (must stay green after every plan)
npm --prefix web exec vitest run lib/spraychart/

# Check build
npm --prefix web run build

# See existing scraper (extend this, don't rewrite it)
cat web/lib/spraychart/scraper.ts

# See existing 0-2 report (extend in Phase 24 only)
cat web/lib/charting/ohtwo.ts
```

---

## Planning Artifacts

| File | Purpose |
|------|---------|
| `.planning/REQUIREMENTS.md` | 21 requirements PBP-01–DASH-05 |
| `.planning/ROADMAP.md` | Phases 21-24, success criteria, plan breakdown |
| `.planning/STATE.md` | Current position: Phase 21 not started |
| `.planning/research/ARCHITECTURE.md` | Integration design, component boundaries |
| `.planning/research/PITFALLS.md` | 5 critical pitfalls with prevention strategies |
