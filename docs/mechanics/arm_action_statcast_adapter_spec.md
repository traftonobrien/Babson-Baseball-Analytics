# Arm Action Statcast Adapter Spec

Date: 2026-03-18

## Goal

Define the adapter contract that would let public Statcast data surfaces support the arm-action knowledge base without changing the current TrackMan-first engine semantics.

This is a spec only. No production code should use it until the unresolved field-semantics questions are verified.

## Verified Local Contract

From the current repo:

- `avgHb` is TrackMan-style horizontal break
- `avgIvb` is TrackMan-style induced vertical break
- `avgRelHeight` and `avgRelSide` are release position inputs
- `avgSpinAxis2d` is the 2D spin axis used by the arm-action classifier
- horizontal sign convention is:
  - positive HB = toward first base
  - negative HB = toward third base
- arm-side conversion happens later via handedness:
  - RHP arm-side = positive HB
  - LHP arm-side = negative HB

Relevant local references:

- [web/lib/trackman/metrics.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/trackman/metrics.ts)
- [web/lib/trackman/armAction.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/trackman/armAction.ts)
- [web/lib/mlbPitchAverages.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/mlbPitchAverages.ts)
- [docs/architecture/coordinates_and_handedness.md](/Users/traftonobrien/Desktop/pitch-tracker/docs/architecture/coordinates_and_handedness.md)

## Verified Public Fields

From `baseballr::statcast_search()` and the related payload processing docs:

- `pitch_type`
- `pitch_name`
- `release_speed`
- `release_spin_rate`
- `release_extension`
- `release_pos_x`
- `release_pos_y`
- `release_pos_z`
- `spin_axis`
- `pfx_x`
- `pfx_z`
- `stand`
- `p_throws`
- `api_break_z_with_gravity`
- `api_break_x_arm`
- `api_break_x_batter_in`

Primary public references:

