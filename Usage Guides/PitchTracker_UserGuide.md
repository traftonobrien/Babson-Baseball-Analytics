# ⚾ Pitch Tracker – Technical User Guide

This tool processes baseball pitch video clips to:
- Measure miss distance (inches)
- Generate overlay videos for every pitch
- Produce CSV outing summaries

It supports:
- Cutting full game videos into pitch clips
- Processing multiple innings in one outing
- Overlay videos for every pitch
- Automatic outing summary

---

## 📁 Folder Structure (Required)

Each outing must follow:

outings/
  YYYY-MM-DD_player/
    clips/
      pitch_001.mp4
      pitch_002.mp4
    pitch_log.json

For multiple innings, all pitch clips go into the same `clips/` folder.

---

## STEP 1: Cut Full Game Video into Pitch Clips

### Create outing folder (once)

OUTING="yyyy_mm_dd_LASTNAME"
mkdir -p "outings/$OUTING"

### A) Cut one game video into pitch clips

python3 src/segment_pitches.py \
  --manual \
  --video "outings/yyyy_mm_dd_LASTNAME/inning1.mp4" \
  --output-dir "outings/yyyy_mm_dd_LASTNAME/clips" \
  --player-id "InitialLastName1" \
  --pad-before 10 \
  --pad-after 10

	
###  B) Add inning 2 into the same outing (continues numbering)

python3 src/segment_pitches.py \
  --manual \
  --video "outings/yyyy_mm_dd_LASTNAME/inning2.mp4" \
  --output-dir "outings/yyyy_mm_dd_LASTNAME/clips" \
  --player-id "InitialLastName1" \
  --pad-before 10 \
  --pad-after 10


## STEP 2: Process All Pitch Clips (Main Command)

python3 src/batch_process.py \
  --clips-dir "outings/yyyy_mm_dd_LASTNAME/clips" \
  --player-id "InitialLastName1" \
  --output-csv "outings/yyyy_mm_dd_LASTNAME/pitch_data_overlay_lite.csv" \
  --overlay-lite \
  --no-result-png \
  --glove-crop-size 256 \
  --ball-crop-size 256

## STEP 3: Add To Web App


  
  
  
  
  
  
  
## MORE INFO!!!
  
  
# INTERACTIVE WORKFLOW (Per Pitch)
	1.	Target frame opens → click glove → Enter
	2.	Arrival frame opens → click ball → Enter
	3.	Pitch preview video plays → press Enter when done
	4.	Select pitch type:
	•	1 = FF
	•	2 = CH
	•	3 = SL
	•	0 = Other
	5.	Overlay video is generated automatically

Repeat for all pitches.  
  
### OUTPUTS

CSV: outings/YYYY-MM-DD_player/pitch_data_overlay_lite.csv

Overlay videos: outings/YYYY-MM-DD_player/results/pitch_001_overlay.mp4

Each overlay shows:
	•	target marker
	•	ball marker
	•	miss vector
	•	strike zone
	•	miss distance and direction
  
### OUTING SUMMARY (Automatic)

  • At the end of every run:

Example:

Processed: 15 pitches
Average miss: 11.2"
Min miss: 1.3"
Max miss: 23.1"

Pitch-by-pitch:
#1 pitch_001.mp4 FF miss=10.1" (glove-side, high)

Also prints timing:
	•	wall time
	•	compute time
	•	user time
	
### DEBUG MODE (Slow, Full Tracking)

python3 src/batch_process.py \
  --clips-dir "outings/2026-01-30_langan/clips" \
  --player-id "SLangan1" \
  --pitcher-hand R \
  --output-csv "outings/2026-01-30_langan/pitch_data_debug.csv" \
  --debug
  
  • Use only for visualization or development.
  
### COMMON ERRORS

FileNotFoundError: outings//clips

Cause: You ran the template literally.

Fix:
Replace <DATE> with your real folder name: outings/langan_test/clips
  
  