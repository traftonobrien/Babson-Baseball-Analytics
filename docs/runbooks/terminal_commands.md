# Terminal Commands: Full Pipeline

## Quick Reference

```
segment_pitches.py    →   Tag release & arrival, cut clips
batch_process.py      →   Click target & ball, compute miss distances
[validate + copy]     →   Publish to web app
```

---

## Step 1: Segment Pitches (Tag Release & Arrival)

Open the scrubber UI to mark target (T) and arrival (A) frames for each pitch.

```bash
python3 src/segment_pitches.py \
    --video sourcevideo/inning.mov \
    --output-dir outings/DJames1/2025_03_26 \
    --player-id DJames1
```

Multiple inning videos:

```bash
python3 src/segment_pitches.py \
    --videos outings/DJames1/2025_03_26/inning*.mov \
    --output-dir outings/DJames1/2025_03_26 \
    --player-id DJames1
```

**Hotkeys:** `T` = target frame, `A` = arrival frame, `N` = finalize pitch, `U` = undo, `Q` = quit and save

Outputs: `clips/pitch_NNN.mp4` files and `clips/pitch_log.json`

---

## Step 2: Batch Process (Select Target & Ball)

Click the glove (target) and ball on each pitch. Computes miss distances and renders overlays.

```bash
python3 src/batch_process.py \
    --clips-dir outings/DJames1/2025_03_26/clips \
    --player-id DJames1 \
    --output-csv outings/DJames1/2025_03_26/pitch_data_overlay_lite.csv \
    --overlay-lite \
    --sam-crop-size 384 \
    --sam-max-width 800
```

Resume from a specific pitch (if interrupted):

```bash
python3 src/batch_process.py \
    --clips-dir outings/DJames1/2025_03_26/clips \
    --player-id DJames1 \
    --output-csv outings/DJames1/2025_03_26/pitch_data_overlay_lite.csv \
    --overlay-lite \
    --sam-crop-size 384 \
    --sam-max-width 800 \
    --start-at 7
```

Outputs: `pitch_data_overlay_lite.csv` and `results/pitch_NNN_overlay.mp4` files

---

## Step 3: Validate Counts

All three numbers must match before publishing.

```bash
ls outings/<playerId>/<dateId>/clips/pitch_*.mp4 | wc -l
ls outings/<playerId>/<dateId>/results/pitch_*_overlay.mp4 | wc -l
tail -n +2 outings/<playerId>/<dateId>/pitch_data_overlay_lite.csv | wc -l
```

---

## Step 4: Copy Files to Web App

```bash
mkdir -p web/public/data/<playerId>/<dateId>/clips
mkdir -p web/public/data/<playerId>/<dateId>/results

cp outings/<playerId>/<dateId>/pitch_data_overlay_lite.csv \
    web/public/data/<playerId>/<dateId>/

cp outings/<playerId>/<dateId>/clips/pitch_*.mp4 \
    web/public/data/<playerId>/<dateId>/clips/

cp outings/<playerId>/<dateId>/results/pitch_*_overlay.mp4 \
    web/public/data/<playerId>/<dateId>/results/
```

---

## Step 5: Update dataIndex.ts

Open `web/lib/dataIndex.ts` and add to the player's `outings` array:

```ts
{
  id: "<playerId>/<dateId>",
  label: "<date> – <Name> (<count> pitches)",
  ...buildDataPaths("<playerId>", "<dateId>"),
}
```

New players also need a `throws: "R" | "L"` field.

---

## Step 6: Build and Deploy

```bash
npm --prefix web run build
```

If the build passes:

```bash
git add web/public/data/<playerId>/<dateId> web/lib/dataIndex.ts
git commit -m "Add <playerId>/<dateId> outing"
git push
```

Vercel redeploys automatically on push to main.

---

## One-Time Setup: Calibration

Set the detection ROI (run once per camera setup):

```bash
python3 src/calibrate.py --set-roi --video sourcevideo/inning.mov
```

Set pixels-per-inch:

```bash
python3 src/calibrate.py --ppi 5.8247
```

---

## Optional: Post-Game Stats Import

```bash
python3 scripts/post_game_update.py \
    --boxscore-url "https://babsonathletics.com/sports/baseball/stats/2025/suffolk/boxscore/14570" \
    --team babson \
    --players "Chase Burrows" "Dillon James" \
    --outing-map "CBurrows1=2025_03_26" "DJames1=2025_03_26"
```
