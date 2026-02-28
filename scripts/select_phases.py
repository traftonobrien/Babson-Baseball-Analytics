#!/usr/bin/env python3
"""
Interactive phase anchor selector.

Opens a video clip in an OpenCV window with a scrub bar. The user marks
three key phases by pressing keyboard keys at the desired frame:

  1 = Peak Leg Lift
  2 = Foot Strike
  3 = Ball Release

Press ENTER to save results to manual_clips.json.
Press ESC to cancel without saving.

Usage:
    .venv/bin/python scripts/select_phases.py \
        --manual-clips "Mechanics Analysis/Trafton OBrien/manual_clips.json" --pitch 1
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

REPO_ROOT = Path(__file__).resolve().parent.parent
WINDOW_NAME = "Phase Selector"

PHASE_KEYS = {
    ord("1"): "peak_leg_lift_s",
    ord("2"): "foot_strike_s",
    ord("3"): "ball_release_s",
}

PHASE_LABELS = {
    "peak_leg_lift_s": "Peak Leg Lift",
    "foot_strike_s": "Foot Strike",
    "ball_release_s": "Ball Release",
}

PHASE_COLORS = {
    "peak_leg_lift_s": (0, 200, 80),     # green
    "foot_strike_s": (0, 200, 240),       # yellow
    "ball_release_s": (30, 30, 240),      # red
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Interactively select phase anchors.")
    p.add_argument("--manual-clips", required=True, help="Path to manual_clips.json.")
    p.add_argument("--pitch", type=int, default=1, help="Pitch index (default: 1).")
    p.add_argument("--angle", default="open_side", help="Angle (default: open_side).")
    p.add_argument("--hand", default="R", choices=["R", "L"], help="Pitcher hand (default: R).")
    return p.parse_args()


def _resolve_path(path_arg: str) -> Path:
    raw = Path(path_arg).expanduser()
    if raw.is_absolute():
        return raw
    cwd_resolved = (Path.cwd() / raw).resolve()
    if cwd_resolved.exists():
        return cwd_resolved
    return (REPO_ROOT / raw).resolve()


def _load_manual_clips(path: Path) -> dict[str, Any]:
    with open(path) as f:
        return json.load(f)


def _find_clip(data: dict[str, Any], pitch_idx: int, angle: str) -> Optional[dict[str, Any]]:
    for clip in data.get("clips", []):
        if int(clip["pitch_idx"]) == pitch_idx:
            if str(clip.get("angle", "")).strip().lower() == angle.lower():
                return clip
    return None


def _find_video(data: dict[str, Any], clip: dict[str, Any]) -> tuple[Path, bool]:
    """
    Find the best video to open.

    Prefers the exported clip MP4 (constant frame rate, reliable reads).
    Falls back to source .mov (may be VFR).
    Returns (path, is_exported_clip).
    """
    player_slug = data.get("player", "").strip().lower().replace(" ", "_")
    session = data.get("session", "mechanics_latest")
    pitch_idx = int(clip["pitch_idx"])
    angle = str(clip.get("angle", "open_side")).strip().lower()

    exported = (
        REPO_ROOT / "output" / "ingest" / player_slug / session
        / "clips" / f"pitch_{pitch_idx:03d}" / f"{angle}.mp4"
    )
    if exported.exists():
        return exported.resolve(), True

    source = Path(data["source_video"])
    if not source.exists():
        source = REPO_ROOT / source
    return source.resolve(), False


def _draw_overlay(
    frame: np.ndarray,
    clip_frame: int,
    total_frames: int,
    fps: float,
    anchors: dict[str, float],
) -> np.ndarray:
    """Draw HUD showing current position and marked phases."""
    out = frame.copy()
    h, w = out.shape[:2]
    current_s = clip_frame / max(fps, 1.0)

    # Semi-transparent bar at bottom
    bar_h = 90
    overlay = out.copy()
    cv2.rectangle(overlay, (0, h - bar_h), (w, h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.7, out, 0.3, 0, out)

    # Current frame info
    info = f"Frame {clip_frame} / {total_frames}  |  {current_s:.3f}s  |  1=PLL  2=FS  3=REL  ENTER=Save  ESC=Cancel"
    cv2.putText(out, info, (10, h - bar_h + 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220, 220, 220), 1, cv2.LINE_AA)

    # Show marked phases
    y_offset = h - bar_h + 45
    for key, label in PHASE_LABELS.items():
        val = anchors.get(key)
        color = PHASE_COLORS[key]
        if val is not None:
            frame_num = int(round(val * fps))
            text = f"{label}: {val:.3f}s (frame {frame_num})"
            marker = "[SET]"
        else:
            text = f"{label}: ---"
            marker = "[   ]"
        cv2.putText(out, f"{marker} {text}", (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.40, color, 1, cv2.LINE_AA)
        y_offset += 18

    # Phase label in top-left if on a marked frame
    for key, label in PHASE_LABELS.items():
        val = anchors.get(key)
        if val is not None:
            marked_frame = int(round(val * fps))
            if clip_frame == marked_frame:
                cv2.putText(out, label.upper(), (15, 35),
                            cv2.FONT_HERSHEY_DUPLEX, 0.9, PHASE_COLORS[key], 2, cv2.LINE_AA)

    return out


def _on_trackbar(_val: int) -> None:
    pass  # Handled in main loop

def _preload_frames(video_path: Path, start: int, max_count: int) -> list[np.ndarray]:
    """
    Preload clip frames by reading the video sequentially (no seeking).

    For exported clips (start=0): reads ALL frames in the file.
    For source videos: skips to start_frame, reads max_count frames.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    frames: list[np.ndarray] = []
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx >= start:
            frames.append(frame)
            if len(frames) >= max_count:
                break
        frame_idx += 1
    cap.release()
    return frames


