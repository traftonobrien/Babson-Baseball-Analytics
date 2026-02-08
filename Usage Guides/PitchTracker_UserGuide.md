# Pitch Tracker – User Guide

This tool processes baseball pitch video clips to measure miss distance (inches), generate overlay videos for every pitch, and produce CSV outing summaries.

It supports cutting full game videos into pitch clips, processing multiple innings in one outing, overlay videos for every pitch, and automatic outing summaries.

---

## Publishing a New Outing

This is the full workflow after batch_process.py finishes. Follow every step. If counts do not match at any point, stop and fix before continuing.

Throughout this guide, `2024_04_27_Doan` is the example outing ID and `CDoan1` is the example player ID. Replace both with your actual values.

### 1. Required files after processing

After `batch_process.py --overlay-lite` finishes, the outing folder must contain:

```
outings/2024_04_27_Doan/
  clips/
    pitch_001.mp4
    pitch_002.mp4
    ...
    pitch_NNN.mp4
  results/
    pitch_001_overlay.mp4
    pitch_002_overlay.mp4
    ...
    pitch_NNN_overlay.mp4
  pitch_data_overlay_lite.csv
  pitch_log.json
  roi.json
```

`pitch_log.json` lives inside `clips/`. It stores the target frame, arrival frame, and pitch type for each pitch. batch_process.py reads it so it does not re-prompt the scrubber UI. A second copy may exist in the outing root from segment_pitches.py. The one inside `clips/` is authoritative.

`roi.json` lives in the outing root. It stores the detection region of interest used during processing. It is not copied to the web app but should stay in the outing folder for reproducibility.

### 2. Web app destination

The web app serves static files from `web/public/data/`. Each outing gets its own folder:

```
web/public/data/2024_04_27_Doan/
  clips/
    pitch_001.mp4 ... pitch_NNN.mp4
  results/
    pitch_001_overlay.mp4 ... pitch_NNN_overlay.mp4
  pitch_data_overlay_lite.csv
```

### 3. Copy commands

Create the destination folders:

```bash
mkdir -p web/public/data/2024_04_27_Doan/clips
mkdir -p web/public/data/2024_04_27_Doan/results
```

Copy clips, overlays, and CSV:

```bash
cp outings/2024_04_27_Doan/clips/pitch_*.mp4 \
   web/public/data/2024_04_27_Doan/clips/

cp outings/2024_04_27_Doan/results/pitch_*_overlay.mp4 \
   web/public/data/2024_04_27_Doan/results/

cp outings/2024_04_27_Doan/pitch_data_overlay_lite.csv \
   web/public/data/2024_04_27_Doan/
```

### 4. Sanity checks after copy

Run these three counts. All three must match.

```bash
ls web/public/data/2024_04_27_Doan/clips/pitch_*.mp4 | wc -l
ls web/public/data/2024_04_27_Doan/results/pitch_*_overlay.mp4 | wc -l
tail -n +2 web/public/data/2024_04_27_Doan/pitch_data_overlay_lite.csv | wc -l
```

If clip count and overlay count match but CSV rows differ: a pitch was skipped or double counted during processing. Recheck the CSV and rerun batch_process if needed.

If clip count and overlay count differ: some overlays failed to render. Rerun `batch_process.py --overlay-lite --start-at N` targeting only the missing pitches.

If all three match, continue.

### 5. Update dataIndex.ts

The web app reads player and outing metadata from `web/lib/dataIndex.ts`. This file is the single source of truth for which players and outings appear in the UI.

Each player has this shape:

```ts
{
  id: "CDoan1",
  name: "Connor Doan",
  outings: [
    {
      id: "2024_04_27_Doan",
      label: "Apr 27, 2024 – Doan (10 pitches)",
      csvPath: "/data/2024_04_27_Doan/pitch_data_overlay_lite.csv",
      overlayDir: "/data/2024_04_27_Doan/results",
      clipsDir: "/data/2024_04_27_Doan/clips",
    },
  ],
}
```

Fields:

