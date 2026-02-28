import subprocess
from pathlib import Path

root = Path("/Users/traftonobrien/Desktop/pitch-tracker")
mechanics_dir = root / "Mechanics Analysis"

lefties = ["Vinny Purpura"]

for manual_json in mechanics_dir.glob("*/manual_clips.json"):
    player_name = manual_json.parent.name
    hand = "L" if player_name in lefties else "R"
    
    print(f"\n{'='*50}")
    print(f"Running {player_name} ({hand}HP)...")
    print(f"{'='*50}")
    
    cmd = [
        str(root / ".venv/bin/python"),
        str(root / "scripts/run_mechanics_session.py"),
        "--manual-clips", str(manual_json),
        "--hand", hand,
        "--verbose"
    ]
    
    subprocess.run(cmd, cwd=root)

print("\nAll done!")