def main() -> None:
    args = parse_args()
    manual_path = _resolve_path(args.manual_clips)
    if not manual_path.exists():
        print(f"ERROR: manual_clips.json not found: {manual_path}")
        sys.exit(1)

    data = _load_manual_clips(manual_path)
    clip = _find_clip(data, args.pitch, args.angle)
    if clip is None:
        print(f"ERROR: No clip found for pitch {args.pitch}, angle {args.angle}")
        sys.exit(1)

    fps = float(data.get("fps", 30.0))
    start_frame = int(clip.get("start_frame", 0))
    end_frame = int(clip.get("end_frame", 0))
    video_path, is_exported = _find_video(data, clip)

    if not video_path.exists():
        print(f"ERROR: Video not found: {video_path}")
        sys.exit(1)

    # Load existing anchors
    anchors: dict[str, float] = {}
    if clip.get("phase_anchors"):
        anchors = dict(clip["phase_anchors"])

    # For exported clips, frames start at 0 and we read the whole file.
    # For source video, we skip to start_frame and read count frames.
    vid_start = 0 if is_exported else start_frame
    max_frames = 10000 if is_exported else (end_frame - start_frame + 1)

    # Preload all frames sequentially (no seeking — VFR safe)
    print(f"Loading: {video_path.name}")
    print(f"  {'Exported clip' if is_exported else 'Source video'}")
    print(f"  Preloading frames into memory...")
    frames = _preload_frames(video_path, vid_start, max_frames)

    if not frames:
        print("ERROR: No frames could be read from video.")
        sys.exit(1)

    total_frames = len(frames)  # Actual frames loaded
    print(f"  Loaded {total_frames} frames.")
    print()
    print("Controls:")
    print("  1 = Mark Peak Leg Lift")
    print("  2 = Mark Foot Strike")
    print("  3 = Mark Ball Release")
    print("  ENTER = Save and exit")
    print("  ESC = Cancel")
    print("  LEFT/RIGHT arrows = step ±1 frame")
    print("  Trackbar = scrub to any frame")
    print()

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW_NAME, 1280, 720)
    cv2.createTrackbar("Frame", WINDOW_NAME, 0, max(1, total_frames - 1), _on_trackbar)

    current_pos = 0
    need_redraw = True

    while True:
        # Sync with trackbar
        tb_pos = cv2.getTrackbarPos("Frame", WINDOW_NAME)
        if tb_pos != current_pos:
            current_pos = tb_pos
            need_redraw = True

        if need_redraw and 0 <= current_pos < total_frames:
            display = _draw_overlay(frames[current_pos], current_pos, total_frames - 1, fps, anchors)
            cv2.imshow(WINDOW_NAME, display)
            need_redraw = False

        key = cv2.waitKey(30) & 0xFF

        if key == 27:  # ESC
            print("\nCancelled — no changes saved.")
            break

        elif key in (13, 10):  # ENTER
            if not anchors:
                print("\nNo phases marked — nothing to save.")
                break
            clip["phase_anchors"] = anchors
            with open(manual_path, "w") as f:
                json.dump(data, f, indent=2)
                f.write("\n")
            print(f"\nSaved phase_anchors to {manual_path}:")
            for key_name, val in sorted(anchors.items()):
                frame_num = int(round(val * fps))
                print(f"  {key_name}: {val:.3f}s (frame {frame_num})")
            
            # Close window immediately
            cv2.destroyAllWindows()
            
            # Auto-run pipeline
            print("\n" + "="*50)
            print("Auto-running pipeline with new phase anchors...")
            print("="*50)
            
            py_exec = str(REPO_ROOT / ".venv" / "bin" / "python")
            
            # 1. Export index
            print("\n[1/2] Re-exporting index.json...")
            export_cmd = [
                py_exec, "-c",
                f"from src.ingest_manual.export import export_manual_clips; export_manual_clips('{manual_path}', overwrite=True)"
            ]
            subprocess.run(export_cmd, cwd=str(REPO_ROOT), check=True)
            
            # 2. Run mechanics session
            player_slug = data.get("player", "").strip().lower().replace(" ", "_")
            # If name is "Trafton OBrien", obrien_trafton is the roster ID pattern, but script allows player-id
            # We'll just pass the player_slug as player-id (or try basic reversal for roster id)
            parts = player_slug.split("_")
            if len(parts) >= 2:
                roster_id = f"{parts[-1]}_{'_'.join(parts[:-1])}"
            else:
                roster_id = player_slug

            print(f"\n[2/2] Running mechanics session (hand={args.hand}, player_id={roster_id})...")
            session_cmd = [
                py_exec, str(REPO_ROOT / "scripts" / "run_mechanics_session.py"),
                "--manual-clips", str(manual_path),
                "--hand", args.hand,
                "--player-id", roster_id,
                "--debug-metrics",
                "--slowmo",
                "--verbose"
            ]
            subprocess.run(session_cmd, cwd=str(REPO_ROOT), check=True)
            
            print("\nPipeline complete!")
            sys.exit(0)

        elif key in PHASE_KEYS:
            phase_key = PHASE_KEYS[key]
            time_s = round(current_pos / fps, 3)
            anchors[phase_key] = time_s
            label = PHASE_LABELS[phase_key]
            print(f"  Marked {label}: frame {current_pos} = {time_s:.3f}s")
            need_redraw = True

        elif key in (81, 2):  # LEFT arrow
            current_pos = max(0, current_pos - 1)
            cv2.setTrackbarPos("Frame", WINDOW_NAME, current_pos)
            need_redraw = True

        elif key in (83, 3):  # RIGHT arrow
            current_pos = min(total_frames - 1, current_pos + 1)
            cv2.setTrackbarPos("Frame", WINDOW_NAME, current_pos)
            need_redraw = True

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
