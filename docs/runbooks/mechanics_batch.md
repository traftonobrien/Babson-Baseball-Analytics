## Mechanics Batch Runner

`scripts/run_mechanics_batch.py` batch-processes player mechanics videos using the existing
`scripts/mechanics_coach_pack.py` pipeline. It does not change scoring logic.

### How it works

1. Discovers direct child player folders under `--root`.
2. Builds a deterministic plan for all players.
3. Executes only entries with `status=planned` (unless `--dry-run`).
4. Verifies artifacts and writes a full batch audit log.

### Defaults

- Default root: `/Users/traftonobrien/Desktop/pitch-tracker/Mechanics Analysis`
- By default, `Trafton OBrien` is skipped with explicit reason:
  - `trafton_default_excluded`
- Uses `--view open_side --slowmo --hold-review`
- Uses hand default from:
  - `output/mechanics/trafton_obrien/trafton_mechanics_test/coach_pack/notes.json`
  - fallback: `hand=R`

### CLI

```bash
python3 scripts/run_mechanics_batch.py [options]
```

Options:

- `--root <path>`
- `--dry-run`
- `--force`
- `--only <token>` (repeatable; comma-separated supported)
- `--skip <token>` (repeatable; comma-separated supported)
- `--limit <N>` (plan all, run up to N)
- `--print-commands`
- `--no-trafton-skip`

### Examples

```bash
python3 scripts/run_mechanics_batch.py --dry-run
python3 scripts/run_mechanics_batch.py --dry-run --print-commands
python3 scripts/run_mechanics_batch.py --root "/Users/traftonobrien/Desktop/pitch-tracker/Mechanics Analysis"
python3 scripts/run_mechanics_batch.py --only "burk_bobby" --only "langan"
python3 scripts/run_mechanics_batch.py --skip "trafton" --skip "vinny"
python3 scripts/run_mechanics_batch.py --limit 3
python3 scripts/run_mechanics_batch.py --force
```

### Skip reason taxonomy

Every skipped player has exactly one `skip_reason`.

- `trafton_default_excluded`
- `user_excluded_only`
- `user_excluded_skip`
- `missing_video`
- `existing_notes`
- `limit_reached` (execution-time skip when `--limit` is hit)

### Video discovery and deterministic selection

For each player folder, the runner attempts:

1. `* Mechanics.*`
2. `*Mechanics*`
3. any known video extension (`.mp4`, `.mov`, `.m4v`, `.mpeg`, `.mpg`, `.avi`)

If multiple candidates exist, deterministic ranking prefers:

1. file name containing `Mechanics`
2. exact last-name match (`<LAST_NAME> Mechanics.*`) when possible
3. `.mp4` over `.mov`
4. shortest path
5. lexical name order

All attempts and candidates are logged in JSON.

### Output and resumability

Per player:

```text
output/mechanics/<player_slug>/<session_slug>/coach_pack/
```

Batch logs:

```text
output/mechanics/batch_runs/mechanics_batch_<timestamp>.json
```

Idempotency:

- If `coach_pack/notes.json` exists for planned session, player is skipped with `existing_notes` unless `--force`.

### Log format (audit)

Log includes:

- `run_metadata` (timestamp, git hash when available, args, root, python, defaults)
- `planned_entries` (full plan before execution)
- `results` (per-player status)
- `summary`
  - status counts
  - skip reason counts

Each result row includes:

- `player_slug`
- `player_name`
- `video_path`
- `status` (`planned|ran|skipped|failed`)
- `skip_reason` (required for skipped)
- `command` (argv list)
- `output_dir`
- `artifacts_verified`
- `error`

### Troubleshooting

`missing ffmpeg`:
- Install ffmpeg and retry (`brew install ffmpeg` on macOS).

`missing dependencies (e.g. mediapipe)`:
- Ensure environment has required packages:
  - `.venv/bin/python -m pip install -r requirements.txt`

`wrong root`:
- Pass explicit root with `--root`.

`missing_video`:
- Ensure folder contains a mechanics video like `LastName Mechanics.mp4` or `.mov`.
- Inspect `video_glob_attempts` in batch log for exact match attempts.

`no frames/artifacts generated`:
- Run single-player pipeline directly and fix underlying video/dependency issue:
  - `python3 scripts/mechanics_coach_pack.py --video "<video>" --hand R --view open_side --slowmo --hold-review`
