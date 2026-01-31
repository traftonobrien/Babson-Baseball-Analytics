"""Segment pitches from a full inning video.

Modes:
  --manual   Interactive scrubber: mark Target (T) and Arrival (A) per pitch,
             export padded clips via ffmpeg, write pitch_log.json.
  (default)  Auto-detect pitches via motion analysis in a mound ROI.

Manual mode hotkeys:
  Space       pause / play
  Left / j    step -1 frame (paused)
  Right / l   step +1 frame (paused)
  J           step -10 frames (paused)
  L           step +10 frames (paused)
  t           set TARGET frame for current pitch
  a           set ARRIVAL frame for current pitch
  n           finalize pitch (requires T and A), start next
  u           undo last finalized pitch
  q           quit and write outputs

Example commands:
  # Manual: single inning
  python3 src/segment_pitches.py --manual --video sourcevideo/inning1.mp4 \\
      --output-dir outings/2024-01-15

  # Manual: multi-inning (run once per video, same output dir;
  #   pitch numbering auto-continues from existing clips)
  python3 src/segment_pitches.py --manual --video sourcevideo/inning1.mp4 \\
      --output-dir outings/2024-01-15
  python3 src/segment_pitches.py --manual --video sourcevideo/inning2.mp4 \\
      --output-dir outings/2024-01-15

  # Auto mode (unchanged)
  python3 src/segment_pitches.py --video sourcevideo/inning1.mp4 \\
      --output-dir outings/2024-01-15
"""

import argparse
import json
import os
import subprocess
import shutil
import cv2
import numpy as np


