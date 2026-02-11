## Pitch Tracker Documentation

Start here to find any doc. For task-based lookup, see `docs/ROUTING.md`.

### Constitution

- `CLAUDE.md` — Hard invariants and mental model. Read first.

### Architecture

- `docs/architecture/overview.md` — System data flow and components
- `docs/architecture/coordinates_and_handedness.md` — Perspective, miss vectors, arm/glove logic
- `docs/architecture/folder_contract.md` — Required folder structures and naming

### Pipeline

- `docs/pipeline/batch_process.md` — Main processing pipeline (SAM 2 tracking + miss calc)
- `docs/pipeline/mark_pitches.md` — Manual pitch marking scrubber UI
- `docs/pipeline/segment_pitches.md` — Pitch segmentation (manual and auto modes)
- `docs/pipeline/calibration_and_roi.md` — Calibration and detection ROI setup

### Runbooks

- `docs/runbooks/publish_outing.md` — Publish processed outing to the web app
- `docs/runbooks/migrate_outings.md` — Migrate outings between folder formats
- `docs/runbooks/normalize_dateIds.md` — Fix legacy dateId formats
- `docs/runbooks/update_arsenals_csv.md` — Sync Arsenals.csv across repo
- `docs/runbooks/doc_maintenance.md` — Doc generation, drift checks, pre-commit

### Web App

- `docs/web/data_indexing.md` — dataIndex.ts conventions and player model
- `docs/web/video_player.md` — Video player component and keyboard shortcuts
- `docs/web/reports_kpis_outliers.md` — Report thresholds, KPIs, outlier system

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
