"""
FFmpeg helpers for ingest clip extraction.

FFmpeg is optional; callers can fall back to OpenCV clip writing when absent.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Optional

import cv2


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def has_ffprobe() -> bool:
    return shutil.which("ffprobe") is not None


def ffprobe_video(path: str | Path) -> Optional[dict]:
    if not has_ffprobe():
        return None
    src = str(Path(path))
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        src,
    ]
    try:
        proc = subprocess.run(cmd, check=True, capture_output=True, text=True)
        data = json.loads(proc.stdout)
    except Exception:
        return None

    v_stream = None
    for s in data.get("streams", []):
        if s.get("codec_type") == "video":
            v_stream = s
            break
    if v_stream is None:
        return None
    return {
        "fps": v_stream.get("avg_frame_rate"),
        "width": int(v_stream.get("width", 0)),
        "height": int(v_stream.get("height", 0)),
        "duration_s": float(data.get("format", {}).get("duration", 0.0)),
    }


def cut_clip_ffmpeg(
    src_path: str | Path,
    out_path: str | Path,
    start_s: float,
    end_s: float,
    stream_copy: bool = True,
) -> bool:
    if not has_ffmpeg():
        return False
    src = str(Path(src_path))
    out = str(Path(out_path))
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    if end_s <= start_s:
        return False

    duration = end_s - start_s
    if stream_copy:
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            f"{start_s:.3f}",
            "-i",
            src,
            "-t",
            f"{duration:.3f}",
            "-c",
            "copy",
            "-an",
            out,
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            return True
        except Exception:
            # Fall through to re-encode if copy fails on keyframe boundaries.
            pass

    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        f"{start_s:.3f}",
        "-i",
        src,
        "-t",
        f"{duration:.3f}",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        out,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        return True
    except Exception:
        return False


def cut_clip_opencv(
    src_path: str | Path,
    out_path: str | Path,
    start_s: float,
    end_s: float,
) -> bool:
    if end_s <= start_s:
        return False
    src = str(Path(src_path))
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        return False
    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS)) or 30.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        start_frame = max(0, int(round(start_s * fps)))
        end_frame = max(start_frame + 1, int(round(end_s * fps)))
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

        writer = cv2.VideoWriter(
            str(out),
            cv2.VideoWriter_fourcc(*"mp4v"),
            fps,
            (width, height),
        )
        if not writer.isOpened():
            return False
        try:
            for _ in range(start_frame, end_frame):
                ok, frame = cap.read()
                if not ok:
                    break
                writer.write(frame)
        finally:
            writer.release()
    finally:
        cap.release()
    return out.exists()


def cut_clip(
    src_path: str | Path,
    out_path: str | Path,
    start_s: float,
    end_s: float,
) -> bool:
    """Try FFmpeg first, fallback to OpenCV."""
    if cut_clip_ffmpeg(src_path, out_path, start_s, end_s, stream_copy=True):
        return True
    return cut_clip_opencv(src_path, out_path, start_s, end_s)

