---
name: trackerpublish
description: Publish a completed Pitch Tracker outing to the web app. Use when the user says "publish outing", "add outing to the site", "trackerpublish", or asks to deploy processed pitch data to the web app. Assumes segmentation, batch_process, and pitch count verification are already done. Copies clips, overlays, and CSV into web/public/data, updates web/lib/dataIndex.ts, builds, commits, and pushes.
---

# Publish Outing to Web App

Publish verified outing data to the Pitch Tracker web app. This skill executes an 8 step sequential workflow. Do not skip steps. Stop immediately if any validation fails.

## Required inputs

Collect these from the user before starting:

1. **Player ID** (e.g. `JClark1`)
2. **Date ID** (e.g. `2024_04_09`)
3. **Label text** (e.g. `Apr 9, 2024 – Clark (55 pitches)`)

The outing ID is `<playerId>/<dateId>` (e.g. `JClark1/2024_04_09`).

## Step 1: Verify source files

Confirm these exist in `outings/<playerId>/<dateId>/`:

```
outings/<playerId>/<dateId>/
  pitch_data_overlay_lite.csv
  clips/pitch_001.mp4 ... pitch_NNN.mp4
  results/pitch_001_overlay.mp4 ... pitch_NNN_overlay.mp4
  clips/pitch_log.json
```

Count all three. All must match:

```bash
ls outings/<playerId>/<dateId>/clips/pitch_*.mp4 | wc -l
ls outings/<playerId>/<dateId>/results/pitch_*_overlay.mp4 | wc -l
tail -n +2 outings/<playerId>/<dateId>/pitch_data_overlay_lite.csv | wc -l
```

If counts mismatch: STOP. Report the mismatch and do not continue.

## Step 2: Copy into web app

```bash
mkdir -p web/public/data/<playerId>/<dateId>/clips
mkdir -p web/public/data/<playerId>/<dateId>/results

cp outings/<playerId>/<dateId>/clips/pitch_*.mp4 \
   web/public/data/<playerId>/<dateId>/clips/

cp outings/<playerId>/<dateId>/results/pitch_*_overlay.mp4 \
   web/public/data/<playerId>/<dateId>/results/

cp outings/<playerId>/<dateId>/pitch_data_overlay_lite.csv \
   web/public/data/<playerId>/<dateId>/
```

## Step 3: Verify post copy counts

Recount at the destination. All three must match:

```bash
ls web/public/data/<playerId>/<dateId>/clips/pitch_*.mp4 | wc -l
ls web/public/data/<playerId>/<dateId>/results/pitch_*_overlay.mp4 | wc -l
tail -n +2 web/public/data/<playerId>/<dateId>/pitch_data_overlay_lite.csv | wc -l
```

If mismatch: STOP. Report and do not continue.

## Step 4: Update dataIndex.ts

Open `web/lib/dataIndex.ts`.

Find the player by `id` matching `<playerId>`.

If the player exists, append to their `outings` array. If the player does not exist, look up the player name and hand from `data/Arsenals.csv` using the player ID, then add a new player entry to the `players` array.

Do not create duplicate outing entries. Check that no outing with the same `id` already exists.

Outing object shape:

```ts
{
  id: "<playerId>/<dateId>",
  label: "<label>",
  ...buildDataPaths("<playerId>", "<dateId>"),
}
```

The `buildDataPaths()` function generates `csvPath`, `overlayDir`, and `clipsDir`. It is defined in `dataIndex.ts`.

The pitch count in the label must match the CSV row count.

Do not modify any other player or outing entries.

## Step 5: Build

```bash
npm --prefix web run build
```

If TypeScript or build fails: report the error. Do not commit broken code.

## Step 6: Stage

```bash
git add web/public/data/<playerId>/<dateId> web/lib/dataIndex.ts
```

## Step 7: Commit

```bash
git commit -m "Add <playerId>/<dateId> outing"
```

## Step 8: Push

```bash
git push
```

## Final output

Print a summary:

```
Pitch count: <N>
Files copied: <N> clips, <N> overlays, 1 CSV
Commit: <hash>
Pushed to main. Vercel will deploy automatically.
```

## Rules

• Never modify application code or UI.
• Never rename pitch files.
• Never regenerate clips, overlays, or CSV.
• Only publish already verified data.
• Stop immediately if any count validation fails.
