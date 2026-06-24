# Pitch Tracker — Task Board

## 2026-04-18 — Package NCAA Sync as open-source tool (done)
- [x] Audit existing NCAA sync skill + production workflow and extract reusable architecture.
- [x] Create standalone package scaffold in `tools/ncaa-stats-sync/` (R package + CLI + docs).
- [x] Port reusable HTTP/session/parse/write logic from repo scripts into package functions.
- [x] Add daily GitHub Actions workflow template for package users.
- [x] Add quickstart + deployment + troubleshooting docs and release checklist.
- [x] Add sample config and output contract docs for non-Pitch-Tracker users.

## 2026-04-18 — NCAA package stat-engine expansion
- [x] Audit stat coverage for player + team outputs.
- [x] Expand derived stat calculations from base NCAA columns.
- [x] Add conference baselines and overall/conference percentiles for players.
- [x] Add conference baselines and overall/conference percentiles for teams.
- [x] Add regression tests for benchmark/percentile enrichment.

## 2026-04-18 — ncaa-stats-sync v0.4.0 sequential OSS batch (done)
- [x] JSON Schema under `tools/ncaa-stats-sync/schema/json/` + `meta.json` SHA-256 checksums (correct `digest(file=)` usage).
- [x] `ncaa_stats_doctor()` + `scripts/ncaa_stats_doctor.R` + CI doctor step.
- [x] `_pkgdown.yml` + vignettes (`percentiles`, `baselines`, `qualified-roster`).
- [x] CLI `--smoke` + non-zero exit on sync errors or failed smoke validation.
- [x] README: doctor/smoke/exit codes/schema table + dual-track (OSS vs hosted) boundary.
- [x] Strict no-vignette package check path (`make check`) + CI check step; documentation warnings resolved.
- [x] ncaa-stats-sync **v0.4.1**: R-valid MIT `LICENSE` stub (removes check NOTE), pkgdown deploy workflow + README badge; skill cross-link updated.
- [x] ncaa-stats-sync **v0.4.2**: `Remotes` for `collegebaseball`; pkgdown workflow green; **`gh-pages`** branch live — enable **Settings → Pages** once for public docs URL.
- [x] ncaa-stats-sync **v0.4.3**: CI fixed — `test-package` uses RSPM + `setup-r-dependencies` (was failing on source builds of `curl`/`fs`/…); sync workflow aligned + Chromium for chromote.
- [x] ncaa-stats-sync **GitHub Pages**: enabled via API (`gh-pages` / `/`); **https://traftonobrien.github.io/ncaa-stats-sync/** returns 200; workflows set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.

## 2026-04-15 — Charter feedback (`tasks/handoff-charter-feedback-2026-04-15.md`)
- [x] Ready items 1–5: no IBB in UI (nothing to remove), SAC/SF + 1B+E + balk + history delete implemented in charting editor; `npm --prefix web run build` passes.

