---
name: Lefty lane flip (dx+Arsenals)
overview: Fix the web app so arm-side vs glove-side labeling, lane bucketing, and derived direction strings always respect pitcher handedness resolved from `web/public/data/Arsenals.csv` by `playerId`. Never trust `pitcher_hand` in pitch CSVs; do not overwrite stored numeric fields—derive needed signed/normalized values at runtime from dx and handedness. Add Vitest tests and update handedness docs.
todos:
  - id: handedness-core
    content: Extend `web/lib/handedness.ts` with Arsenals-based hand resolution and dx-based lane helpers.
    status: pending
  - id: hooks-thread-hand
    content: Update `usePitchData` and `useAllPitchData` to return `{pitches, pitcherHand, loading, error}` and accept `playerId`.
    status: pending
  - id: reportmodel-dx-based
    content: Refactor `web/lib/reportModel.ts` to accept `pitcherHand` param and derive lane/direction metrics from dx + hand (no pitch.pitcher_hand).
    status: pending
  - id: ui-components
    content: Thread `pitcherHand` through PlayerDashboard/report/compare and update viz components to use dx-based helpers.
    status: pending
  - id: vitest-tests
    content: Add Vitest config/scripts and implement unit + integration-ish handedness/lane flip tests.
    status: pending
  - id: docs-update
    content: Update `docs/architecture/coordinates_and_handedness.md` with web algorithm and fallback behavior.
    status: pending
  - id: verify
    content: Run `npm --prefix web run build` and `npm --prefix web run test` to confirm acceptance criteria.
    status: pending
isProject: false
---

## Where the bug currently happens (exact files/functions)

- **Report model incorrectly trusts pitch CSV handedness + signed numbers**
  - `[web/lib/reportModel.ts](web/lib/reportModel.ts)`
    - `buildReport()` derives `pitcherHand` from `allPitches[0]?.pitcher_hand`.
    - `laneOf(p)` reads `p.pitcher_hand` and classifies using `toArmSideX(p.h_miss_signed, hand)`.
    - Multiple aggregates (`avgHSigned`, `overallHSigned`, etc.) use `p.h_miss_signed` directly, which can have the wrong sign if the pitch CSV hand is wrong.
- **UI + components use the same incorrect assumptions**
  - `[web/app/player/[playerId]/PlayerDashboard.tsx](web/app/player/[playerId]/PlayerDashboard.tsx)` filters by `laneOf(p)` (which currently reads `pitch.pitcher_hand`).
  - `[web/app/components/StrikeZoneScatter.tsx](web/app/components/StrikeZoneScatter.tsx)`, `[web/app/components/MissHeatmap.tsx](web/app/components/MissHeatmap.tsx)`, `[web/app/components/LaneReport.tsx](web/app/components/LaneReport.tsx)` compute horizontal semantics from `h_miss_signed` via `toArmSideX(...)`.
- **Correct handedness source already exists but is not used consistently**
  - `[web/lib/arsenals.ts](web/lib/arsenals.ts)` loads `/data/Arsenals.csv` and can look up `pitcher_hand` by `playerId`.

## Single source of truth module to create/use

- **Extend** `[web/lib/handedness.ts](web/lib/handedness.ts)` to be the only place that:
  - Resolves pitcher hand from Arsenals
  - Implements the dx truth table
  - Produces derived values used by all lane bucketing and direction labels

Add exports (per requirements):

- `export type PitcherHand = "R" | "L" | "U"`
- `export async function getPitcherHand(playerId: string): Promise<PitcherHand>`
  - Uses `getPlayerMeta(playerId)` from `[web/lib/arsenals.ts](web/lib/arsenals.ts)`.
  - Accept only `"R" | "L"`; otherwise dev-warn and **fallback to `"R"**`.
- `export function armSideFromDx(dxPx: number, hand: PitcherHand): "arm" | "glove" | "middle"`
  - Canonical formula: `arm_sign = +1 for R, -1 for L`; `dxPx * arm_sign > 0 => arm-side`.
  - `dxPx === 0 => middle`.
- `export function armSideXFromDx(dxPx: number, magInches: number, hand: PitcherHand): number`
  - Returns **arm-side-positive inches**.
  - Implementation idea (pure):
    - `signedDxIn = Math.sign(dxPx) * magInches` (use `dxPx` for sign, `magInches` for magnitude)
    - `arm_sign = hand === "L" ? -1 : 1` (treat `"U"` as `"R"`)
    - `return signedDxIn * arm_sign`

Additional pure helper (internal or exported) to avoid touching stored fields:

- `hMissSignedDerivedFromDx(dxPx, magInches, hand): number` with sign convention **negative=arm-side, positive=glove-side**, derived from `armSideFromDx`.

## Minimal set of callsites to update (no duplicated logic)

### Hooks (resolve hand once; never mutate pitch objects)

- `[web/app/hooks/usePitchData.ts](web/app/hooks/usePitchData.ts)`
  - Change signature to `usePitchData(playerId: string, csvPath: string)`.
  - Resolve `pitcherHand = await getPitcherHand(playerId)`.
  - Return `{ pitches, pitcherHand, loading, error }`.
