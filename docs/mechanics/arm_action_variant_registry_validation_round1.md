# Arm Action Variant Registry Validation Round 1

Date: 2026-03-18

## Goal

Validate the new arm-action variant registry against the repo's actual public-data ingest path and the current local TrackMan label surface.

This round answers a narrower question than the research matrix:

- Which variant labels survive the current Savant ingest unchanged?
- Which variants are collapsed or dropped by repo code?
- Which variants do not exist in the current local TrackMan label surface at all?

## Status Note

This document records the pre-fix baseline that motivated the next ingest change.

Later on 2026-03-18, the local repo was updated so [`scripts/sync_savant_comps.py`](/Users/traftonobrien/Desktop/pitch-tracker/scripts/sync_savant_comps.py) now fetches `SV` / `FO` and preserves raw `pitchTypeCode` / `pitchTypeName` in [`mlb_pitch_comps.json`](/Users/traftonobrien/Desktop/pitch-tracker/web/public/data/mlb_pitch_comps.json).

This doc is still useful because it captures what the old pipeline was losing and why that ingest change was necessary.

## Scope

Validation target:

- public ingest path: [`scripts/sync_savant_comps.py`](/Users/traftonobrien/Desktop/pitch-tracker/scripts/sync_savant_comps.py)
- current public output: [`web/public/data/mlb_pitch_comps.json`](/Users/traftonobrien/Desktop/pitch-tracker/web/public/data/mlb_pitch_comps.json)
- local TrackMan surface: [`web/public/trackman/sessions/`](/Users/traftonobrien/Desktop/pitch-tracker/web/public/trackman/sessions)

Important limit:

- There is no same-player overlap between local Babson TrackMan sessions and MLB Statcast pitchers, so this is a pipeline-label validation, not a same-pitcher movement validation.

## Executive Findings

1. The repo's current MLB comps ingest preserves `Sweeper`, but it does not preserve `Slurve` or `Forkball`.
2. The public Savant pitch-movement source used by the repo does expose `SV` / `Slurve` and `FO` / `Forkball` right now, but [`scripts/sync_savant_comps.py`](/Users/traftonobrien/Desktop/pitch-tracker/scripts/sync_savant_comps.py) never fetches those pitch types, so they vanish from [`mlb_pitch_comps.json`](/Users/traftonobrien/Desktop/pitch-tracker/web/public/data/mlb_pitch_comps.json).
3. `Knuckle Curve` is coded as a collapse rule in the ingest (`"KC": "Curveball"`), but the specific Savant pitch-movement endpoint returned zero `KC` rows for 2023, 2024, and 2025 in both handedness buckets during this validation pass.
4. `Slow Curve` also returned zero rows from the same Savant surface for 2023, 2024, and 2025 in both handedness buckets.
5. Local TrackMan sessions currently use only generic labels: `Fastball`, `Sinker`, `Cutter`, `Slider`, `Curveball`, `Splitter`, `ChangeUp`, and `Other`. There are no local `Sweeper`, `Knuckle Curve`, `Slurve`, `Forkball`, or `Slow Curve` labels today.

## Current Repo Ingest Behavior

The current public MLB comps sync script fetches only these Savant abbreviations:

```python
PITCH_TYPE_MAP = {
    "FF": "Fastball",
    "SI": "Sinker",
    "FC": "Cutter",
    "FS": "Splitter",
    "CH": "Changeup",
    "CU": "Curveball",
    "SL": "Slider",
    "ST": "Sweeper",
    "KC": "Curveball",
}
```

Implications from that map:

- `ST` is preserved as `Sweeper`
- `KC` is collapsed to `Curveball`
- `SV`, `CS`, and `FO` are never fetched

Source:

- [`scripts/sync_savant_comps.py`](/Users/traftonobrien/Desktop/pitch-tracker/scripts/sync_savant_comps.py)

## Public Source Validation

These checks used the same Savant pitch-movement CSV endpoint the repo script calls.

### 1. Sweeper survives

Live public source:

- `ST` / `Sweeper` returned 257 RHP rows and 84 LHP rows for 2025 at `min=1`
- sample pitcher: Logan Webb (`657277`) with `ST` / `Sweeper`, `873` pitches

Repo output:

