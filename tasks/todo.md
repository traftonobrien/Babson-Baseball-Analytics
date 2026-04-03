# Pitch Tracker — Task Board

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
- [ ] `web/lib/charting/pitcherInsights.test.ts`
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