## 2026-04-25 — Remotion product overview polish pass
- [x] Read `remotion-video/docs/CLAUDE_CODE_VIDEO_OPTIMIZATION_PROMPT.md` and baseline draft context.
- [x] Rework `remotion-video/src/Composition.tsx` with stronger story arc, pacing variation, hero scenes, and montage/outro polish using only approved real UI captures.
- [x] Run verification (`npm run lint`, `npm run still`, `npm run render`, `ffprobe`) and review output candidate.
- [x] Capture live interaction clips from `babsonanalytics.com` and rebuild around real website motion instead of screenshot-only Ken Burns movement.
- [x] Integrate momentum patterns from Remotion reference prompts (quick-cut beat timeline, kinetic title cards, varied clip layouts) and render a style pass.
- [x] Fix dark/blank browser panes by correcting live clip playback behavior in scene windows (`OffthreadVideo` looped playback; no hard end trims).
- [x] Tighten transition amplitudes to keep product UI occupying more of frame during quick cuts while retaining pace.
- [x] Render and validate updated cut: `remotion-video/out/babson-analytics-scene-transition-pass-v4.mp4`.
- [x] Re-capture live clips with route-specific pointer + scroll choreography for more visible in-scene motion.
- [x] Increase quick-cut energy (shorter beats, stronger vertical travel, cut flashes) and render fast-transition pass.
- [x] Render and validate current quick-cut candidate: `remotion-video/out/babson-analytics-quickcut-pass-v7.mp4` (~24.85s).
- [x] Download Remotion upstream `.claude/skills` reference set to `tools/remotion-claude-skills/remotion-upstream/.claude/skills` for iteration guidance.
- [x] Apply anti-flat cinematic pass in `remotion-video/src/Composition.tsx` (quick burst beat, stronger camera travel, shorter overlay copy) and render `out/babson-analytics-quickcut-pass-v8.mp4` (~26.45s).
- [x] Rebuild `remotion-video/src/Composition.tsx` as strict reference-style beat map (intro text → feature windows → whip burst beats → deploy beat → icon outro) and render `out/babson-analytics-reference-match-pass-v9.mp4` (~25.86s).
- [x] Rewrite `remotion-video/src/Composition.tsx` from scratch with per-beat unique transition modes (drop/slide/zoom/iris/tilt/split/whip), then render `out/babson-analytics-reference-match-pass-v10.mp4` (~22.59s).
- [x] Build explicit wireframe-lock source layers in `remotion-video/src/Composition.tsx`: `pageInventory`, `captureStatus`, `excludedRoutes`, `wireframeBeats`, and `copyBank`.
- [x] Map dwell hierarchy to beat roles (hero/support/burst) and assign deterministic per-beat transition styles before rendering.
- [x] Render and verify wireframe-lock candidate `out/babson-analytics-wireframe-lock-v11.mp4` (~25.26s) with exclusions preserved (no login/mechanics/`/charting/ohtwo`).

## 2026-04-25 — Remotion launch-video mirror pass (in progress)
- [x] Rebuild `remotion-video/src/Composition.tsx` to mirror the Remotion Launch Video on X scene architecture (8 scenes, 1120 frames @ 30fps) mapped to Babson Analytics content.
- [x] Keep all scenes in Mac-style AppWindow framing with spring fade+scale transitions and dark-theme palette from reference.
- [x] Integrate real Babson clips across scene modules (`home`, `command`, `profile`, `charting`) and keep forbidden pages excluded.
- [x] Lint + render new candidate to `remotion-video/out/babson-analytics-mirror-launch-v15.mp4` and verify runtime (~37.38s).
- [x] Convert entire cut to site-first footage emphasis (reduce synthetic UI overlays in scenes 3–8) and render `remotion-video/out/babson-analytics-mirror-launch-v17-site-first-full.mp4`.
- [x] Apply Babson brand color pass and reduce overlay text footprint across scenes; render `remotion-video/out/babson-analytics-mirror-launch-v18-brand-pass.mp4`.
- [x] Propagate scene-1-style dynamic 3D motion grammar to scenes 2–8 and preserve staggered reference effects; render `remotion-video/out/babson-analytics-mirror-launch-v19-dynamic-pass.mp4`.
- [x] Fix post-intro blank-frame regression from collapsed transform wrappers and render corrected cut `remotion-video/out/babson-analytics-mirror-launch-v20-fix-post-intro.mp4`.
- [x] Refine typography hierarchy, cinematic framing, and per-scene scroll motion treatment; render `remotion-video/out/babson-analytics-mirror-launch-v21-type-framing-scroll.mp4`.
- [x] Remove module/signal bubble overlays, move scene text outside frames with dynamic captions, strengthen scroll motion, and complete full-frame audit render `remotion-video/out/babson-analytics-mirror-launch-v22-text-framing-scroll-fix.mp4`.
- [x] Add multi-mode transition system (swipe, match-cut, punch, iris, flash-cut), small-to-big emphasis, and expanded quick-cut choreography; render `remotion-video/out/babson-analytics-mirror-launch-v23-transition-system.mp4`.
- [x] Capture real leaderboard navigation interactions via live site taps and replace synthetic tab montage with recorded usage clip; render `remotion-video/out/babson-analytics-mirror-launch-v25-real-leaderboard-taps.mp4`.
- [x] Map Jitter reference motion language (snap jitter, micro-strobe, mixed transition presets) into scene transition system; render `remotion-video/out/babson-analytics-mirror-launch-v26-jitter-reference-map.mp4`.
- [x] Add strict frame-pattern profile controls (`soft`, `medium`, `aggressive`) and wire all scene transforms/transitions to profile multiplier for side-by-side validation renders.
- [x] Render profile comparison cuts: `remotion-video/out/babson-analytics-v27-soft.mp4`, `remotion-video/out/babson-analytics-v27-medium.mp4`, `remotion-video/out/babson-analytics-v27-aggressive.mp4`.
- [x] Remove custom jitter/snap transition behavior and reformat all scene transitions to reference prompt style (spring fade + scale `0.95→1` in, `1→0.95` out); render `remotion-video/out/babson-analytics-mirror-launch-v29-reference-format.mp4`.
- [x] Add multi-box composited frame language (stacked mini windows, staggered panel entrances, layered card format) across scenes 3–7; render `remotion-video/out/babson-analytics-mirror-launch-v30-boxed-format.mp4`.
- [x] Replace popup-like mini windows with integrated split-layout compositions (2-up/3-up pane systems inside the main AppWindow) and render `remotion-video/out/babson-analytics-mirror-launch-v31-integrated-layouts.mp4`.
- [x] Map transition mechanics to reference clip style (line-to-card reveal, panel wipe, flash punch accents) and render `remotion-video/out/babson-analytics-mirror-launch-v32-reference-transition-map.mp4`.
- [x] Hard-reset transition engine to reference-like attack/overshoot/settle/out timing phases with directional scene variants and render `remotion-video/out/babson-analytics-mirror-launch-v33-transition-hard-reset.mp4`.
- [x] Create explicit reference transition spec table (attack/overshoot/settle/out + flash envelopes) and lock scene transitions to that spec; render `remotion-video/out/babson-analytics-mirror-launch-v34-reference-spec-lock.mp4`.
- [x] Apply all user-provided reference clips as distinct transition presets (`Scene`, `Scene (1)`, `Scene (2)`, `Scene (3)`, `Scene (4)`, `Frame-20`) and map them across scene boundaries; render `remotion-video/out/babson-analytics-mirror-launch-v35-all-reference-presets.mp4`.