• `id` is the outing folder name, e.g. `2024_04_27_Doan`
• `label` is what the user sees in the outing picker. The pitch count in parentheses must match the CSV row count.
• `csvPath`, `overlayDir`, `clipsDir` are paths relative to `web/public`. They always start with `/data/`.

To add a new outing to an existing player, append a new object to that player's `outings` array. To add a brand new player, add a new object to the `players` array with `id`, `name`, and `outings`.

Do not change any other player entries when adding a new outing.

### 6. Outing selection and reports in the UI

The player dashboard URL is `/player/CDoan1`. The first outing in the array is selected by default. To link directly to a specific outing, use `/player/CDoan1?outingId=2024_04_27_Doan`.

The report page is at `/player/CDoan1/report?outingId=2024_04_27_Doan` for a single outing report. For the overall report across all outings, use `/player/CDoan1/report?scope=overall`.

The overall report aggregates every outing in that player's `outings` array. If you add a second outing for the same player, the overall report automatically includes both. Verify this by opening the overall report and checking that the pitch count in the header equals the sum of all outing pitch counts.

### 7. Local testing

Start the dev server:

```bash
npm --prefix web run dev
```

Open `http://localhost:3000/player/CDoan1` in a browser. Switch outings using the dropdown. Click through a few pitches to confirm clips and overlays load. Open the report link and check that KPIs render.

Run the production build to catch TypeScript errors:

```bash
npm --prefix web run build
```

If the build fails, fix the issue before committing. Common causes: missing comma in dataIndex.ts, mismatched brackets, or wrong field names in the outing object.

### 8. Git workflow

Stage only the new data directory and the dataIndex change:

```bash
git add web/public/data/2024_04_27_Doan web/lib/dataIndex.ts
```

Commit with a short message:

```bash
git commit -m "Add Doan 2024-04-27 outing"
```

Push to main:

```bash
git push
```

Vercel deploys automatically on push to main. Check the Vercel dashboard or the live URL to confirm the outing appears.

### 9. Common failure modes and fixes

**Pitch selection mismatch between clip and overlay**

Cause: a clip is missing, or clip files are misnumbered relative to the CSV. The CSV pitch_number column and the file names (pitch_001.mp4) must align.

Fix: rename files to match the CSV numbering, or rerun batch_process.py to regenerate from scratch.

**Missing overlays**

Cause: batch_process crashed or was interrupted before all overlays rendered.

Fix: rerun `batch_process.py --overlay-lite --start-at N` where N is the first missing pitch number. Make sure `--clips-dir` points to the clips folder and output lands in the correct results folder.

**Batch process opens the scrubber UI again**

Cause: batch_process.py cannot find pitch_log.json in the clips folder, or there is a stale pitch_log.json in the outing root that does not match the clips.

Fix: ensure the correct pitch_log.json exists at `outings/YYYY_MM_DD_LASTNAME/clips/pitch_log.json`. If a stale copy exists in the outing root, rename or delete it.

**Multiple lockfiles Next.js warning**

The build may print a warning about multiple lockfiles detected. This is a harmless warning caused by both pnpm-lock.yaml and package-lock.json existing. Safe to ignore. If you want to silence it, set `turbopack.root` in next.config.ts or remove the extra lockfile.

**Zsh "no matches found" for bracket paths**

Zsh treats square brackets as glob patterns. When referencing paths like `web/app/player/[playerId]/report/page.tsx` in the terminal, wrap the path in quotes:

```bash
cat "web/app/player/[playerId]/report/page.tsx"
```

Or escape the brackets: `web/app/player/\[playerId\]/report/page.tsx`

**Smart quotes in commit messages**

If you copy text from a rich text editor, curly quotes may end up in your git commit message. Git will accept them but they look wrong in the log. Always type commit messages directly in the terminal or use a plain text editor.

---

## Folder Structure (Required)

Each outing must follow:

```
outings/
  YYYY_MM_DD_LASTNAME/
    clips/
      pitch_001.mp4
      pitch_002.mp4
    pitch_log.json
```

For multiple innings, all pitch clips go into the same `clips/` folder.

---

## STEP 1: Cut Full Game Video into Pitch Clips

### Create outing folder (once)