- [BillPetti/baseballr `R/sc_statcast_search.R`](https://github.com/BillPetti/baseballr/blob/master/R/sc_statcast_search.R)
- [BillPetti/baseballr `R/sch_process_statcast_payload.R`](https://github.com/BillPetti/baseballr/blob/master/R/sch_process_statcast_payload.R)
- [jldbc/pybaseball `docs/statcast.md`](https://github.com/jldbc/pybaseball/blob/master/docs/statcast.md)
- [jldbc/pybaseball `docs/statcast_pitcher.md`](https://github.com/jldbc/pybaseball/blob/master/docs/statcast_pitcher.md)

## Adapter Output Contract

Public Statcast rows should be converted into this intermediate research contract:

```ts
type ResearchPitchRow = {
  source: "statcast-public";
  pitchTypeRaw: string | null;
  pitchNameRaw: string | null;
  pitchFamily: string | null;
  throws: "R" | "L" | null;
  stands: "R" | "L" | "S" | null;
  mph: number | null;
  rpm: number | null;
  extensionFt: number | null;
  relHeightFt: number | null;
  relSideFt: number | null;
  spinAxis2d: number | null;
  hbIn: number | null;
  ivbIn: number | null;
  hbSource: string | null;
  ivbSource: string | null;
  notes: string[];
};
```

This contract is intentionally close to the current `TrackmanPitch` / `TrackmanPitchTypeSummary` fields, but it keeps source provenance and uncertainty attached.

## Preferred Field Mapping

### Safe direct mappings

These are verified enough to map directly:

- `mph <- release_speed`
- `rpm <- release_spin_rate`
- `extensionFt <- release_extension`
- `relHeightFt <- release_pos_z`
- `relSideFt <- release_pos_x`
- `spinAxis2d <- spin_axis`
- `throws <- p_throws`
- `stands <- stand`
- `pitchNameRaw <- pitch_name`
- `pitchTypeRaw <- pitch_type`

### Family normalization

Pitch family normalization should continue using the local alias model in:

- [web/lib/mlbPitchAverages.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/mlbPitchAverages.ts)

Initial family priority:

1. normalize `pitch_name`
2. if missing, normalize `pitch_type`
3. if neither maps cleanly, set `pitchFamily = null` and preserve raw labels

## Movement Mapping Policy

This is the critical section.

### Rule 1

Do not map public Statcast movement fields directly into production `hb` / `ivb` without preserving provenance and verification notes.

### Rule 2

The adapter should prefer already-normalized inch-based fields if their semantics are verified.

### Proposed priority order

#### Horizontal break candidate order

1. verified inch-based horizontal field
   - candidate: `api_break_x_batter_in`
2. verified pitcher-perspective arm-side field
   - candidate: `api_break_x_arm`
3. raw movement fallback
   - candidate: `pfx_x`

#### Vertical break candidate order

1. verified inch-based vertical field
   - candidate: `api_break_z_with_gravity`
2. raw movement fallback
   - candidate: `pfx_z`

### Conservative default

Until semantics are officially verified:

- treat `api_break_*` fields as promising but unverified
- treat `pfx_x` / `pfx_z` as raw fallback only
- store the chosen source field in `hbSource` / `ivbSource`
- attach notes when units or sign are inferred rather than verified

## Initial Conversion Rules

These are acceptable as research-only defaults, not production guarantees.

### Research-only default formula

```ts
hbIn =
  api_break_x_batter_in ?? inferredPfxXInches ?? null;

ivbIn =
  api_break_z_with_gravity ?? inferredPfxZInches ?? null;
```

Where:

- `inferredPfxXInches = pfx_x * 12`
- `inferredPfxZInches = pfx_z * 12`

Inference status:

- the multiply-by-12 fallback is a reasonable research assumption because `pfx_*` is typically exposed in feet on Savant-style payloads
- this must still be verified against official field documentation before any production use

### Handedness rule

Do not arm-side-normalize `hbIn` inside the adapter.

Keep `hbIn` in the same base-side coordinate system as the local TrackMan contract:

- positive = toward first base
- negative = toward third base

Then let downstream logic continue to do:

```ts
armSideHb = throws === "R" ? hbIn : -hbIn;
```

Reason:

This matches the existing local classifier behavior and avoids hidden double-flips.

## Pitch-Type Aggregation Spec

Once rows are adapted, aggregate them by normalized pitch family:

```ts
type ResearchPitchTypeSummary = {
  pitchFamily: string;
  count: number;
  avgVelo: number | null;
  avgSpin: number | null;
  avgExtension: number | null;
  avgRelHeight: number | null;
  avgRelSide: number | null;
  avgSpinAxis2d: number | null;
  avgHb: number | null;
  avgIvb: number | null;
  sourceMix: string[];
  verificationNotes: string[];
};
```

Aggregation rules:

- average only verified numeric rows
- keep per-field provenance, not just per-row provenance
- if movement fields use fallback inference, tag the summary as inferred

## Required Validation Checks

Before this adapter is trusted:

1. Compare adapted `hbIn` and `ivbIn` against at least one known TrackMan session for the same pitcher/pitch type.
2. Verify that handedness conversion reproduces the current local behavior:
   - RHP positive HB reads arm-side
   - LHP negative HB reads arm-side
3. Verify that pitch-family normalization maps Statcast labels into the current eight-family canon without collapsing meaningful variants.
4. Verify that `spin_axis` orientation is compatible with the current `avgSpinAxis2d` expectations in `armAction.ts`.

## Known Unresolved Questions

These are still open:

1. Is `api_break_x_batter_in` the best direct source for local `hb`, or does it embed a handedness/view transform we should avoid?
2. Does `api_break_z_with_gravity` match our intended IVB semantics closely enough, or is it a different vertical-break definition?
3. Do `pfx_x` and `pfx_z` remain stable enough across current Savant payloads to serve as a safe fallback?
4. Should public Statcast summaries populate the existing `TrackmanPitchTypeSummary` directly, or should the knowledge base keep a separate public-data contract?

## Recommendation

Use this adapter spec as the bridge layer for research only.

The next concrete step should be:

1. verify the field semantics against official Statcast docs once Tavily is authenticated
2. create a small comparison table using one or two pitchers and known local sessions
3. only then promote this spec into code
