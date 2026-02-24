## Task Routing Index

Single lookup table: task → canonical doc. When in doubt, start here.

| Task | Canonical Doc | Code Source |
|---|---|---|
| Publish a completed outing | `docs/runbooks/publish_outing.md` | `web/lib/dataIndex.ts` |
| Outing folder structure / naming | `docs/architecture/folder_contract.md` | — |
| Arm-side / glove-side definitions | `docs/architecture/coordinates_and_handedness.md` | `web/lib/handedness.ts` |
| Miss vector math | `docs/architecture/coordinates_and_handedness.md` | `src/batch_process.py` |
| Update thresholds (on-target / outliers) | `docs/web/reports_kpis_outliers.md` | `web/lib/reportModel.ts` |
| Update CLI args docs | `docs/generated/cli_args.md` | `src/*.py` (auto-generated) |
| Fix video player shortcuts | `docs/web/video_player.md` | `web/app/components/VideoPlayer.tsx` |
| Segment pitches (manual / auto) | `docs/pipeline/segment_pitches.md` | `src/segment_pitches.py` |
| Batch process pipeline | `docs/pipeline/batch_process.md` | `src/batch_process.py` |
| Mark pitches (scrubber UI) | `docs/pipeline/mark_pitches.md` | `src/mark_pitches.py` |
| Calibration and ROI | `docs/pipeline/calibration_and_roi.md` | `src/calibrate.py`, `config.yaml` |
| Migrate outings (legacy → new) | `docs/runbooks/migrate_outings.md` | — |
| Normalize dateIds | `docs/runbooks/normalize_dateIds.md` | `scripts/normalize_dateIds.py` |
| Update Arsenals CSV | `docs/runbooks/update_arsenals_csv.md` | `data/Arsenals.csv` |
| Doc automation / drift checks | `docs/runbooks/doc_maintenance.md` | `scripts/update_docs.py` |
| Web app data contract | `docs/generated/web_app_data_contract.md` | auto-generated |
| Outing selection logic | `docs/generated/outing_selection_logic.md` | auto-generated |
| Team Leaderboards | `docs/web/leaderboards.md` | `web/app/leaderboards/page.tsx` |
| Import Trackman PDF | `docs/runbooks/import_trackman_pdf.md` | `scripts/import_trackman_pdf.py` |
| Trackman session UI | `docs/web/trackman_session_ui.md` | `web/app/trackman/session/` |
| Sync D3 leaderboard (daily) | `docs/runbooks/sync_d3_leaderboard.md` | `scripts/sync_d3_leaderboard.py` |
| Team statistics leaderboard | `docs/web/leaderboards.md` | `web/app/team-stats/page.tsx` |
| Mechanics (start here) | `docs/mechanics/README.md` | `src/mechanics/` |
| Run a mechanics session (coach pack) | `docs/runbooks/mechanics_cv.md` | `scripts/mechanics_coach_pack.py` |
| Publish mechanics session to web | `docs/runbooks/publish_mechanics_session.md` | `web/public/mechanics/index.json` |
| Mechanics engine architecture | `docs/runbooks/mechanics_cv.md` | `src/mechanics/` |
| Mechanics web UI | `docs/runbooks/publish_mechanics_session.md` | `web/app/mechanics/`, `web/lib/mechanics/` |
| Validate phase detection accuracy | `docs/runbooks/mechanics_cv.md` | `scripts/mechanics_validate.py` |
| Mechanics overhaul plan (complete) | `docs/mechanics/overhaul_plan.md` | `src/mechanics/` |
| Export TrackMan outing averages | `docs/runbooks/export_trackman_avgs.md` | `scripts/export_trackman_outing_averages.py` |
| Release & arm angle visuals | `docs/web/release_viz_v2.md` | `web/lib/release_viz/`, `web/app/components/` |
| Post-game stats update | `docs/runbooks/post_game_update.md` | — |
| Directory ownership (who owns what) | `docs/architecture/ownership_map.md` | — |
| Documentation index (all docs) | `docs/INDEX.md` | — |
| Troubleshooting | `docs/troubleshooting/common_failures.md` | — |

### Rules

- One canonical doc per topic. No duplication.
- When adding a new workflow, add exactly one new canonical doc and one row here.
- Generated docs (`docs/generated/*`) are derived artifacts. Do not hand-edit.
