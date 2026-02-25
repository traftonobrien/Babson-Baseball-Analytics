## Mechanics Batch Runner

### How it works

`scripts/run_mechanics_batch.py` wraps the existing single-session mechanics runner (`scripts/mechanics_coach_pack.py`) and processes each direct child player folder under a mechanics root.

Root resolution:
1. `--root` if provided.
2. Auto-detect in this order:
   - `web/public/Mechanical Analysis`
   - `web/public/Mechanics Analysis`
   - `Mechanical Analysis`
   - `Mechanics Analysis`

Per player folder:
- Skips `Trafton OBrien` / `Trafton O’Brien` by default.
- Finds input video with `* Mechanics.*`.
- If multiple videos match:
  - prefers exact `<LAST_NAME> Mechanics.*` (case-insensitive),
  - otherwise selects the largest file by size.
- Derives:
  - `player_slug` from project slug utility when available (fallback slugger otherwise),
  - `session_slug = <player_slug>_mechanics_<YYYY_MM_DD>`, using date from folder name (`YYYY-MM-DD` or `YYYY_MM_DD`) or today.
- Reads defaults from:
  - `output/mechanics/trafton_obrien/trafton_mechanics_test/coach_pack/notes.json`
  - fallback defaults: `hand=R`, `view_mode=open_side`.
- Runs the subprocess and normalizes outputs to:
  - `output/mechanics/<player_slug>/<session_slug>/coach_pack/`
- Idempotent behavior:
  - if `coach_pack/notes.json` exists, skips unless `--force`.

After each run it verifies required artifacts and writes a batch log:
- `output/mechanics/batch_runs/mechanics_batch_<timestamp>.json`

### Examples

```bash
python3 scripts/run_mechanics_batch.py --dry-run
python3 scripts/run_mechanics_batch.py --only "burk_bobby,langan_shane"
python3 scripts/run_mechanics_batch.py --force
```

Additional useful flags:

```bash
python3 scripts/run_mechanics_batch.py --skip "trafton_obrien"
python3 scripts/run_mechanics_batch.py --limit 3
python3 scripts/run_mechanics_batch.py --root "/absolute/path/to/Mechanical Analysis"
```

### Where outputs live

Per player/session:

```text
output/mechanics/<player_slug>/<session_slug>/coach_pack/
```

Batch logs:

```text
output/mechanics/batch_runs/mechanics_batch_<timestamp>.json
```

### Troubleshooting

`missing ffmpeg`
- The pipeline uses OpenCV writers, but local codec support can still fail on some machines.
- Install ffmpeg and retry:
  - macOS: `brew install ffmpeg`

`bad video path` / `No video matching '* Mechanics.*'`
- Confirm each player directory has a file matching `* Mechanics.*`.
- If multiple files exist, ensure at least one follows `<LAST_NAME> Mechanics.<ext>`.

`no frames generated` / empty artifacts
- Confirm source video is readable:
  - `python3 scripts/mechanics_coach_pack.py --video "<video>" --hand R --view open_side --slowmo --hold-review`
- If this single-run command fails, fix the underlying video/dependency issue first.

`permissions` errors
- Ensure write permission for:
  - `output/mechanics/`
  - `output/mechanics/batch_runs/`

`manual_template.json missing in coach_pack`
- The single-run pipeline writes `manual_template.json` at session root.
- Batch runner copies it into `coach_pack/` for consistent artifact verification.