```bash
OUTING="yyyy_mm_dd_LASTNAME"
mkdir -p "outings/$OUTING"
```

### A) Cut one game video into pitch clips

```bash
cd /Users/traftonobrien/Desktop/pitch-tracker

python3 -m src.segment_pitches \
  --manual \
  --video "outings/yyyy_mm_dd_LASTNAME/inning1.mp4" \
  --output-dir "outings/yyyy_mm_dd_LASTNAME" \
  --player-id "InitialLastName1" \
  --pad-before 10 \
  --pad-after 10
```

### B) Add inning 2 into the same outing (continues numbering)

```bash
python3 -m src.segment_pitches \
  --manual \
  --video "outings/yyyy_mm_dd_LASTNAME/inning2.mp4" \
  --output-dir "outings/yyyy_mm_dd_LASTNAME" \
  --player-id "InitialLastName1" \
  --pad-before 10 \
  --pad-after 10
```

## STEP 2: Process All Pitch Clips (Main Command)

```bash
# Remove stale ROI if not prompting ROI selection
rm -f outings/yyyy_mm_dd_LASTNAME/roi.json

python3 - <<'PY'
import json
p="outings/yyyy_mm_dd_LASTNAME/clips/pitch_log.json"
d=json.load(open(p))
d.pop("roi", None)
json.dump(d, open(p,"w"), indent=2)
print("removed roi from pitch_log")
PY

# Process
python3 src/batch_process.py \
  --clips-dir "outings/yyyy_mm_dd_LASTNAME/clips" \
  --player-id "InitialLastName1" \
  --output-csv "outings/yyyy_mm_dd_LASTNAME/pitch_data_overlay_lite.csv" \
  --overlay-lite \
  --no-result-png \
  --glove-crop-size 256 \
  --ball-crop-size 256
```

## STEP 3: Publish to Web App

Follow the "Publishing a New Outing" section at the top of this guide.

## STEP 4: Publish to GitHub (so Vercel deploys)

Follow the git workflow in the "Publishing a New Outing" section.

## UPDATE ARSENALS: Publish to GitHub (so Vercel deploys)

```bash
cd /Users/traftonobrien/Desktop/pitch-tracker
cp data/Arsenals.csv web/public/data/Arsenals.csv
git add data/Arsenals.csv web/public/data/Arsenals.csv
git commit -m "Update arsenals CSV"
git push
```

---

## MORE INFO

### Interactive Workflow (Per Pitch)

1. Target frame opens. Click glove. Press Enter.
2. Arrival frame opens. Click ball. Press Enter.
3. Pitch preview video plays. Press Enter when done.
4. Select pitch type:
   • 1 = FF
   • 2 = CH
   • 3 = SL
   • 0 = Other
5. Overlay video is generated automatically.

Repeat for all pitches.

### Outputs

CSV: `outings/YYYY_MM_DD_LASTNAME/pitch_data_overlay_lite.csv`

Overlay videos: `outings/YYYY_MM_DD_LASTNAME/results/pitch_001_overlay.mp4`

Each overlay shows:
   • Target marker
   • Ball marker
   • Miss vector
   • Strike zone
   • Miss distance and direction

### Outing Summary (Automatic)

At the end of every run, batch_process prints a summary:

```
Processed: 15 pitches
Average miss: 11.2″
Min miss: 1.3″
Max miss: 23.1″

Pitch by pitch:
#1 pitch_001.mp4 FF miss=10.1″ (glove side, high)
```

Also prints timing:
   • Wall time
   • Compute time
   • User time

### Debug Mode (Slow, Full Tracking)

```bash
python3 src/batch_process.py \
  --clips-dir "outings/2024_04_27_Doan/clips" \
  --player-id "CDoan1" \
  --output-csv "outings/2024_04_27_Doan/pitch_data_debug.csv" \
  --debug
```

Use only for visualization or development.

### Common Errors

```
FileNotFoundError: outings//clips
```

Cause: You ran the template literally without replacing the placeholder.

Fix: Replace the placeholder with your real folder name, e.g. `outings/2024_04_27_Doan/clips`.
