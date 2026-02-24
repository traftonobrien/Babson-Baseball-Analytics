# TrackMan Outing Averages Export

## Source Data

TrackMan session summaries are read recursively from:

- `web/public/trackman/session` (CLI default)

The current repo data is in:

- `web/public/trackman/sessions` (plural)

The exporter automatically falls back from `/session` to `/sessions` when needed.

Expected folder pattern:

- `web/public/trackman/session/<player_id>/<date>/<session_slug>/session_summary.json`

## Run

All players:

```bash
python3 scripts/export_trackman_outing_averages.py --root web/public/trackman/sessions
```

Single player:

```bash
python3 scripts/export_trackman_outing_averages.py --root web/public/trackman/sessions --player teator_zander
```

Custom output directory:

```bash
python3 scripts/export_trackman_outing_averages.py --root web/public/trackman/sessions --outdir output/exports
```

## Outputs

- `output/exports/trackman_outing_averages.csv`
- `output/exports/trackman_outing_pitchtype_averages.csv`

## Outing CSV Schema

One row per session:

- `player_id`
- `date`
- `session_slug`
- `session_key` (`player_id/date/session_slug`)
- `n_pitches`
- `avg_velo_mph`
- `avg_ivb_in`
- `avg_hb_in`
- `avg_spin_rpm`
- `avg_ext_ft`
- `avg_rel_height_ft`
- `avg_rel_side_ft`
- `includes_other_unknown`
- `count_weights_missing`
- `pitchtype_breakdown_found`
- `pitchtype_source_key`
- `weighting_method`
- optional metadata (when found in sibling `meta.json`):
  - `player_name`
  - `player_slug`
  - `team`
  - `handedness`
  - `hand`
  - `level`
  - `session_date`
  - `session_label`
  - `report_url`
  - `source_type`

## Pitch-Type CSV Schema

One row per `(player_id, date, session_slug, pitch_type)`:

- `player_id`
- `date`
- `session_slug`
- `session_key`
- `pitch_type`
- `n_pitches`
- `avg_velo_mph`
- `avg_ivb_in`
- `avg_hb_in`
- `avg_spin_rpm`
- `avg_ext_ft`
- `avg_rel_height_ft`
- `avg_rel_side_ft`
- `pitchtype_source_key`
- optional metadata columns listed above

## Pitch-Type Detection Logic

The script checks for pitch-type breakdowns in this order:

1. `pitch_types`
2. `by_pitch_type`
3. `arsenal`
4. `pitches_by_type`
5. any top-level key containing both `pitch` and `type` that is a list/dict
6. repo-specific fallback: `per_type`

If none are usable, it falls back to session-level summary metrics and sets:

- `pitchtype_breakdown_found=false`
- `weighting_method=session_level_fallback`
- `includes_other_unknown=true`

## Stat Mapping

Normalized output metrics map from common key variants:

- `avg_velo_mph`: `velo`, `rel_speed`, `release_speed`, `velocity`, etc.
- `avg_ivb_in`: `ivb`, `induced_vert_break`, `induced_vertical_break`, etc.
- `avg_hb_in`: `hb`, `horz_break`, `horizontal_break`, etc.
- `avg_spin_rpm`: `spin`, `spin_rate`, `rpm`, etc.
- `avg_ext_ft`: `ext`, `extension`, etc.
- `avg_rel_height_ft`: `rel_height`, `release_height`, `vrel`, etc.
- `avg_rel_side_ft`: `rel_side`, `release_side`, `hrel`, etc.

## IMPORTANT: OTHER Is Always Excluded

Pitch type `OTHER` is excluded everywhere (case-insensitive trim):

- outing/session aggregates
- pitch-type-by-session export rows

## Weighted Average Behavior

- If pitch-type counts are present, session metrics are true weighted averages.
- If pitch-type rows exist but counts are missing, the script computes unweighted means across non-`OTHER` pitch types and marks:
  - `weighting_method=unweighted_no_counts`
  - `count_weights_missing=true`
  - `n_pitches` as `NaN`
