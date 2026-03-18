# Arm Action Research Round 1

Date: 2026-03-18

## Goal

Build the first durable knowledge-base plan for expanding pitch suggestions beyond the current `armAction.ts` heuristics, using public GitHub repos as the initial evidence base.

This round is intentionally repo-first:

- inventory public baseball data surfaces
- inventory public biomechanics surfaces
- map those surfaces onto our current app contract
- define the schema the knowledge base should use before we add more pitch suggestions

## Source Repos

- [jldbc/pybaseball](https://github.com/jldbc/pybaseball)
- [BillPetti/baseballr](https://github.com/BillPetti/baseballr)
- [drivelineresearch/openbiomechanics](https://github.com/drivelineresearch/openbiomechanics)
- [PitchingBot/PitcherMotion](https://github.com/PitchingBot/PitcherMotion)
- [tnestico/pitching_summary](https://github.com/tnestico/pitching_summary)

## Executive Takeaways

1. `pybaseball` and `baseballr` are the two core public data repos for this feature area. They expose the pitch-level Statcast surfaces and Savant leaderboard helpers we need for public-data-backed movement archetypes.
2. `openbiomechanics` is the strongest public mechanics repo, but it is not a production dependency candidate. It is best treated as research context for arm-slot and kinematic priors.
3. Our current arm-action engine is built on TrackMan-style aggregate fields:
   - `avgHb`
   - `avgIvb`
   - `avgRelHeight`
   - `avgRelSide`
   - `avgSpinAxis2d`
   - `pitchType`
4. Public Statcast repos expose enough raw material to support a richer knowledge base, but not with our current contract directly. We need an adapter layer before those repos can feed suggestion logic.
5. Inference from the repo surfaces: the knowledge base should model pitch `family` and pitch `variant` separately. Public repos usually expose high-level pitch labels; our recommendation copy often needs more specific variants like gyro slider, kick change, or spike curve.

Follow-on docs:

- [`arm_action_statcast_adapter_spec.md`](arm_action_statcast_adapter_spec.md) — bridge spec for public Statcast movement into the local TrackMan-shaped contract
- [`arm_action_pitch_variant_matrix.md`](arm_action_pitch_variant_matrix.md) — public label taxonomy, separability rules, and candidate variant matrix

## Repo Inventory

### 1. pybaseball

Repo: [jldbc/pybaseball](https://github.com/jldbc/pybaseball)

Why it matters:

- strongest public Python package for Statcast, FanGraphs, and Baseball Reference access
- exposes both raw pitch-level Statcast pulls and Savant-derived pitcher leaderboards
- useful if we want reproducible offline research notebooks or feature-generation scripts

High-value exported functions for this project:

- `statcast`
- `statcast_pitcher`
- `statcast_pitcher_pitch_arsenal`
- `statcast_pitcher_arsenal_stats`
- `statcast_pitcher_pitch_movement`
- `statcast_pitcher_active_spin`
- `statcast_pitcher_spin_dir_comp`
- `statcast_pitcher_run_value`

Round-1 relevance:

- `statcast` and `statcast_pitcher` expose raw pitch-level data
- `pitch_arsenal`, `arsenal_stats`, `pitch_movement`, and `active_spin` expose higher-level pitcher arsenal patterns
- `spin_dir_comp` is directly relevant to pitch-pair compatibility and movement separation

### 2. baseballr

Repo: [BillPetti/baseballr](https://github.com/BillPetti/baseballr)

Why it matters:

- best R-native public package for baseball analysis
- especially relevant because this repo already uses R for other production pipelines
- exposes both raw Statcast search and Savant leaderboard helpers

High-value exported functions for this project:

- `statcast_search`
- `statcast_search_batters`
- `statcast_search_pitchers`
- `scrape_statcast_savant`
- `scrape_statcast_savant_batter`
- `scrape_statcast_savant_batter_all`
- `scrape_statcast_savant_pitcher`
- `scrape_statcast_savant_pitcher_all`
- `statcast_leaderboards`
- `linear_weights_savant`
- `mlb_pitch_codes`
- `mlb_pitch_types`

Round-1 relevance:

- `statcast_search` is the clearest raw payload contract in this repo
- `statcast_leaderboards` is the easiest public path to arsenal and movement summary tables
- `mlb_pitch_codes` and `mlb_pitch_types` are useful normalization references for variant handling

### 3. openbiomechanics

Repo: [drivelineresearch/openbiomechanics](https://github.com/drivelineresearch/openbiomechanics)

Why it matters:

- strongest public biomechanics source in the set
- useful for arm-slot priors, release-pattern reasoning, and kinematic constraints

Round-1 constraints:

- license is `CC BY-NC-SA 4.0`
- README includes additional restrictions around professional sports organization use
- should be treated as research context, not a production dataset dependency

Best use here:

- inform slot and movement plausibility priors
- inform future cue/risk copy
- not feed direct production inference or redistributed data artifacts

### 4. PitcherMotion

Repo: [PitchingBot/PitcherMotion](https://github.com/PitchingBot/PitcherMotion)

Why it matters:

- gives a public pose-tracking-shaped baseball dataset
- useful as a secondary reference for frame-normalized motion analysis

Limit:

- smaller, older, and narrower than `openbiomechanics`

### 5. pitching_summary

Repo: [tnestico/pitching_summary](https://github.com/tnestico/pitching_summary)

Why it matters:

- good reference for analyst-facing outputs built on Statcast
- useful for downstream presentation ideas, not core arm-action logic

## Public Data Surfaces

### pybaseball raw Statcast surface

Documented in:

- [docs/statcast.md](https://github.com/jldbc/pybaseball/blob/master/docs/statcast.md)
- [docs/statcast_pitcher.md](https://github.com/jldbc/pybaseball/blob/master/docs/statcast_pitcher.md)

Core raw fields visible from the docs:

- `pitch_type`
- `pitch_name`
- `release_speed`
- `release_pos_x`
- `release_pos_y`
- `release_pos_z`
- `release_spin_rate`
- `release_extension`
- `spin_axis`
- `pfx_x`
- `pfx_z`
- `plate_x`
- `plate_z`
- `vx0`
- `vy0`
- `vz0`
- `ax`
- `ay`
- `az`
- contextual state fields like inning, score, runners, batter/pitcher handedness

High-value pybaseball summary surfaces:

- pitch movement
- pitch arsenal composition
- arsenal outcome stats
- active spin
- spin-direction comparison
- run value

Implication:

`pybaseball` is strong enough to support public-data research on movement clusters, pitch pairings, arsenal overlap, and pitch-type baselines.

### baseballr raw Statcast surface

Documented in:

- [R/sc_statcast_search.R](https://github.com/BillPetti/baseballr/blob/master/R/sc_statcast_search.R)
- [R/sch_process_statcast_payload.R](https://github.com/BillPetti/baseballr/blob/master/R/sch_process_statcast_payload.R)

`statcast_search()` returns a large normalized payload that includes:

- `pitch_type`
- `pitch_name`
- `release_speed`
- `release_pos_x`
- `release_pos_y`
- `release_pos_z`
- `release_spin_rate`
- `release_extension`
- `spin_axis`
- `pfx_x`
- `pfx_z`
- `plate_x`
- `plate_z`
- `effective_speed`
- newer bat-tracking and context fields such as:
  - `bat_speed`
  - `swing_length`
  - `attack_angle`
  - `attack_direction`
  - `arm_angle`
  - `api_break_z_with_gravity`
  - `api_break_x_arm`
  - `api_break_x_batter_in`

Implication:

`baseballr` exposes a richer documented payload contract than we currently consume. Even if we do not use the whole surface, it is a strong schema reference for future pitch-design features.

### Savant leaderboard helper surface

`baseballr::statcast_leaderboards()` directly supports public leaderboard pulls for:

- `expected_statistics`
- `pitch_arsenal`
- `exit_velocity_barrels`
- running and fielding leaderboards

Implication:

We can use leaderboard-level public research to define pitch archetypes and pitch-family baselines without requiring full raw-pitch ETL for every research pass.

## Gap Between Public Data and Current App Contract

### What the current engine expects

Current arm-action logic uses:

- `avgHb`
- `avgIvb`
- `avgRelHeight`
- `avgRelSide`
- `avgSpinAxis2d`
- `pitchType`
- handedness

Current supported canonical pitch families:

- Fastball
- Sinker
- Cutter
- Splitter
- Changeup
- Curveball
- Slider
- Sweeper

### What `metrics.ts` can normalize today

From [web/lib/trackman/metrics.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/trackman/metrics.ts):

- single-pitch normalization already accepts:
  - `release_speed`
  - `release_extension`
  - `release_pos_z`
  - `release_pos_x`
  - `spin_axis`
- aggregate normalization expects TrackMan-style pre-aggregated fields such as:
  - `avg_ivb_in`
  - `avg_hb_in`
  - `avg_rel_height_ft`
  - `avg_rel_side_ft`

### Critical mismatch

The current normalization layer does not treat raw Statcast movement fields like `pfx_x` and `pfx_z` as `hb` and `ivb`.

That means:

- raw Statcast rows can populate velocity, extension, release position, and spin axis
- raw Statcast rows cannot directly populate the movement fields the arm-action engine needs most

Immediate implication:

Before public Statcast repos can feed recommendation logic, we need a documented movement adapter:

- either map `pfx_x` and `pfx_z` into our signed `hb` and `ivb` contract
- or maintain a separate Statcast-native contract and convert at the knowledge-base layer

## Knowledge Base Schema Draft

This schema should exist before adding more suggestions.

### 1. Pitch Family Record

One record per stable family:

- `family_id`
- `display_name`
- `aliases`
- `variant_ids`
- `handedness_mode`
- `public_code_refs`

Example families:

- fastball
- sinker
- cutter
- changeup
- splitter
- curveball
- slider
- sweeper

### 2. Pitch Variant Record

One record per recommendation-grade variant:

- `variant_id`
- `family_id`
- `display_name`
- `description`
- `mechanical_identity`
- `movement_identity`
- `canonical_examples`

Examples we should support at the schema level even if the UI still groups them:

- gyro-slider
- sweeper
- spike-curve
- knuckle-curve
- circle-change
- kick-change
- split-change

Inference:

Public repos mostly expose family-level labels. Our suggestion engine needs finer language than that, so `variant` must be a first-class concept and not just free text in `rationale`.

### 3. Fit Rule Record

Each recommendation should be driven by explicit rules, not prose only:

- `variant_id`
- `arm_action_fit`
- `arm_action_strength`
- `slot_preferences`
- `slot_avoid`
- `required_existing_shapes`
- `anti_patterns`
- `blend_neighbors`
- `priority_default`

Examples:

- a curveball variant may be `avoid` for sidearm and submarine
- a kick-change may be `prefer` for supinator profiles
- a cutter may have `blend_neighbors` including fastball and gyro-slider

### 4. Movement Target Record

Store movement and release targets separately from recommendation copy:

- `variant_id`
- `target_hb_range`
- `target_ivb_range`
- `target_velocity_delta_mph`
- `target_spin_axis_range`
- `target_spin_rate_range`
- `target_extension_range`
- `target_release_height_range`
- `target_release_side_range`
- `separation_targets`

This is the layer public Statcast repos can help us build.

### 5. Evidence Record

Every rule should cite how we know it:

- `variant_id`
- `evidence_type`
- `evidence_source`
- `evidence_url`
- `claim`
- `confidence`
- `notes`

Allowed `evidence_type` values:

- `public_statcast_repo`
- `public_biomechanics_repo`
- `coaching_article`
- `peer_reviewed`
- `internal_uat`
- `manual_baseball_domain_judgment`

### 6. UI Copy Record

Separate recommendation logic from user-facing copy:

- `variant_id`
- `copy_mode`
- `fit_rationale`
- `conflict_rationale`
- `development_cues`
- `risk_flags`
- `tentative_suffix`

This keeps the engine explainable when we add more suggestions.

## Immediate Design Rules

1. Do not add more pitch suggestions directly into `armAction.ts` as hard-coded prose without a backing schema.
2. Treat public GitHub repos as evidence for:
   - movement targets
   - pitch-family normalization
   - slot/release proxies
   - arsenal-overlap heuristics
3. Do not treat public GitHub repos as sufficient evidence for:
   - fine-grained coaching claims
   - injury-risk claims
   - commercial production biomechanics training data
4. Keep public-data-derived movement logic distinct from biomechanical priors.

## Recommended Next Research Rounds

### Round 2: Public Statcast Adapter Design

Output:

- spec for converting raw Statcast fields into our local `hb` / `ivb` / release contract
- exact handedness/sign conventions
- compatibility table between Statcast fields and `metrics.ts`

Follow-on doc:

- [`arm_action_statcast_adapter_spec.md`](arm_action_statcast_adapter_spec.md)

### Round 3: Variant Expansion Research

Output:

- evidence-backed list of candidate variants beyond the current eight families
- each variant mapped to:
  - arm-action fit
  - slot fit
  - movement targets
  - blend conflicts

### Round 4: Biomechanics Priors

Output:

- slot-aware and release-pattern-aware priors from public biomechanics sources
- limited to research context and copy support

## Implementation Starting Point

The first concrete implementation task should be:

1. define the knowledge-base schema in code
2. add a Statcast-to-local movement adapter spec
3. populate a small seed dataset for the current variants:
   - sinker
   - circle-change
   - gyro-slider
   - sweeper
   - curveball
   - splitter
   - cutter

Only after that should we add new pitch suggestions.