- [`mlb_pitch_comps.json`](/Users/traftonobrien/Desktop/pitch-tracker/web/public/data/mlb_pitch_comps.json) preserves Logan Webb's pitch as `Sweeper`

Conclusion:

- `Sweeper` survives the current ingest path unchanged

### 2. Slurve exists publicly but is dropped by repo ingest

Live public source:

- `SV` / `Slurve` returned 19 RHP rows and 6 LHP rows for 2025 at `min=1`
- sample pitcher: José Berríos (`621244`) with `SV` / `Slurve`, `670` pitches

Repo output:

- José Berríos appears in [`mlb_pitch_comps.json`](/Users/traftonobrien/Desktop/pitch-tracker/web/public/data/mlb_pitch_comps.json), but there is no `Slurve` pitch entry for him
- his public-comp rows are only `Fastball`, `Sinker`, `Cutter`, and `Changeup`

Conclusion:

- `Slurve` is available in the public source but dropped by current repo ingest because `SV` is never fetched

### 3. Forkball exists publicly but is dropped by repo ingest

Live public source:

- `FO` / `Forkball` returned 1 RHP row and 0 LHP rows for 2025 at `min=1`
- sample pitcher: Kodai Senga (`673540`) with `FO` / `Forkball`, `542` pitches

Repo output:

- Kodai Senga appears in [`mlb_pitch_comps.json`](/Users/traftonobrien/Desktop/pitch-tracker/web/public/data/mlb_pitch_comps.json), but there is no `Forkball` pitch entry for him

Conclusion:

- `Forkball` is available in the public source but dropped by current repo ingest because `FO` is never fetched

### 4. Knuckle Curve and Slow Curve are not currently available from this Savant surface

Live public source:

- `KC` returned `0` rows for 2023, 2024, and 2025 across both `R` and `L`
- `CS` returned `0` rows for 2023, 2024, and 2025 across both `R` and `L`

Repo code:

- `KC` is still mapped to `Curveball` in [`scripts/sync_savant_comps.py`](/Users/traftonobrien/Desktop/pitch-tracker/scripts/sync_savant_comps.py)

Conclusion:

- `KC` is a coded collapse rule, but it is not currently observable on this public pitch-movement endpoint
- `CS` is neither fetched nor present on this public pitch-movement endpoint
- if the project needs `Knuckle Curve` or `Slow Curve`, the pitch-movement leaderboard endpoint is likely the wrong public source

## Local TrackMan Label Validation

Aggregating all current local TrackMan session `pitch_types.json` files yielded only these labels:

| Local label | Session count |
|---|---:|
| `Fastball` | 62 |
| `Slider` | 50 |
| `Other` | 65 |
| `Curveball` | 15 |
| `Sinker` | 12 |
| `ChangeUp` | 8 |
| `Splitter` | 8 |
| `Cutter` | 5 |

Direct variant checks:

- `Sweeper`: 0 local sessions
- `Knuckle Curve`: 0 local sessions
- `Slurve`: 0 local sessions
- `Forkball`: 0 local sessions
- `Slow Curve`: 0 local sessions

Conclusion:

- local TrackMan data is still variant-poor
- the registry cannot rely on local raw labels for those variants yet
- local variant handling will have to come from metadata, rationale logic, or future ingest improvements rather than current TrackMan label strings

## Registry Outcome By Variant

| Variant | Public source status | Current repo ingest status | Local TrackMan label status | Round-1 decision |
|---|---|---|---|---|
| `Sweeper` | present | preserved | absent | safe public variant |
| `Slurve` | present | dropped | absent | add public ingest support before engine use |
| `Forkball` | present | dropped | absent | add public ingest support before engine use |
| `Knuckle Curve` | not observed on this Savant surface | coded to collapse to `Curveball` | absent | needs different public source or raw Statcast route |
| `Slow Curve` | not observed on this Savant surface | not fetched | absent | needs different public source or raw Statcast route |

## Recommended Next Step

1. Update the public research ingest to preserve raw public label provenance:
   - store `pitch_type_code`
   - store `pitch_type_name`
   - keep canonical family separately
2. Extend the Savant comps fetch list to include `SV` and `FO`
3. Do not spend time on `KC` or `CS` in this ingest path until a raw-Statcast or alternate public source is chosen
4. Keep the local TrackMan side generic for now, but normalize `ChangeUp` -> `Changeup` if the registry ever becomes app-facing