## Status Key
- [ ] not started
- [~] in progress
- [x] done

---

## Feature: Pitcher Performance Insights (Charting Tab)

**Goal:** Mirror the `HitterPerformanceInsights.tsx` interactive zone panel, but for pitchers on their own player profile page. Currently the pitcher Charting tab shows only `LiveAbProfilePanel.tsx` (static stats + heatmap). This adds a full interactive pitcher insights panel with zone grid, metric toggles, and filter controls — same architecture as the hitter side.

### Files to Create

- [x] `web/lib/charting/pitcherInsights.ts`
  - `PitcherInsightPitchRecord` — per-pitch record from pitcher's POV
    - Fields parallel to `HitterInsightPitchRecord`: id, gameId, gameDate, opponent, batterHand, pitchType, pitchResult, locationCell, zoneRow, zoneColumn, isInZone, ballsBefore, strikesBefore, countLabel, countCategory, velocity, velocityBand, isStrike, isCalledStrike, isSwing, isWhiff, isContact, isBall, isBallInPlay, isTerminalPitch, terminalAtBat, terminalStrikeout, terminalWalk, terminalHit, terminalHitByPitch
  - `PitcherInsightMetricId` = "strikePct" | "whiffPct" | "chasePct" | "baa" | "kPct" | "bbPct" | "fpsPct"
  - `PitcherInsightCountCategory` = "all" | "hitter" | "pitcher" | "twoStrike" | "full"
  - `PitcherInsightVelocityBandId` = "lt80" | "80_84" | "85_89" | "90_94" | "95_plus" | "untracked"
  - `PitcherInsightZoneScope` = "all" | "inZone" | "outOfZone"
  - `PitcherInsightAggregate` — parallel to `HitterInsightAggregate`
  - `PitcherPerformanceInsightsData` — parallel to `HitterPerformanceInsightsData`
  - `PitcherInsightsFilters` — parallel to `HitterInsightsFilters` but with `batterHand` instead of `pitcherHand`
  - `buildPitcherPerformanceInsightsData(...)` — builder that takes raw ChartingPitch + ChartingPlateAppearance arrays and returns typed records
  - `filterPitcherInsightPitches(pitches, filters)` — applies filter state
  - `selectPitcherInsightPitches(pitches, selection)` — applies zone/row/column selection
  - `summarizePitcherInsightPitches(pitches)` — returns `PitcherInsightAggregate`
  - `metricValueForAggregate(metric, agg)` — extracts the active metric value
  - Constants: `PITCHER_INSIGHT_METRICS`, `DEFAULT_PITCHER_INSIGHT_FILTERS`

