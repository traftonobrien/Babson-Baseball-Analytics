## Pitch Tracker Documentation

Start here to find any doc. For task-based lookup, see `docs/ROUTING.md`.

### Constitution

- `CLAUDE.md` — Hard invariants and mental model. Read first.

### Architecture

- `docs/architecture/overview.md` — System data flow and components
- `docs/architecture/coordinates_and_handedness.md` — Perspective, miss vectors, arm/glove logic
- `docs/architecture/folder_contract.md` — Required folder structures, stats layout, and canonical player identity rules
- `docs/architecture/ownership_map.md` — Directory ownership matrix (who owns what)

### Pipeline

- `docs/pipeline/batch_process.md` — Main processing pipeline (SAM 2 tracking + miss calc)
- `docs/pipeline/mark_pitches.md` — Manual pitch marking scrubber UI
- `docs/pipeline/segment_pitches.md` — Pitch segmentation (manual and auto modes)
- `docs/pipeline/calibration_and_roi.md` — Calibration and detection ROI setup

### Mechanics

- `docs/mechanics/README.md` — **Start here** — single index for mechanics engine, web UI, and publishing
- `docs/runbooks/mechanics_cv.md` — Learning guide, engine reference, validation
- `docs/runbooks/publish_mechanics_session.md` — Publish mechanics session to the web app
- `docs/mechanics/overhaul_plan.md` — Engine overhaul plan (Phases 0–6, complete)

### Runbooks

- `docs/runbooks/publish_outing.md` — Publish processed command outing to the web app
- `docs/runbooks/publish_mechanics_session.md` — Publish mechanics session to the web app
- `docs/runbooks/import_trackman_pdf.md` — Import TrackMan PDF reports
- `docs/runbooks/export_trackman_avgs.md` — Export TrackMan outing averages to CSV
- `docs/runbooks/sync_d3_leaderboard.md` — Sync D3 baseball leaderboard data
- `docs/runbooks/post_game_update.md` — Post-game stats update workflow
- `docs/runbooks/migrate_outings.md` — Migrate outings between folder formats
- `docs/runbooks/normalize_dateIds.md` — Fix legacy dateId formats
- `docs/runbooks/update_arsenals_csv.md` — Sync Arsenals.csv across repo
- `docs/runbooks/doc_maintenance.md` — Doc generation, drift checks, pre-commit

### Web App

- `docs/web/data_indexing.md` — dataIndex.ts conventions and player model
- `docs/web/video_player.md` — Video player component and keyboard shortcuts
- `docs/web/reports_kpis_outliers.md` — Report thresholds, KPIs, outlier system
- `docs/web/leaderboards.md` — Team Leaderboards: modes, filters, KPIs, pitch groups
- `docs/web/trackman_session_ui.md` — TrackMan session UI and data flow
- `docs/web/release_viz.md` — Release & arm angle visuals (V1)
- `docs/web/release_viz_v2.md` — Release & arm angle visuals (V2, production)

### Governance

- `docs/ROUTING.md` — Task routing index (task → canonical doc)
- `docs/GOVERNANCE.md` — Documentation governance rules
- `docs/STYLE_GUIDE.md` — Documentation style and formatting conventions

### Agent Configuration (Codex)

- `docs/CODEX_BRAIN.md` — Codex agent master charter and discipline rules
- `docs/CODEX_COMMIT_RULES.md` — Codex git commit rules
- `docs/CODEX_STOP_CONDITIONS.md` — Codex mandatory stop conditions
- `docs/CODEX_WORKFLOW.md` — Codex workflow protocol

### Troubleshooting

- `docs/troubleshooting/common_failures.md` — Common errors and fixes

### Auto-Generated Reference (do not hand-edit)

- `docs/generated/cli_args.md`
- `docs/generated/web_app_data_contract.md`
- `docs/generated/publishing_workflow.md`
- `docs/generated/outing_selection_logic.md`
- `docs/generated/perspective_and_lanes.md`
- `docs/generated/thresholds_on_target_outliers.md`

### Legacy Archive

- `docs/legacy/` — Archived older docs and plans. Immutable reference.
