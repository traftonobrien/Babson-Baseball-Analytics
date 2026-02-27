#!/usr/bin/env python3
"""
Initialize manual_clips.json for all players in the Mechanics Analysis directory.

Finds all .mp4 or .mov files for each player and generates a basic manual_clips.json
if it does not already exist.
"""
import json
import cv2
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ANALYSIS_DIR = REPO_ROOT / "Mechanics Analysis"

def main():
    if not ANALYSIS_DIR.exists():
        print(f"Directory not found: {ANALYSIS_DIR}")
        return

    count = 0
    for player_dir in ANALYSIS_DIR.iterdir():
        if not player_dir.is_dir() or player_dir.name.startswith("."):
            continue

        manual_json_path = player_dir / "manual_clips.json"
        
        main_video = None
        videos = list(player_dir.glob("*.mp4")) + list(player_dir.glob("*.mov"))
        source_vids = [v for v in videos if "clip" not in v.name.lower()]
        if source_vids:
            main_video = source_vids[0]
        elif videos:
            main_video = videos[0]
            
        if not main_video:
            print(f"Skipping {player_dir.name}: No video found.")
            continue

        cap = cv2.VideoCapture(str(main_video))
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if fps <= 0:
            fps = 30.0
        cap.release()

        # Format matches what the system expects
        manual_data = {
            "source_video": f"Mechanics Analysis/{player_dir.name}/{main_video.name}",
            "fps": round(fps, 3),
            "width": width,
            "height": height,
            "player": player_dir.name,
            "session": "mechanics_eval",
            "clips": [
                {
                    "pitch_idx": 1,
                    "angle": "open_side",
                    "start_frame": 0,
                    "end_frame": total_frames - 1
                }
            ]
        }

        with open(manual_json_path, "w") as f:
            json.dump(manual_data, f, indent=2)
            
        print(f"Created manual_clips.json for {player_dir.name}")
        count += 1
        
    print(f"\nCreated {count} new manual_clips.json files.")

if __name__ == "__main__":
    main()
