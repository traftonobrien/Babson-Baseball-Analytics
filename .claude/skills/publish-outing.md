# Publish Outing to Web App

Condensed reference for Claude Code sessions. Use this after batch_process.py finishes.

Example outing: `CDoan1/2024_04_27`. Example player: `CDoan1` (Connor Doan).

## 1. Verify source files exist

```
outings/<playerId>/<dateId>/
  clips/pitch_001.mp4 ... pitch_NNN.mp4
  results/pitch_001_overlay.mp4 ... pitch_NNN_overlay.mp4
  pitch_data_overlay_lite.csv
  clips/pitch_log.json   (target/arrival frames, pitch types)
  roi.json                (detection ROI, stays in outing folder)
```

## 2. Create destination and copy

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

## 3. Validate counts

All three must match. Stop if they differ.

```bash
ls web/public/data/<playerId>/<dateId>/clips/pitch_*.mp4 | wc -l
ls web/public/data/<playerId>/<dateId>/results/pitch_*_overlay.mp4 | wc -l
tail -n +2 web/public/data/<playerId>/<dateId>/pitch_data_overlay_lite.csv | wc -l
```

## 4. Update web/lib/dataIndex.ts

For a new player, add a new entry to the `players` array. For an existing player, append to their `outings` array.

Required outing shape:

```ts
{
  id: "CDoan1/2024_04_27",
  label: "Apr 27, 2024 – Doan (10 pitches)",
  ...buildDataPaths("CDoan1", "2024_04_27"),
}
```

The pitch count in `label` must match CSV row count.

`buildDataPaths()` generates `csvPath`, `overlayDir`, and `clipsDir` from `playerId` and `dateId`.

Do not modify other player entries.

## 5. Build check

```bash
npm --prefix web run build
```

Fix any TypeScript errors before committing.

## 6. Git

```bash
git add web/public/data/<playerId>/<dateId> web/lib/dataIndex.ts
git commit -m "Add <playerId>/<dateId> outing"
git push
```

Vercel deploys automatically on push to main.

## 7. Verify in the app

• Player dashboard: `/player/CDoan1`
• Specific outing: `/player/CDoan1?outingId=CDoan1/2024_04_27`
• Outing report: `/player/CDoan1/report?outingId=CDoan1/2024_04_27`
• Overall report: `/player/CDoan1/report?scope=overall`

Overall report aggregates all outings for that player. Pitch count in header should equal sum of all outing counts.

## Common failures

• **Missing overlays**: rerun `batch_process.py --overlay-lite --start-at N`
• **Scrubber reopens**: wrong pitch_log.json path. Ensure it exists at `clips/pitch_log.json`. Delete or rename any stale copy in the outing root.
• **Count mismatch**: a pitch was skipped or files are misnumbered. Recheck CSV and file names.
• **Zsh bracket error**: quote paths with brackets, e.g. `"web/app/player/[playerId]/page.tsx"`