- [x] `web/app/players/[slug]/PitcherPerformanceInsights.tsx`
  - Client component. Props: `{ data: PitcherPerformanceInsightsData }`
  - Layout mirrors `HitterPerformanceInsights.tsx`:
    - Top bar: summary stats (K%, BB%, BABIP, Whiff%, Strike%)
    - Left: zone grid (3x3 in-zone + chase cells), color-coded by active metric per cell, click to select
    - Right: metric toggle buttons, filter controls (pitchType, velocityBand, countCategory, batterHand, zoneScope)
    - Bottom: pitch mix panel (same pattern as hitter insights pitch type breakdown)
    - Chase zone row below the main grid (cells 11-17 range)
  - Metric color direction (opposite of hitter side):
    - strikePct, whiffPct, chasePct, kPct, fpsPct: green = high (pitcher-favorable)
    - baa, bbPct: green = low (pitcher-favorable)
  - Respects both light and dark mode via semantic tokens

### Files to Modify

- [x] `web/lib/charting/playerProfile.ts`
  - Add `buildPitcherPerformanceInsightsData` call in the profile loading path (parallel to existing `buildHitterPerformanceInsightsData` call near line 950)
  - Expose `pitcherInsightsData: PitcherPerformanceInsightsData | null` on `ChartingPlayerProfile`

- [x] `web/app/players/[slug]/PlayerProfileTabs.tsx`
  - Import and render `PitcherPerformanceInsights` in the Charting tab for pitcher/two-way profiles
  - Add a mini toggle "Sessions | Insights" inside the Charting tab
  - "Sessions" = existing `LiveAbProfilePanel` (session list + heatmap)
  - "Insights" = new `PitcherPerformanceInsights` panel

- [x] `web/app/players/[slug]/page.tsx`
  - Pass `pitcherInsightsData` down into `PlayerProfileTabs` props

### Tests to Add
- [x] `web/lib/charting/pitcherInsights.test.ts`
  - Unit tests for `buildPitcherPerformanceInsightsData`, `filterPitcherInsightPitches`, `summarizePitcherInsightPitches`

---

## Feature: Luck Index (Pitcher + Hitter, 100-scale)

**Goal:** A single 100-scale stat per player that quantifies how much luck (good or bad) is embedded in their current results. Separates process metrics (what the player controls) from result metrics (what variance/defense influences). Shown as a badge on player profile pages.

**Core concept:** 100 = neutral. Higher = luckier (results better than process predicts, likely to regress). Lower = unluckier (process better than results, likely to improve).

**No new DB work needed** — all inputs already exist in `AggregatedPitcherStats` / `AggregatedHitterStats`.

### Pitcher Luck Index Formula

Three components combined into a 100-scale score:

```
1. BABIP Component (40% weight)
   baseline = 0.295
   deviation = baseline - actualBABIP   (negative = unlucky: giving up more hits than expected)
   raw = deviation / 0.090              (normalize by ~1 std dev)
   clamp(raw, -2, +2)

2. K%−BB% Process Component (35% weight)
   kdiff = kPct − bbPct (percentage points)
   D3 baseline kdiff ≈ 8 pp
   raw = (kdiff − 8) / 8
   Interpretation: if kdiff is high but BABIP is ALSO high, pitcher is unlucky
   (this component is inverted in the luck direction: higher kdiff = more expected improvement)
   clamp(raw, -2, +2)

3. Strand Rate / LOB% Component (25% weight)  [skip if no RISP data; redistribute weight]
   baseline LOB% ≈ 0.68
   raw = (actualLOB% − 0.68) / 0.08
   Above baseline = lucky (stranding more runners than expected)
   clamp(raw, -2, +2)

final_raw = weighted_sum(components)
score = 100 + (final_raw × 25)
score = clamp(score, 30, 170)
```

### Hitter Luck Index Formula

