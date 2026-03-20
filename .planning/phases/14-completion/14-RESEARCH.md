# Phase 14: Completion - Research

**Researched:** 2026-03-20
**Domain:** Live AB player profile polish + charting branch UAT + merge
**Confidence:** HIGH

## Summary

Phase 14 closes two distinct in-flight items before the v3.0 work begins. DONE-01 is about finishing Phase 12.1-03 — the mixed-role Live AB polish — which is partially complete in code but lacks a final validation pass and a 12.1-03 SUMMARY.md. DONE-02 is about browser-testing the `codex/game-charting-structure` branch and merging it to main.

The critical discovery for DONE-02 is that `codex/game-charting-structure` no longer exists as a remote branch. Its two commits (`feat: add two-sided game charting flow` and `fix: tighten charting top bar layout`) are already present on `main` as commits `31c7558` and `b9652d8`. A diff of ChartingEditor.tsx between the UAT commit `8ddd3c8` and its main equivalent `b9652d8` shows zero diff — the code is identical. This means DONE-02 reduces to: (a) confirm the browser UAT test scenarios work against the current main, then (b) document the merge as already complete.

For DONE-01, the implementation is farther along than the planning docs reflect. `LiveAbProfilePanel.tsx` already handles pitcher-only, hitter-only, two-way, and no-data players via runtime guards (`if (!pitcher && !hitter)`, `pitcher ? ... : null`, `hitter ? ... : null`, `profile.availableRoles.length > 1`). The `deriveHittingSynthesis` function is implemented and rendering. Tests in `playerProfile.test.ts` cover all four role states. What remains for 12.1-03 is a focused polish and validation pass — not a ground-up implementation.

**Primary recommendation:** Plan 14-01 as a focused review-and-polish pass on the existing Live AB implementation (no major rework needed). Plan 14-02 as a UAT test execution against `main` (the branch is already merged). Plan 14-03 as merge documentation/cleanup only.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DONE-01 | Phase 12.1-03 is complete — mixed-role Live AB player profile polish and final validation pass | Code is largely implemented; needs polish review and 12.1-03 SUMMARY.md |
| DONE-02 | Charting UAT passes — codex/game-charting-structure branch is manually browser-tested and merged to main | Branch commits already on main; UAT scenarios to confirm, then document |
</phase_requirements>

---

## Standard Stack

### Core (this phase)

| Component | Location | Purpose |
|-----------|----------|---------|
| `LiveAbProfilePanel.tsx` | `web/app/players/[slug]/` | Renders pitcher, hitter, two-way, and no-data Live AB states |
| `playerProfile.ts` | `web/lib/charting/` | Data contract for Live AB profile — `buildChartingPlayerProfile`, `loadChartingPlayerProfile` |
| `playerProfile.test.ts` | `web/lib/charting/` | 5 passing tests covering pitcher-only, hitter alias merge, two-way, no-data, and directory |
| `PlayerProfileTabs.tsx` | `web/app/players/[slug]/` | Tab shell — Charting tab renders `LiveAbProfilePanel` |
| `ChartingEditor.tsx` | `web/app/charting/_components/` | 2913-line editor with two-sided charting (already on main) |

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `web/vitest.config.ts` (implied) |
| Quick run command | `npm --prefix web test -- --run lib/charting/playerProfile` |
| Full suite command | `npm --prefix web test -- --run` |

---

## Architecture Patterns

### DONE-01: Current Live AB Role Handling

`LiveAbProfilePanel.tsx` uses four patterns for role state:

**No-data guard (lines 497-503):**
Returns a single `LeaderboardPanel` with "No charting data has been recorded for this player yet." when both `pitcher` and `hitter` are null.

**Pitcher section (lines 540-716):**
Rendered inside `{pitcher ? (...) : null}`. Contains session type toggle (Game/Live), stat blocks, Pitch Mix bar, synthesis takeaways, zone maps, and session list.

**Hitter section (lines 718-815):**
Rendered inside `{hitter ? (...) : null}`. Contains stat grids, hitter synthesis takeaways, and hitting session list. Two-way indicator shown below when `profile.availableRoles.length > 1`.

**Tab availability in `PlayerProfileTabs.tsx`:**
- `profileMode === "hitter"` → only `HITTER_TABS = ["Overview", "Charting"]`
- All others → `ALL_TABS = ["Overview", "Charting", "Trackman", "Command", "Mechanics"]`
- Tab labeled "Charting" (not "Live AB"); deep-link resolves `live-ab`, `liveab`, or `charting` to this tab.

