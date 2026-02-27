#!/usr/bin/env python3
"""
Batch evaluate mechanics on all players in the Mechanics Analysis directory.

Finds all .mp4 or .mov files for each player and runs the mechanics pipeline.
After processing, it reads the output `notes.json` files and generates a summary markdown report.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ANALYSIS_DIR = REPO_ROOT / "Mechanics Analysis"
OUTPUT_DIR = REPO_ROOT / "output" / "mechanics"
PYTHON_BIN = REPO_ROOT / ".venv" / "bin" / "python"


def find_player_videos() -> list[tuple[str, Path]]:
    """Return a list of (player_name, video_path) tuples."""
    results = []
    if not ANALYSIS_DIR.exists():
        print(f"Directory not found: {ANALYSIS_DIR}")
        return results

    for player_dir in ANALYSIS_DIR.iterdir():
        if not player_dir.is_dir() or player_dir.name.startswith("."):
            continue

        # Look for the main video file
        videos = list(player_dir.glob("*.mp4")) + list(player_dir.glob("*.mov"))
        if not videos:
            continue
            
        # Exclude smaller exported clips if present, taking the source
        source_vids = [v for v in videos if "clip" not in v.name.lower()]
        best_vid = source_vids[0] if source_vids else videos[0]
        results.append((player_dir.name, best_vid))
    
    # Sort for deterministic output
    return sorted(results, key=lambda x: x[0])


def run_pipeline(player_name: str, video_path: Path) -> bool:
    """Run the ingest and mechanics pipeline for a single video."""
    print(f"\n{'='*60}")
    print(f"Processing: {player_name}")
    print(f"Video: {video_path.name}")
    print(f"{'='*60}")
    
    player_slug = player_name.strip().replace(" ", "_").lower()
    
    # Check if they have manual clips (only Trafton does right now)
    manual_json = video_path.parent / "manual_clips.json"
    
    cmd = [
        str(PYTHON_BIN), str(REPO_ROOT / "scripts" / "run_mechanics_session.py"),
        "--hand", "R",  # Defaulting everyone to R for this test
        "--player-id", player_slug,
        "--debug-metrics", 
        "--session", "mechanics_eval"
    ]
    
    if manual_json.exists():
        print(f"Found manual anchors for {player_name}")
        # Need to export first
        export_cmd = [
            str(PYTHON_BIN), "-c",
            f"from src.ingest_manual.export import export_manual_clips; export_manual_clips('{manual_json}', overwrite=True)"
        ]
        subprocess.run(export_cmd, cwd=str(REPO_ROOT), check=True)
        # Add to mechanics command
        cmd.extend(["--manual-clips", str(manual_json)])
    else:
        cmd.extend(["--video", str(video_path)])
        
    try:
        subprocess.run(cmd, cwd=str(REPO_ROOT), check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"ERROR processing {player_name}: {e}")
        return False


def generate_report(player_videos: list[tuple[str, Path]], output_md: Path):
    """Parse notes.json files and write a markdown summary."""
    print(f"\nGenerating evaluation report at {output_md}...")
    
    with open(output_md, "w") as f:
        f.write("# Mechanics Model Evaluation Report\n\n")
        f.write(f"Generated at: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("## Summary of Processed Players\n\n")
        f.write("| Player | Status | Efficiency Score | Confidence | Issues Found |\n")
        f.write("|--------|--------|------------------|------------|--------------|\n")
        
        details = []
        
        for player_name, _ in player_videos:
            player_slug = player_name.strip().replace(" ", "_").lower()
            
            player_out = OUTPUT_DIR / player_slug
            if not player_out.exists():
                f.write(f"| {player_name} | Failed ❌ | - | - | Pipeline crashed |\n")
                continue
                
            # Find the most recent notes.json
            notes_files = list(player_out.rglob("notes.json"))
            if not notes_files:
                f.write(f"| {player_name} | Skipped ⚠️ | - | - | No notes.json found (Angle rejected?) |\n")
                continue
                
            # Sort by modification time to get the newest run
            import os
            notes_files.sort(key=lambda x: os.path.getmtime(x))
            notes_path = notes_files[-1]
            try:
                with open(notes_path) as nf:
                    notes = json.load(nf)
                
                status = notes.get("status", "completed")
                if status == "rejected":
                    reason = notes.get("reject_reason", "Unknown")
                    f.write(f"| {player_name} | Rejected ⚠️ | - | - | {reason} |\n")
                    continue
                    
                score = notes.get("efficiency_score", "N/A")
                is_low_conf = notes.get("efficiency_low_confidence", False)
                conf_str = "Low" if is_low_conf else "High"
                conf_icon = "⚠️" if is_low_conf else "✅"
                
                # Check phase detection success
                metrics = notes.get("metrics", {})
                issues = 0
                for m_id, m_data in metrics.items():
                    if m_data.get("status") == "insufficient_data":
                        issues += 1
                        
                issue_str = f"{issues} metrics failed" if issues > 0 else "None"
                
                f.write(f"| {player_name} | Success ✅ | {score}/100 | {conf_str} {conf_icon} | {issue_str} |\n")
                
                # Save details for the breakdown section
                details.append((player_name, notes))
                
            except Exception as e:
                f.write(f"| {player_name} | Error ❌ | - | - | Failed to parse JSON: {e} |\n")
        
        f.write("\n## Detailed Breakdown\n\n")
        
        for player_name, notes in details:
            f.write(f"### {player_name}\n")
            
            # Print Phases
            phases = notes.get("phases", {})
            f.write("**Phase Detection:**\n")
            for phase_name in ["set", "peak_leg_lift", "foot_strike", "ball_release"]:
                p_data = phases.get(phase_name, {})
                frame = p_data.get("frame_idx", "?")
                f.write(f"- {phase_name}: Frame {frame}\n")
                
            f.write("\n**Scoring:**\n")
            metrics = notes.get("metrics", {})
            for m_id, m_data in metrics.items():
                # Skip the debug stuff for the report
                if m_id in ["posture_v1", "balance_v1", "tilt_v1"]:
                    continue
                score = m_data.get("score_eff", "N/A")
                conf = m_data.get("confidence", 0.0)
                status = m_data.get("status", "ok")
                if status == "insufficient_data":
                    f.write(f"- {m_id}: **FAILED** (Insufficient Data)\n")
                else:
                    reliability = m_data.get("metric_reliability", "unknown")
                    f.write(f"- {m_id}: {score}/10 (Conf: {conf:.2f}, Reliability: {reliability})\n")
            f.write("\n---\n\n")


def main():
    parser = argparse.ArgumentParser(description="Batch mechanics evaluation")
    parser.add_argument("--skip-pipeline", action="store_true", help="Skip running the pipeline and just generate the report from existing output")
    args = parser.parse_args()

    videos = find_player_videos()
    print(f"Found {len(videos)} players to process.")
    
    if not args.skip_pipeline:
        for player_name, path in videos:
            if player_name == "Trafton OBrien":
                # We already did Trafton, but doing it again ensures it's fresh via auto-run logic.
                run_pipeline(player_name, path)
            else:
                run_pipeline(player_name, path)
                
    report_path = REPO_ROOT / "evaluation_results.md"
    generate_report(videos, report_path)
    print(f"Complete! Check {report_path.name}")


if __name__ == "__main__":
    main()
