# Notebooks — Command Tracker V2

Exploratory analysis scripts. Not part of the production pipeline.
Run manually during calibration and a/b testing phases.

## Phase 25 notebooks (planned)

| Script | Purpose |
|---|---|
| `extract_reference_frames.py` | Pull T/A frame crops from existing outings into reference/ |
| `run_yolo_calibration.py` | Run YOLO on 20+ ground-truthed pitches, plot glove-area timeseries |
| `measure_leg_lift_timing.py` | MediaPipe Pose on known pitches, measure peak-to-release interval |
| `measure_t_frame_tolerance.py` | Re-process pitches with T offset ±3/±5/±10, compute miss delta |

## Usage pattern

These scripts read from `outings/<playerId>/<dateId>/` and write outputs to
`calibration/` (plots, measurements). They are standalone — not imported by any pipeline code.

Each script should be runnable with:
```bash
python command-v2/notebooks/<script>.py --help
```