def detect_pitches(video_path, roi=None, min_gap=3.0,
                   delivery_threshold_pct=30, cooldown_frames=10):
    """Detect pitch delivery frames via motion analysis in a mound ROI.

    Uses frame differencing within an ROI to build a motion signal, then
    finds peaks that correspond to pitch deliveries.

    Args:
        video_path: Path to video file.
        roi: (x, y, w, h) region of interest around the mound. None = auto.
        min_gap: Minimum seconds between pitches.
        motion_threshold: Minimum peak motion magnitude to count as a pitch.
        delivery_threshold_pct: Percentage of peak motion to use as detection
            threshold (lower = more sensitive).
        cooldown_frames: Frames to skip after detecting a peak.

    Returns:
        List of dicts with delivery_frame, start_frame, end_frame, timestamp.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    min_gap_frames = int(min_gap * fps)

    # Auto ROI: center-field camera, mound is roughly center of frame
    if roi is None:
        roi_x = int(w * 0.3)
        roi_y = int(h * 0.15)
        roi_w = int(w * 0.4)
        roi_h = int(h * 0.55)
        roi = (roi_x, roi_y, roi_w, roi_h)

    print(f"Video: {w}x{h} @ {fps:.1f}fps, {total_frames} frames")
    print(f"ROI: x={roi[0]}, y={roi[1]}, w={roi[2]}, h={roi[3]}")
    print(f"Min gap between pitches: {min_gap}s ({min_gap_frames} frames)")

    # Pass 1: compute per-frame motion signal
    print("Pass 1: Computing motion signal...")
    motion_signal = []
    prev_gray = None
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        rx, ry, rw, rh = roi
        crop = frame[ry:ry+rh, rx:rx+rw]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            motion = np.mean(diff)
            motion_signal.append(motion)
        else:
            motion_signal.append(0.0)

        prev_gray = gray
        frame_idx += 1

        if frame_idx % 1000 == 0:
            print(f"  Processed {frame_idx}/{total_frames} frames...")

    cap.release()
    print(f"  Done. {len(motion_signal)} frames processed.")

    # Smooth the motion signal
    kernel_size = int(fps * 0.3)  # ~0.3 second smoothing window
    if kernel_size % 2 == 0:
        kernel_size += 1
    kernel = np.ones(kernel_size) / kernel_size
    smoothed = np.convolve(motion_signal, kernel, mode='same')

    # Pass 2: find peaks (pitch deliveries)
    # Adaptive threshold: use a percentage of the max motion
    max_motion = np.max(smoothed)
    threshold = max_motion * delivery_threshold_pct / 100
    print(f"Motion range: {np.min(smoothed):.1f} - {max_motion:.1f}")
    print(f"Detection threshold: {threshold:.1f}")

    pitches = []
    i = 0
    while i < len(smoothed):
        if smoothed[i] >= threshold:
            # Find the peak within this active region
            region_start = i
            while i < len(smoothed) and smoothed[i] >= threshold * 0.5:
                i += 1
            region_end = i

            peak_idx = region_start + np.argmax(smoothed[region_start:region_end])

            # Check minimum gap from last pitch
            if pitches and (peak_idx - pitches[-1]["delivery_frame"]) < min_gap_frames:
                continue

            # Clip boundaries: 2 seconds before/after delivery
            pad = int(2 * fps)
            start = max(0, peak_idx - pad)
            end = min(total_frames - 1, peak_idx + pad)

            pitches.append({
                "delivery_frame": int(peak_idx),
                "start_frame": int(start),
                "end_frame": int(end),
                "timestamp": round(peak_idx / fps, 3),
                "motion_peak": round(float(smoothed[peak_idx]), 2),
            })

            # Skip past this region + cooldown
            i = region_end + cooldown_frames
        else:
            i += 1

    print(f"Detected {len(pitches)} pitches")
    return pitches, fps, (w, h), motion_signal, smoothed


def save_clips(video_path, pitches, output_dir, fps, frame_size):
    """Extract individual pitch clips from the video."""
    clips_dir = os.path.join(output_dir, "clips")
    os.makedirs(clips_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    w, h = frame_size
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")

    for idx, pitch in enumerate(pitches):
        clip_path = os.path.join(clips_dir, f"pitch_{idx+1:03d}.mp4")
        writer = cv2.VideoWriter(clip_path, fourcc, fps, (w, h))

        cap.set(cv2.CAP_PROP_POS_FRAMES, pitch["start_frame"])
        for f in range(pitch["start_frame"], pitch["end_frame"] + 1):
            ret, frame = cap.read()
            if not ret:
                break
            writer.write(frame)

        writer.release()
        print(f"  pitch_{idx+1:03d}.mp4  (frames {pitch['start_frame']}-{pitch['end_frame']}, "
              f"delivery @ {pitch['delivery_frame']}, t={pitch['timestamp']:.1f}s)")

    cap.release()


def save_motion_plot(motion_signal, smoothed, pitches, fps, output_dir):
    """Save the motion signal as a PNG plot using OpenCV drawing."""
    plot_w, plot_h = 1600, 400
    img = np.zeros((plot_h, plot_w, 3), dtype=np.uint8)
    img[:] = (30, 30, 30)

    n = len(smoothed)
    if n == 0:
        return

    max_val = max(np.max(smoothed), 1)

    # Draw raw signal (dim)
    for i in range(1, n):
        x0 = int((i - 1) / n * plot_w)
        x1 = int(i / n * plot_w)
        y0 = plot_h - int(motion_signal[i - 1] / max_val * (plot_h - 40)) - 20
        y1 = plot_h - int(motion_signal[i] / max_val * (plot_h - 40)) - 20
        cv2.line(img, (x0, y0), (x1, y1), (60, 60, 60), 1)

    # Draw smoothed signal
    for i in range(1, n):
        x0 = int((i - 1) / n * plot_w)
        x1 = int(i / n * plot_w)
        y0 = plot_h - int(smoothed[i - 1] / max_val * (plot_h - 40)) - 20
        y1 = plot_h - int(smoothed[i] / max_val * (plot_h - 40)) - 20
        cv2.line(img, (x0, y0), (x1, y1), (200, 200, 0), 1)

    # Mark detected pitches
    for idx, p in enumerate(pitches):
        x = int(p["delivery_frame"] / n * plot_w)
        cv2.line(img, (x, 0), (x, plot_h), (0, 0, 220), 1)
        cv2.putText(img, f"P{idx+1}", (x + 2, 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 220), 1)

    # Labels
    cv2.putText(img, "Motion Signal (yellow=smoothed, gray=raw, red=detected pitches)",
                (10, plot_h - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (180, 180, 180), 1)

    plot_path = os.path.join(output_dir, "motion_signal.png")
    cv2.imwrite(plot_path, img)
    print(f"Saved motion plot to {plot_path}")


def review_pitches(video_path, pitches, fps, frame_size):
    """Interactive review: play each candidate clip and prompt y/n in terminal.

    For each candidate, writes a temp clip, opens it in the system player,
    then asks the user to confirm in the terminal.
    """
    import subprocess
    import tempfile

    cap = cv2.VideoCapture(video_path)
    w, h = frame_size
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    accepted = []

    print(f"\nReview mode: {len(pitches)} candidates")
    print("Each clip will open in your video player.")
    print("After watching, answer in this terminal.\n")

    for i, pitch in enumerate(pitches):
        print(f"--- Candidate {i+1}/{len(pitches)} | "
              f"Frame {pitch['delivery_frame']} | t={pitch['timestamp']:.1f}s | "
              f"motion={pitch['motion_peak']:.2f} ---")

        # Write temp clip
        tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        tmp_path = tmp.name
        tmp.close()

        writer = cv2.VideoWriter(tmp_path, fourcc, fps, (w, h))
        cap.set(cv2.CAP_PROP_POS_FRAMES, pitch["start_frame"])
        for f in range(pitch["start_frame"], pitch["end_frame"] + 1):
            ret, frame = cap.read()
            if not ret:
                break
            writer.write(frame)
        writer.release()

        # Open in system player
        subprocess.Popen(["open", tmp_path])

        # Prompt in terminal
        while True:
            answer = input(f"  Is this a real pitch? (y/n/q to quit): ").strip().lower()
            if answer in ("y", "n", "q"):
                break
            print("  Please enter y, n, or q.")

        if answer == "y":
            accepted.append(pitch)
            print(f"  ACCEPTED ({len(accepted)} so far)")
        elif answer == "q":
            print("  Review stopped.")
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            break
        else:
            print(f"  rejected")

        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    cap.release()
    print(f"\nAccepted {len(accepted)} of {len(pitches)} candidates")
    return accepted


def _export_clip_ffmpeg(video_path, start_frame, end_frame, fps, clip_path):
    """Cut a clip using ffmpeg for speed and H.264/yuv420p output."""
    ss = start_frame / fps
    to = (end_frame + 1) / fps
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{ss:.4f}",
        "-to", f"{to:.4f}",
        "-i", video_path,
        "-an",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-preset", "veryfast", "-crf", "18",
        clip_path,
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        print(f"  ffmpeg failed for {clip_path}, falling back to cv2")
        return False
    return True


def _export_clip_cv2(video_path, start_frame, end_frame, fps, clip_path):
    """Fallback clip export using cv2.VideoWriter."""
    cap = cv2.VideoCapture(video_path)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(clip_path, fourcc, fps, (w, h))

    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    for _ in range(end_frame - start_frame + 1):
        ret, frame = cap.read()
        if not ret:
            break
        writer.write(frame)

    writer.release()
    cap.release()


def _has_ffmpeg():
    """Check if ffmpeg is available."""
    return shutil.which("ffmpeg") is not None


def _next_pitch_num_from_dir(clips_dir):
    """Scan clips dir for existing pitch_NNN.mp4 and return max+1."""
    if not os.path.isdir(clips_dir):
        return 1
    nums = []
    for f in os.listdir(clips_dir):
        if f.startswith("pitch_") and f.endswith(".mp4"):
            try:
                nums.append(int(f[6:9]))
            except ValueError:
                pass
    return max(nums) + 1 if nums else 1


def manual_segment(video_path, output_dir, pad_before=10, pad_after=10, player_meta=None):
    """Interactive scrubber for manually marking Target/Arrival per pitch.

    Exports each clip immediately on finalize (n).  Undo (u) deletes the
    clip file.  On quit (q), writes pitch_log.json compatible with
    batch_process.py.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    vw = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    vh = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    clips_dir = os.path.join(output_dir, "clips")
    os.makedirs(clips_dir, exist_ok=True)

    use_ffmpeg = _has_ffmpeg()
    if not use_ffmpeg:
        print("WARNING: ffmpeg not found. Install it: brew install ffmpeg")
        print("Falling back to cv2.VideoWriter (mp4v, lower quality)")
    else:
        print("Using ffmpeg for clip export (H.264/yuv420p)")

    # Auto-detect starting pitch number from existing clips
    pitch_num = _next_pitch_num_from_dir(clips_dir)

    print(f"Video: {os.path.basename(video_path)} ({vw}x{vh}, {fps:.1f}fps, {total} frames)")
    print(f"Pad: {pad_before} before target, {pad_after} after arrival")
    print(f"Starting at pitch #{pitch_num} (auto-detected from {clips_dir})")
    print()
    print("Hotkeys: Space=pause/play  j/l=step 1  J/L=step 10  "
          "t=Target  a=Arrival  n=finalize  u=undo  q=quit")

    win = "Manual Pitch Segmentation"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.createTrackbar("Frame", win, 0, total - 1, lambda x: None)

    paused = True
    current = 0
    target_frame = None
    arrival_frame = None
    finalized = []  # list of log entry dicts (already exported)

    def _export_current():
        """Export clip for the current target/arrival, return log entry dict."""
        start = max(0, target_frame - pad_before)
        end = min(total - 1, arrival_frame + pad_after)
        clip_name = f"pitch_{pitch_num:03d}.mp4"
        clip_path = os.path.join(clips_dir, clip_name)

        target_in_clip = target_frame - start
        arrival_in_clip = arrival_frame - start

        if use_ffmpeg:
            ok = _export_clip_ffmpeg(video_path, start, end, fps, clip_path)
            if not ok:
                _export_clip_cv2(video_path, start, end, fps, clip_path)
        else:
            _export_clip_cv2(video_path, start, end, fps, clip_path)

        clip_frames = end - start + 1
        print(f"  Exported {clip_name}  ({clip_frames} frames, abs {start}-{end})")

        return {
            "pitch": pitch_num,
            "clip": clip_name,
            "target_frame": target_in_clip,
            "arrival_frame": arrival_in_clip,
            "source_video": os.path.basename(video_path),
            "target_frame_abs": target_frame,
            "arrival_frame_abs": arrival_frame,
            "clip_start_frame_abs": start,
            "clip_end_frame_abs": end,
            "fps": round(fps, 2),
        }

    while True:
        # Sync trackbar position
        tb_pos = cv2.getTrackbarPos("Frame", win)
        if paused:
            if tb_pos != current:
                current = tb_pos
        else:
            current += 1
            if current >= total:
                current = total - 1
                paused = True
            cv2.setTrackbarPos("Frame", win, current)

        cap.set(cv2.CAP_PROP_POS_FRAMES, current)
        ret, img = cap.read()
        if not ret:
            break

        fh, fw = img.shape[:2]

        # --- HUD ---
        ts = current / fps
        cv2.putText(img, f"Frame {current}/{total-1}  ({ts:.2f}s)",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        state = "PAUSED" if paused else "PLAYING"
        cv2.putText(img, state, (fw - 160, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                    (0, 200, 255) if paused else (0, 255, 0), 2)
        cv2.putText(img, f"Pitch #{pitch_num}  |  Finalized: {len(finalized)}",
                    (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)

        if target_frame is not None:
            cv2.putText(img, f"TARGET: {target_frame}",
                        (10, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            if current == target_frame:
                cv2.rectangle(img, (0, 0), (fw - 1, fh - 1), (0, 255, 0), 4)

        if arrival_frame is not None:
            cv2.putText(img, f"ARRIVAL: {arrival_frame}",
                        (10, 125), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
            if current == arrival_frame:
                cv2.rectangle(img, (0, 0), (fw - 1, fh - 1), (0, 165, 255), 4)

        # Bottom help
        help_line = "[Space] Play/Pause  [j/l] Step 1  [J/L] Step 10  [t] Target  [a] Arrival  [n] Next  [u] Undo  [q] Quit"
        cv2.putText(img, help_line,
                    (10, fh - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (180, 180, 180), 1)

        cv2.imshow(win, img)
        delay = max(1, int(1000 / fps)) if not paused else 30
        key = cv2.waitKey(delay) & 0xFF

        # --- Handle keys ---
        if key == ord(' '):
            paused = not paused

        elif key == ord('t'):
            target_frame = current
            print(f"  Pitch #{pitch_num}: target = frame {target_frame}")

        elif key == ord('a'):
            arrival_frame = current
            print(f"  Pitch #{pitch_num}: arrival = frame {arrival_frame}")

        elif key == ord('n'):
            if target_frame is None or arrival_frame is None:
                print("  Set both Target (t) and Arrival (a) before finalizing.")
            elif target_frame >= arrival_frame:
                print("  Target must be before Arrival.")
            else:
                entry = _export_current()
                finalized.append(entry)
                print(f"  Pitch #{pitch_num} finalized: T={target_frame}, A={arrival_frame}")
                pitch_num += 1
                target_frame = None
                arrival_frame = None

        elif key == ord('u'):
            if finalized:
                undone = finalized.pop()
                # Delete the exported clip file
                clip_path = os.path.join(clips_dir, undone["clip"])
                try:
                    os.unlink(clip_path)
                    print(f"  Deleted {undone['clip']}")
                except OSError:
                    pass
                pitch_num = undone["pitch"]
                target_frame = undone["target_frame_abs"]
                arrival_frame = undone["arrival_frame_abs"]
                print(f"  Undid pitch #{pitch_num}: T={target_frame}, A={arrival_frame}")
            else:
                print("  Nothing to undo.")

        elif key == ord('q'):
            break

        # Frame stepping (paused only)
        elif paused and key in (ord('j'), 81, 2):  # j, left arrow
            current = max(0, current - 1)
            cv2.setTrackbarPos("Frame", win, current)
        elif paused and key in (ord('l'), 83, 3):  # l, right arrow
            current = min(total - 1, current + 1)
            cv2.setTrackbarPos("Frame", win, current)
        elif paused and key == ord('J'):
            current = max(0, current - 10)
            cv2.setTrackbarPos("Frame", win, current)
        elif paused and key == ord('L'):
            current = min(total - 1, current + 10)
            cv2.setTrackbarPos("Frame", win, current)

        # Check window close
        try:
            if cv2.getWindowProperty(win, cv2.WND_PROP_VISIBLE) < 1:
                break
        except cv2.error:
            break

    cap.release()
    cv2.destroyWindow(win)
    for _ in range(10):
        cv2.waitKey(1)

    if not finalized:
        print("No pitches finalized.")
        return

    # --- Write pitch_log.json ---
    log_path = os.path.join(output_dir, "pitch_log.json")

    # Merge with existing log if present (multi-inning)
    existing_pitches = []
    if os.path.exists(log_path):
        with open(log_path) as f:
            existing = json.load(f)
        existing_pitches = existing.get("pitches", [])
        print(f"  Merging with existing pitch_log.json ({len(existing_pitches)} pitches)")

    all_pitches = existing_pitches + finalized
    log = {
        "videos": sorted(set(
            p.get("source_video", "") for p in all_pitches
        )),
        "pitches": all_pitches,
    }
    # Embed player metadata if provided
    if player_meta:
        log.update(player_meta)
    with open(log_path, "w") as f:
        json.dump(log, f, indent=2)
    print(f"Saved pitch_log.json ({len(all_pitches)} total pitches)")
    print(f"\nDone. {len(finalized)} clips in {clips_dir}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Segment pitches from inning video (manual or auto mode)",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--video", required=True, help="Path to full inning video")
    parser.add_argument("--output-dir", required=True, help="Output directory for clips and log")
    parser.add_argument("--manual", action="store_true",
                        help="Manual mode: scrub video and mark Target/Arrival per pitch")
    parser.add_argument("--pad-before", type=int, default=10,
                        help="[manual] Frames to pad before target frame (default: 10)")
    parser.add_argument("--pad-after", type=int, default=10,
                        help="[manual] Frames to pad after arrival frame (default: 10)")
    # Auto mode flags
    parser.add_argument("--min-gap", type=float, default=3.0,
                        help="[auto] Minimum seconds between pitches (default: 3.0)")
    parser.add_argument("--roi", type=int, nargs=4, metavar=("X", "Y", "W", "H"),
                        default=None, help="[auto] ROI around mound (default: auto)")
    parser.add_argument("--threshold-pct", type=int, default=30,
                        help="[auto] Motion threshold as %% of peak (default: 30)")
    parser.add_argument("--no-clips", action="store_true",
                        help="[auto] Skip clip extraction (just detect and log)")
    parser.add_argument("--review", action="store_true",
                        help="[auto] Interactively review each candidate pitch (y/n)")
    parser.add_argument("--player-id", type=str, default=None,
                        help="Player ID for metadata in pitch_log.json")
    parser.add_argument("--pitcher-hand", choices=["R", "L"], default=None,
                        help="Pitcher hand (auto-resolved from arsenals if --player-id given)")
    parser.add_argument("--arsenals-csv", type=str, default="data/Arsenals.csv",
                        help="Path to Arsenals.csv (default: data/Arsenals.csv)")
    args = parser.parse_args()

    # Resolve player metadata from arsenals
    _player_meta = {}
    if args.player_id:
        from src.arsenals import get_player_name, get_player_hand
        _player_meta["player_id"] = args.player_id
        _pname = get_player_name(args.player_id, csv_path=args.arsenals_csv)
        if _pname:
            _player_meta["player_name"] = _pname
        hand = args.pitcher_hand or get_player_hand(args.player_id, csv_path=args.arsenals_csv)
        if hand:
            _player_meta["pitcher_hand"] = hand
    elif args.pitcher_hand:
        _player_meta["pitcher_hand"] = args.pitcher_hand

    if args.manual:
        manual_segment(
            video_path=args.video,
            output_dir=args.output_dir,
            pad_before=args.pad_before,
            pad_after=args.pad_after,
            player_meta=_player_meta,
        )
    else:
        roi = tuple(args.roi) if args.roi else None

        pitches, fps, frame_size, motion_raw, motion_smooth = detect_pitches(
            args.video, roi=roi, min_gap=args.min_gap,
            delivery_threshold_pct=args.threshold_pct,
        )

        # Interactive review
        if args.review and pitches:
            pitches = review_pitches(args.video, pitches, fps, frame_size)

        os.makedirs(args.output_dir, exist_ok=True)

        # Save pitch log
        log = {
            "video": args.video,
            "fps": round(fps, 2),
            "total_pitches": len(pitches),
            "min_gap_seconds": args.min_gap,
            "pitches": pitches,
        }
        if _player_meta:
            log.update(_player_meta)
        log_path = os.path.join(args.output_dir, "pitch_log.json")
        with open(log_path, "w") as f:
            json.dump(log, f, indent=2)
        print(f"Saved pitch log to {log_path}")

        # Save motion plot
        save_motion_plot(motion_raw, motion_smooth, pitches, fps, args.output_dir)

        # Extract clips
        if not args.no_clips:
            print(f"Saving clips to {args.output_dir}/clips/")
            save_clips(args.video, pitches, args.output_dir, fps, frame_size)

        print(f"\nDone. Detected {len(pitches)} pitches.")
