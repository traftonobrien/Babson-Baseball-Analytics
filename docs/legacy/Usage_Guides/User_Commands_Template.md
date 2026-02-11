### STANDARD COMMAND TEMPLATE

### Folder setup
outings/DATE_player/clips/

### Cut video into clips
python3 src/segment_pitches.py \
  --video "game.mp4" \
  --output-dir "outings/DATE_player/clips" \
  --threshold-pct 50 \
  --min-gap 2.5 \
  --review
  
### Process outing
python3 src/batch_process.py \
  --clips-dir "outings/DATE_player/clips" \
  --player-id "PLAYERID" \
  --pitcher-hand R \
  --output-csv "outings/DATE_player/pitch_data_overlay_lite.csv" \
  --overlay-lite \
  --no-result-png \
  --glove-crop-size 256 \
  --ball-crop-size 256
  
  
###

Per pitch
	1.	Click glove → Enter
	2.	Click ball → Enter
	3.	Watch video → Enter
	4.	Select pitch type
	5.	Overlay saved

⸻

Output

CSV + overlay MP4s in results/

⸻

Typical speed

~7 seconds per pitch
~15 minutes per game