- `[web/app/hooks/useAllPitchData.ts](web/app/hooks/useAllPitchData.ts)`
  - Change signature to `useAllPitchData(playerId: string, csvPaths: string[])`.
  - Resolve `pitcherHand` once.
  - Return `{ pitches, pitcherHand, loading, error }`.

### Report model (stop reading `pitch.pitcher_hand`; stop trusting `h_miss_signed` sign)

- `[web/lib/reportModel.ts](web/lib/reportModel.ts)`
  - Change `buildReport(...)` to accept `pitcherHand: PitcherHand` and store it into `meta.pitcherHand`.
  - Change `laneOf` to `laneOf(p: Pitch, pitcherHand: PitcherHand)`.
  - Replace horizontal lane bucketing to use derived `armSideXFromDx(dxPx, magInches, pitcherHand)` where:
    - `dxPx = p.ball_x - p.target_x`
    - `magInches = finite(p.h_miss_inches) ? p.h_miss_inches : Math.abs(p.h_miss_signed)`
  - Replace any arm/glove direction strings to use derived `armSideX` passed into `hDirectionLabel(armSideX)`.
  - For aggregates that represent signed horizontal direction (`avgHSigned`, `overallHSigned`, etc.), compute using **derived** signed values (e.g. `hMissSignedDerivedFromDx`) so summaries and trends flip correctly for lefties.

### UI pages (thread `playerId` into hooks; thread `pitcherHand` everywhere)

- `[web/app/player/[playerId]/PlayerDashboard.tsx](web/app/player/[playerId]/PlayerDashboard.tsx)`
  - Use `usePitchData(playerId, outing.csvPath)`.
  - Use returned `pitcherHand` for all viz components and lane filtering.
- `[web/app/player/[playerId]/report/page.tsx](web/app/player/[playerId]/report/page.tsx)`
  - Use `useAllPitchData(playerId, csvPaths)`.
  - Call `buildReport(pitches, ..., pitcherHand, options)`.
- `[web/app/player/[playerId]/compare/page.tsx](web/app/player/[playerId]/compare/page.tsx)`
  - Use `useAllPitchData(playerId, csvPathsA/B)`.
  - Call `buildReport(..., pitcherHandA/B, options)`.
  - Ensure compare logic uses Arsenals-resolved hands (no pitch-CSV hand).

### Components (stop using `toArmSideX(p.h_miss_signed, hand)`)

- `[web/app/components/StrikeZoneScatter.tsx](web/app/components/StrikeZoneScatter.tsx)`
  - Compute x position from derived `armSideXFromDx(p.ball_x - p.target_x, magInches, pitcherHand)`.
- `[web/app/components/MissHeatmap.tsx](web/app/components/MissHeatmap.tsx)`
  - Same change for horizontal field bucketing.
- `[web/app/components/LaneReport.tsx](web/app/components/LaneReport.tsx)`
  - Lane classification uses derived `armSideXFromDx`.
  - Horizontal direction labels for averages use derived signed values/direction.
- Also check `[web/app/components/Heatmap.tsx](web/app/components/Heatmap.tsx)` and update if it’s still used for horizontal bucketing.

## Tests (Vitest)

- Add Vitest to `[web/package.json](web/package.json)` with scripts:
  - `test`: `vitest run`
  - `test:watch`: `vitest`
- Add `vitest.config.ts` in `web/` (node environment is sufficient).

### Unit tests

- `web/lib/handedness.test.ts`
  - Assert truth table:
    - R: dx>0 → arm-side, dx<0 → glove-side
    - L: dx>0 → glove-side, dx<0 → arm-side
  - Assert `armSideXFromDx` sign flips between R/L for same `dxPx` and `magInches`.

### Integration-ish

- `web/lib/reportModel.handedness.test.ts`
  - Create a small pitch list with known `ball_x`, `target_x`, `h_miss_inches`.
  - Run `buildReport(..., pitcherHand="R")` vs `buildReport(..., pitcherHand="L")`.
  - Assert `lanesDetailed` counts swap between `Arm` and `Glove`.

## Documentation update

- Update `[docs/architecture/coordinates_and_handedness.md](docs/architecture/coordinates_and_handedness.md)`:
  - Add/replace web section: **Arsenals is the source of truth** for pitcher hand in the web app.
  - Web algorithm (exact):
    - `dx = ball_x - target_x`
    - `arm_sign = 1 if hand=="R" else -1`
    - arm/glove label from `dx * arm_sign`
    - lane bucketing uses `armSideXFromDx(dx, h_miss_inches, hand)` (arm-side-positive inches)
  - Fallback behavior: unknown/missing hand → warn in dev, treat as R.

## Manual verification checklist

- **CBurrows1 (LHP)**:
  - A pitch with `ball_x - target_x < 0` is labeled **arm-side**.
  - Lane labels show `Arm (3B)` and `Glove (1B)`.
- **DJames1 (RHP)**: unchanged behavior.
- **Compare page**: lane labels + bucketing correct and stable.
- **Build**: `npm --prefix web run build`.
- **Tests**: `npm --prefix web run test`.

