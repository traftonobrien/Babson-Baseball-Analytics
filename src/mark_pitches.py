"""Manual pitch marking: scrub through full inning video(s), mark T/A frames + pitch type, batch-cut clips."""

import argparse
import json
import os
import sys

import cv2

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _build_arsenal_hud(arsenal):
    """Build HUD string and key map for arsenal pitch type selection.

    Returns (hud_str, key_map) where key_map maps key ordinals to abbreviations.
    """
    if not arsenal:
        return "", {}
    parts = []
    key_map = {}
    for i, pitch in enumerate(arsenal):
        num = i + 1
        if num > 9:
            break
        abbrev = pitch.get("abbreviation", "")
        parts.append(f"[{num}]={abbrev}")
        key_map[ord(str(num))] = abbrev
    hud_str = "  ".join(parts)
    return hud_str, key_map


def mark_pitches_in_video(video_path, video_index, pitch_start_num, arsenal=None):
    """Open a scrubber for one video. User marks T/A and pitch type for each pitch.

    Returns list of pitch dicts and the next pitch number.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"\nVideo {video_index}: {os.path.basename(video_path)} "
          f"({w}x{h}, {fps:.1f}fps, {total} frames)")

    arsenal_hud, arsenal_keys = _build_arsenal_hud(arsenal or [])

    win = "Mark Pitches - T=target, A=arrival, Enter=confirm, N=undo, Q=done"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.createTrackbar("Frame", win, 0, total - 1, lambda x: None)

    pitches = []
    pitch_num = pitch_start_num
    target_frame = None
    arrival_frame = None
    pitch_type = ""
    current = 0

    while True:
        pos = cv2.getTrackbarPos("Frame", win)
        if pos != current:
            current = pos

        cap.set(cv2.CAP_PROP_POS_FRAMES, current)
        ret, img = cap.read()
        if not ret:
            break

        fh, fw = img.shape[:2]

        # HUD
        cv2.putText(img, f"Frame {current}/{total-1}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(img, f"Pitch #{pitch_num} | Marked: {len(pitches)}",
                    (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)

        if target_frame is not None:
            cv2.putText(img, f"TARGET: {target_frame}", (10, 90),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            if current == target_frame:
                cv2.rectangle(img, (0, 0), (fw - 1, fh - 1), (0, 255, 0), 4)

        if arrival_frame is not None:
            cv2.putText(img, f"ARRIVAL: {arrival_frame}", (10, 120),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
            if current == arrival_frame:
                cv2.rectangle(img, (0, 0), (fw - 1, fh - 1), (0, 165, 255), 4)

        if pitch_type:
            cv2.putText(img, f"TYPE: {pitch_type}", (10, 150),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 200, 0), 2)

        # Bottom HUD
        help_line = "[T] Target  [A] Arrival  [Enter] Confirm  [N] Undo  [Q] Done"
        cv2.putText(img, help_line,
                    (10, fh - 35), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)
        if arsenal_hud:
            cv2.putText(img, f"Pitch type: {arsenal_hud}",
                        (10, fh - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 200, 0), 1)

        cv2.imshow(win, img)
        key = cv2.waitKey(30) & 0xFF

        if key == ord('t') or key == ord('T'):
            target_frame = current
            print(f"  Pitch #{pitch_num}: target = {target_frame}")

        elif key == ord('a') or key == ord('A'):
            arrival_frame = current
            print(f"  Pitch #{pitch_num}: arrival = {arrival_frame}")

        elif key in arsenal_keys:
            pitch_type = arsenal_keys[key]
            print(f"  Pitch #{pitch_num}: type = {pitch_type}")

        elif key == 13:  # Enter - confirm this pitch
            if target_frame is not None and arrival_frame is not None:
                pitches.append({
                    "pitch": pitch_num,
                    "video_index": video_index,
                    "target_frame": target_frame,
                    "arrival_frame": arrival_frame,
                    "pitch_type": pitch_type,
                })
                print(f"  Pitch #{pitch_num} confirmed: T={target_frame}, A={arrival_frame}, type={pitch_type or '(none)'}")
                pitch_num += 1
                target_frame = None
                arrival_frame = None
                pitch_type = ""
            else:
                print("  Set both T and A before confirming.")

        elif key == ord('n') or key == ord('N'):
            target_frame = None
            arrival_frame = None
            pitch_type = ""
            print(f"  Pitch #{pitch_num}: reset T/A/type")

        elif key == ord('q') or key == ord('Q'):
            break

    cv2.destroyWindow(win)
    cap.release()
    return pitches, pitch_num


def cut_clips(video_paths, pitches, output_dir, pad=5):
    """Cut clips from source videos based on marked T/A frames.

    Each clip = target_frame - pad to arrival_frame + pad.
    """
    clips_dir = os.path.join(output_dir, "clips")
    os.makedirs(clips_dir, exist_ok=True)

    # Group pitches by video_index
    by_video = {}
    for p in pitches:
        by_video.setdefault(p["video_index"], []).append(p)

    for vid_idx, vid_pitches in sorted(by_video.items()):
        cap = cv2.VideoCapture(video_paths[vid_idx])
        fps = cap.get(cv2.CAP_PROP_FPS)
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")

        for p in vid_pitches:
            start = max(0, p["target_frame"] - pad)
            end = min(total - 1, p["arrival_frame"] + pad)
            clip_path = os.path.join(clips_dir, f"pitch_{p['pitch']:03d}.mp4")

            writer = cv2.VideoWriter(clip_path, fourcc, fps, (w, h))
            cap.set(cv2.CAP_PROP_POS_FRAMES, start)
            for _ in range(start, end + 1):
                ret, frame = cap.read()
                if not ret:
                    break
                writer.write(frame)
            writer.release()

            clip_frames = end - start + 1
            print(f"  pitch_{p['pitch']:03d}.mp4  ({clip_frames} frames, "
                  f"abs {start}-{end})")

        cap.release()


def main():
    parser = argparse.ArgumentParser(
        description="Mark pitches in full inning video(s) and cut clips")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--video", help="Single video file")
    group.add_argument("--videos", nargs="+", help="Multiple video files (processed in order)")
    parser.add_argument("--output-dir", required=True,
                        help="Output directory for clips and pitch_log.json")
    parser.add_argument("--pad", type=int, default=5,
                        help="Frames to pad before T and after A (default: 5)")
    parser.add_argument("--player-id", type=str, default=None,
                        help="Player ID for arsenal-based pitch type selection")
    parser.add_argument("--sheet-id", type=str, default=None,
                        help="Google Sheet ID for player data")
    args = parser.parse_args()

    video_paths = args.videos if args.videos else [args.video]

    # Verify all videos exist
    for vp in video_paths:
        if not os.path.isfile(vp):
            print(f"Error: video not found: {vp}")
            return

    # Load arsenal for pitch type keys
    arsenal = []
    if args.player_id:
        from src.sheets_sync import get_player, get_default_sheet_id
        sheet_id = args.sheet_id or get_default_sheet_id()
        player_info = get_player(args.player_id, sheet_id=sheet_id)
        arsenal = player_info.get("arsenal", [])
        if arsenal:
            abbrevs = [p.get("abbreviation", "") for p in arsenal]
            print(f"Arsenal for {args.player_id}: {abbrevs}")
            print("Use number keys (1-9) during marking to set pitch type")
        else:
            print(f"No arsenal found for {args.player_id}")

    all_pitches = []
    next_num = 1

    for vid_idx, vpath in enumerate(video_paths):
        pitches, next_num = mark_pitches_in_video(vpath, vid_idx, next_num, arsenal=arsenal)
        all_pitches.extend(pitches)

    if not all_pitches:
        print("No pitches marked. Exiting.")
        return

    print(f"\n{len(all_pitches)} pitches marked across {len(video_paths)} video(s).")

    # Save pitch log
    os.makedirs(args.output_dir, exist_ok=True)
    log = {
        "videos": [os.path.basename(vp) for vp in video_paths],
        "pitches": all_pitches,
    }
    log_path = os.path.join(args.output_dir, "pitch_log.json")
    with open(log_path, "w") as f:
        json.dump(log, f, indent=2)
    print(f"Saved pitch log to {log_path}")

    # Cut clips
    print("Cutting clips...")
    cut_clips(video_paths, all_pitches, args.output_dir, pad=args.pad)

    print(f"\nDone. Output in {args.output_dir}/")


if __name__ == "__main__":
    main()
