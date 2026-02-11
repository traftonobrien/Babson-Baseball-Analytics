## Publish a Completed Outing

Step by step runbook. Do not skip steps. Stop immediately if any validation fails.

### Prerequisites

Processing is complete. These files exist in `outings/<playerId>/<dateId>/`:

```
pitch_data_overlay_lite.csv
clips/pitch_001.mp4 ... pitch_NNN.mp4
results/pitch_001_overlay.mp4 ... pitch_NNN_overlay.mp4
clips/pitch_log.json
```

### Step 1: Verify counts match

```bash
ls outings/<playerId>/<dateId>/clips/pitch_*.mp4 | wc -l
ls outings/<playerId>/<dateId>/results/pitch_*_overlay.mp4 | wc -l
tail -n +2 outings/<playerId>/<dateId>/pitch_data_overlay_lite.csv | wc -l
```

All three numbers must be equal. If not, STOP.

### Step 2: Copy into web app

```bash
mkdir -p web/public/data/<playerId>/<dateId>/clips
mkdir -p web/public/data/<playerId>/<dateId>/results

cp outings/<playerId>/<dateId>/pitch_data_overlay_lite.csv web/public/data/<playerId>/<dateId>/
cp outings/<playerId>/<dateId>/clips/pitch_*.mp4 web/public/data/<playerId>/<dateId>/clips/
cp outings/<playerId>/<dateId>/results/pitch_*_overlay.mp4 web/public/data/<playerId>/<dateId>/results/
```

### Step 3: Verify destination counts

Recount at the destination. All three must match the source counts.

```bash
ls web/public/data/<playerId>/<dateId>/clips/pitch_*.mp4 | wc -l
ls web/public/data/<playerId>/<dateId>/results/pitch_*_overlay.mp4 | wc -l
tail -n +2 web/public/data/<playerId>/<dateId>/pitch_data_overlay_lite.csv | wc -l
```

### Step 4: Update dataIndex.ts

Open `web/lib/dataIndex.ts`.

If the player already exists, append to their `outings` array. If not, look up name and hand from `data/Arsenals.csv` and add a new player entry. New players require `throws: "R" | "L"`.

Outing format:

```ts
{
  id: "<playerId>/<dateId>",
  label: "<date> – <name> (<count> pitches)",
  ...buildDataPaths("<playerId>", "<dateId>"),
}
```

Pitch count in the label must match CSV row count. Do not duplicate existing outing IDs.

### Step 5: Build

```bash
npm --prefix web run build
```

If the build fails, fix the error before continuing.

### Step 6: Commit and push

```bash
git add web/public/data/<playerId>/<dateId> web/lib/dataIndex.ts
git commit -m "Add <playerId>/<dateId> outing"
git push
```

Vercel redeploys automatically on push to main.

### Naming conventions

See `docs/architecture/folder_contract.md` for playerId and dateId formats.

### Automation

The `trackerpublish` skill (`.claude/skills/trackerpublish/SKILL.md`) automates this workflow.