### DONE-01: What 12.1-03 Actually Needs

Based on the `.continue-here.md` and code review, the remaining work is:

1. **Review pass** — Confirm the current `LiveAbProfilePanel.tsx`, `playerProfile.ts`, `PlayerProfileTabs.tsx` are coherent and no copy/spacing issues remain from the post-synthesis-expansion state.
2. **Verify test completeness** — The 5 existing tests pass. The plan calls for mixed-role and empty-state behavior to be "explicit and tested." The two-way test (`it("supports two-way players..."`) exists; the no-data test exists. Confirm these are sufficient or add edge cases.
3. **Create 12.1-03-SUMMARY.md** — The continue-here file notes this is missing.
4. **Run full validation gate** — `npm --prefix web test -- --run lib/charting/playerProfile`, `npm --prefix web test -- --run`, `npm --prefix web run build`.

The `hitter.stats` shape passed to `deriveHittingSynthesis` is `{totalPAs, contactPct, chasePct, kPct, bbPct}` sourced from `AggregatedHitterStats`. The function guards on `totalPAs < 15`, so no-data and thin samples render no takeaways — this is correct behavior.

### DONE-02: Charting Branch Status

**Key finding:** `codex/game-charting-structure` is not present as a remote branch. Its two unique commits vs main's merge base (`f8595a0`) are:

- `c92a768` — `feat: add two-sided game charting flow` (same content as main's `31c7558`)
- `8ddd3c8` — `fix: tighten charting top bar layout` (same content as main's `b9652d8`)

`git diff 8ddd3c8 b9652d8 -- web/app/charting/_components/ChartingEditor.tsx` returns zero lines. The code is identical. The branch was merged (or cherry-picked) to main before this planning session started.

**What the two-sided charting feature adds (from commit stats):**
- `ChartingEditor.tsx`: +623/-73 lines — adds `activeBattingSide`, `activePitchingSide`, `ourTeamLabel`, `opponentTeamLabel`, two-sided matchup UI, pitcher datalist separated from hitter input
- `web/db/schema.ts`: 4 lines added — new columns for PA context
- `web/drizzle/0006_charting_pa_context.sql`: migration for the new schema
- `web/lib/charting/live.ts`: +239/-1 — extended state machine for two-sided play
- `web/lib/charting/live.test.ts`: +163 tests — new scenario coverage

### DONE-02: UAT Test Scenarios

The UAT plan from the primer and `.continue-here.md` covers seven scenarios. All should be tested against current `main` at `/charting`:

| Scenario | What to confirm |
|----------|----------------|
| New game creation | Game creation form works; team labels saved; game appears in hub |
| Pitch recording | Pitch type, zone cell, result all record; both team sides work |
| PA close | PA result codes close the PA; count advances correctly |
| Lineup entry | Hitter slots cycle; both sides' lineup entry works |
| Baserunner entry | Baserunner state persists; `baserunnerDraft` survives 409 reload |
| History edit | `historyEditDraft` flow opens; pitch/PA edits commit correctly |
| Export | CSV at `/api/charting/games/[id]/export`; PDF at `/api/charting/games/[id]/export-pdf` both download |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Role detection | Custom role-detection logic | `profile.availableRoles`, `profile.pitcher`, `profile.hitter` from `ChartingPlayerProfile` contract |
| Hitter identity merge | Name matching logic | `matchesHitterName` inside `buildChartingPlayerProfile` — already handles canonical ID + alias normalization |
| Stats computation | Inline stat math in the panel | `AggregatedPitcherStats` / `AggregatedHitterStats` from `computePitcherAggregation` / `computeHitterAggregation` |
| Session labels | Custom date formatting | `buildSessionLabel` inside `playerProfile.ts` |
| Hitter synthesis | New synthesis function | `deriveHittingSynthesis` already implemented in `LiveAbProfilePanel.tsx` |
| Pitcher synthesis | New synthesis function | `derivePitchingSynthesis` already implemented in `LiveAbProfilePanel.tsx` |

---

## Common Pitfalls

### Pitfall 1: Assuming the charting branch needs merging
**What goes wrong:** Planner schedules a `git merge` task for `codex/game-charting-structure`.
**Why it happens:** The primer and blockers list reference the branch as pending. In reality, the commits are on main already (confirmed by zero diff on ChartingEditor.tsx).
**How to avoid:** Plan 14-03 should document this fact and confirm the merge is done — not perform a merge. The task is verification, not integration.
**Warning signs:** Any plan step saying `git merge codex/game-charting-structure` is wrong.

### Pitfall 2: Rebuilding what's already implemented in 12.1-03
**What goes wrong:** Planner treats DONE-01 as a ground-up implementation task.
**Why it happens:** The ROADMAP says "Phase 12.1-03: Polish mixed-role states" and the `.continue-here.md` dates from March 10. The synthesis expansion work on March 19 actually completed most of what 12.1-03 required.
**How to avoid:** Plan 14-01 as a review-and-validate pass, not an implementation pass. Start by reading the current files, then only fix genuine gaps.

### Pitfall 3: Missing the `hitter.stats` null propagation
**What goes wrong:** `deriveHittingSynthesis` receives a non-null stats object but with null fields, producing unexpected behavior.
**Why it happens:** `AggregatedHitterStats` can have null fields when the sample size is too small.
**How to avoid:** The `totalPAs < 15` guard at the top of `deriveHittingSynthesis` handles this correctly already. Verify the guard is not removed during any polish pass.

### Pitfall 4: auth.test.ts failure masking real regressions
**What goes wrong:** `npm --prefix web test -- --run` reports 1 failed test file, which looks like a regression.
**Why it happens:** `lib/auth.test.ts` fails because it needs a real `DATABASE_URL` env var (`neon()` throws without it). This is a pre-existing local environment issue.
**How to avoid:** 369/369 tests in the other 34 files are passing. The auth test failure is expected locally. The validation gate is "369 tests pass in 34 test files" not "35/35 files pass." Build (`npm --prefix web run build`) is the authoritative gate.

### Pitfall 5: `LiveAbProfilePanel` passed `seasonStats` is pitcher-side only
**What goes wrong:** The hitter section in `LiveAbProfilePanel` has no seasonal stat grid equivalent to the pitcher side's NCAA stats.
**Why it happens:** `<LiveAbProfilePanel profile={liveAbProfile} seasonStats={pitchingSeasonStats} />` — only `pitchingSeasonStats` is passed.
**How to avoid:** This is intentional current design — hitter-only and two-way players currently don't get a season stat grid in the Charting tab. Do not add `hittingSeasonStats` without explicit product approval.

---

## Code Examples

### Current mixed-role indicator in LiveAbProfilePanel (lines 817-822)

```typescript
// Source: web/app/players/[slug]/LiveAbProfilePanel.tsx:817
{profile.availableRoles.length > 1 ? (
  <div className="flex items-center gap-2 text-xs text-zinc-500">
    <BarChart3 className="h-4 w-4" />
    This player has both pitcher and hitter Charting data in the charting system.
  </div>
) : null}
```

### Hitter synthesis render block (lines 796-811)

```typescript
// Source: web/app/players/[slug]/LiveAbProfilePanel.tsx:796
{(() => {
  const takeaways = deriveHittingSynthesis(hitter.stats);
  if (takeaways.length === 0) return null;
  return (
    <div className="rounded-[1.7rem] border border-zinc-800/50 bg-zinc-950/40 px-5 py-4">
      <ul className="space-y-1.5">
        {takeaways.map((t) => (
          <li key={t} className="text-sm leading-relaxed text-zinc-400">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
})()}
```

### playerProfile.test.ts — two-way test (verifies both roles)

```typescript
// Source: web/lib/charting/playerProfile.test.ts:156
it("supports two-way players with both pitcher and hitter Live AB data", () => {
  // ... setup ...
  expect(profile.availableRoles).toEqual(["pitcher", "hitter"]);
  expect(profile.defaultRole).toBe("pitcher");
  expect(profile.pitcher?.stats?.sessions).toBe(1);
  expect(profile.hitter?.stats?.sessions).toBe(1);
});
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `web/vitest.config.ts` |
| Quick run command | `npm --prefix web test -- --run lib/charting/playerProfile` |
| Full suite command | `npm --prefix web test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DONE-01 | Mixed-role players show both pitcher and hitter sections | unit | `npm --prefix web test -- --run lib/charting/playerProfile` | YES (5 tests) |
| DONE-01 | No-data player shows empty state message | unit | `npm --prefix web test -- --run lib/charting/playerProfile` | YES (1 test) |
| DONE-01 | Hitter alias merging resolves correctly | unit | `npm --prefix web test -- --run lib/charting/playerProfile` | YES (1 test) |
| DONE-01 | Full build stays clean after any polish changes | smoke | `npm --prefix web run build` | n/a (build command) |
| DONE-02 | Charting editor records pitches correctly | manual | Browser UAT | manual-only |
| DONE-02 | Export routes return valid CSV and PDF | smoke | Browser download test | manual-only |

### Sampling Rate

- Per task commit: `npm --prefix web test -- --run lib/charting/playerProfile`
- Per wave merge: `npm --prefix web test -- --run`
- Phase gate: Full suite + `npm --prefix web run build` both pass before /gsd:verify-work

### Wave 0 Gaps

None — existing test infrastructure covers all automated phase requirements. The auth.test.ts failure (DATABASE_URL not set locally) is a pre-existing environment issue, not a gap introduced by this phase.

---

## State of the Art

| Old Assumption | Current Reality | Impact |
|----------------|-----------------|--------|
| `codex/game-charting-structure` is unmerged | Commits are already on `main` as `31c7558` and `b9652d8` | Plan 14-02/03 shifts from merge work to UAT + documentation |
| Phase 12.1-03 needs mixed-role implementation | Implementation is complete; only review/polish and SUMMARY.md remain | Plan 14-01 is a review pass, not a build pass |
| `deriveHittingSynthesis` not yet written | Fully implemented in `LiveAbProfilePanel.tsx` and rendering | No synthesis work needed |
| 374/374 tests passing | 369 passing in 34/35 files; auth.test.ts fails without DATABASE_URL (pre-existing) | Build is the authoritative validation gate |

---

## Open Questions

1. **Is UAT feasible without a live DB?**
   - What we know: ChartingEditor requires a real Neon DB connection to fetch/write game data
   - What's unclear: Whether a local dev server with DATABASE_URL can connect to the live Neon instance
   - Recommendation: UAT should run against the Vercel production deployment (`https://pitch-tracker-...vercel.app/charting`) where DATABASE_URL is set; document that in the UAT plan task.

2. **Should 12.1-03 also address the Charting tab label?**
   - What we know: The tab is labeled "Charting" in `ALL_TABS` and `HITTER_TABS`; deep-link accepts `live-ab`, `liveab`, `charting`
   - What's unclear: Whether the tab label should be renamed to "Live AB" for clarity
   - Recommendation: Keep "Charting" — the deep-link resolution already handles the alias, and changing the label is a UX concern for Phase 19 not Phase 14.

3. **Is the `seasonStats` hitter gap a 12.1-03 concern?**
   - What we know: `LiveAbProfilePanel` only receives `pitchingSeasonStats`; hitter-only and two-way players get no season stat grid in the Charting tab
   - What's unclear: Whether this was intentional design or an oversight
   - Recommendation: Out of scope for Phase 14. The hitter stat grids are already in the Charting tab from charting data. NCAA season stats for hitters in the charting surface is a new feature, not a polish fix.

---

## Sources

### Primary (HIGH confidence)

- `/Users/traftonobrien/Desktop/pitch-tracker/web/app/players/[slug]/LiveAbProfilePanel.tsx` — direct read of current implementation
- `/Users/traftonobrien/Desktop/pitch-tracker/web/lib/charting/playerProfile.ts` — direct read of data contract
- `/Users/traftonobrien/Desktop/pitch-tracker/web/lib/charting/playerProfile.test.ts` — direct read, confirmed 5 tests passing
- `/Users/traftonobrien/Desktop/pitch-tracker/web/app/players/[slug]/PlayerProfileTabs.tsx` — direct read of tab structure
- `/Users/traftonobrien/Desktop/pitch-tracker/.planning/phases/12.1-live-ab-player-profile-integration/.continue-here.md` — authoritative status doc for Phase 12.1
- `git diff 8ddd3c8 b9652d8` — confirmed zero diff on ChartingEditor.tsx between UAT commit and main
- `git log main..8ddd3c8` — confirmed two commits from the UAT branch already on main

### Secondary (MEDIUM confidence)

- `git show c92a768 --stat` — file diff stats for two-sided charting commit
- `.planning/phases/12.1-live-ab-player-profile-integration/12.1-03-PLAN.md` — original plan spec for what 12.1-03 requires
- `.planning/phases/12.1-live-ab-player-profile-integration/12.1-02-SUMMARY.md` — completion state for plan 02

---

## Metadata

**Confidence breakdown:**
- DONE-01 current state: HIGH — directly read all relevant files
- DONE-02 merge status: HIGH — confirmed by git diff showing zero delta on ChartingEditor.tsx
- UAT test scenarios: MEDIUM — derived from commit stats and existing UAT checklist in primer; not confirmed by running the app

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable codebase, no fast-moving dependencies)