```
1. BABIP Component (50% weight)
   baseline = 0.295
   deviation = actualBABIP − baseline   (positive = lucky)
   raw = deviation / 0.080
   clamp(raw, -2, +2)

2. Contact/Chase Process Component (30% weight)
   High contact% + low BABIP = unlucky (hard contact not falling in)
   contactPct baseline ≈ 75% for D3
   process_raw = (contactPct − 75) / 12
   divergence = raw_babip − process_raw  (lucky = BABIP higher than contact suggests)
   raw = divergence / 2
   clamp(raw, -2, +2)

3. Walk Rate vs OBP Component (20% weight)
   proxy_obp = avg + (bbPct / 100)      (rough floor expectation)
   raw = (actualOBP − proxy_obp) / 0.04
   High OBP above proxy = luck aiding outcomes
   clamp(raw, -2, +2)

final_raw = weighted_sum(components)
score = 100 + (final_raw × 25)
score = clamp(score, 30, 170)
```

### Confidence Tiers

```
Pitcher:
  null (don't display)   < 30 pitches
  "low"                  30–79 pitches
  "medium"               80–199 pitches
  "high"                 200+ pitches

Hitter:
  null (don't display)   < 8 PAs
  "low"                  8–24 PAs
  "medium"               25–59 PAs
  "high"                 60+ PAs
```

### Score Labels

```
< 70  → "Very Unlucky"
70–85 → "Unlucky"
85–95 → "Slightly Unlucky"
95–105→ "Neutral"
105–115→"Slightly Lucky"
115–130→"Lucky"
> 130 → "Very Lucky"
```

### Badge Color Logic

```
Pitcher:
  Lucky (score > 110):    amber/yellow — warn: results may regress
  Neutral (90–110):       gray/muted
  Unlucky (score < 90):   green — pitcher performing better than results show

Hitter:
  Lucky (score > 110):    green — hitter benefiting from variance
  Neutral (90–110):       gray/muted
  Unlucky (score < 90):   amber/yellow — hitter performing better than results show
```

### Files to Create

- [x] `web/lib/charting/luckIndex.ts`
  - `LuckComponent = { id: string; label: string; weight: number; raw: number; contribution: number }`
  - `LuckIndexResult = { score: number; label: string; direction: "lucky" | "unlucky" | "neutral"; confidence: "low" | "medium" | "high"; components: LuckComponent[] }`
  - `computePitcherLuckIndex(stats: AggregatedPitcherStats): LuckIndexResult | null`
  - `computeHitterLuckIndex(stats: AggregatedHitterStats): LuckIndexResult | null`
  - `luckLabel(score: number): string`
  - `luckBadgeClasses(result: LuckIndexResult, playerType: "pitcher" | "hitter"): string`

- [x] `web/app/components/LuckIndexBadge.tsx`
  - Client component. Props: `{ result: LuckIndexResult; playerType: "pitcher" | "hitter"; showBreakdown?: boolean }`
  - Compact pill: score + label + confidence dot
  - Optional `showBreakdown` accordion/tooltip: lists each component and its contribution

### Files to Modify

- [x] `web/app/players/[slug]/page.tsx`
  - Compute luck index using existing aggregated stats (already loaded — zero extra DB calls)
  - Pass `pitcherLuckIndex: LuckIndexResult | null` and `hitterLuckIndex: LuckIndexResult | null` to `PlayerProfileTabs`

- [x] `web/app/players/[slug]/PlayerProfileTabs.tsx`
  - Render `LuckIndexBadge` in the Overview tab beside BABIP in the season stats area
  - For pitchers: show alongside pitching stats
  - For hitters: show alongside hitting stats

### Tests to Add
- [ ] `web/lib/charting/luckIndex.test.ts`
  - Neutral case: BABIP at baseline → score ≈ 100
  - Lucky pitcher: BABIP = .240, K%−BB% = 18 pp → score > 110
  - Unlucky hitter: BABIP = .240, contact% = 82%, OBP = .290 → score < 90
  - Insufficient sample → returns null
  - Clamp: extreme inputs stay within [30, 170]

---

## Open Questions (resolve before implementing)

1. **Pitcher Insights sub-tab:** Confirmed plan is mini toggle "Sessions | Insights" inside the Charting tab. Needs user sign-off before building.

2. **LOB% availability:** ✅ Confirmed — `runnerOnSecond` / `runnerOnThird` on `ChartingPlateAppearance` are reliably populated. Use full 3-component formula: BABIP 40%, K%−BB% 35%, LOB% 25%.

3. **Luck index on leaderboard:** Deferred. Add as follow-on task after player-page implementation is validated.

4. **Direction framing:** Luck index always from the *player's own perspective* (score > 100 = that player got lucky, regardless of whether that's good or bad for the team).
