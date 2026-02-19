"""
Video I/O utilities for mechanics analysis.

WHAT THIS MODULE DOES:
  Wraps OpenCV's VideoCapture into clean Python functions.
  Everything that touches the video file lives here.

WHY NOT JUST USE cv2 DIRECTLY:
  VideoCapture has sharp edges — forgetting cap.release() leaks
  file handles; frame indexing is 0-based but CAP_PROP_POS_FRAMES
  is 1-indexed for seeking. Wrapping it once keeps all other code clean.
"""
from __future__ import annotations

import dataclasses
from pathlib import Path
from typing import Generator, Optional, Tuple

import cv2
import numpy as np


@dataclasses.dataclass
class VideoMeta:
    """Lightweight metadata for a video file."""
    path: str
    fps: float
    frame_count: int
    width: int
    height: int

    @property
    def duration_s(self) -> float:
        return self.frame_count / self.fps if self.fps > 0 else 0.0

    def __str__(self) -> str:
        return (
            f"VideoMeta(fps={self.fps:.2f}, frames={self.frame_count}, "
            f"size={self.width}x{self.height}, duration={self.duration_s:.2f}s, "
            f"path={Path(self.path).name})"
        )


def read_video_meta(path: str | Path) -> VideoMeta:
    """
    Read video metadata without loading any frames.

    Raises FileNotFoundError if the video cannot be opened.
    Common failure modes:
      - Wrong path (macOS paths with spaces must be passed as strings, not shell-quoted)
      - Codec not installed (rare on macOS — AVFoundation handles most formats)
    """
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    return VideoMeta(
        path=str(path),
        fps=fps,
        frame_count=frame_count,
        width=width,
        height=height,
    )


def iter_frames(
    path: str | Path,
    start: int = 0,
    end: Optional[int] = None,
    step: int = 1,
) -> Generator[Tuple[int, np.ndarray], None, None]:
    """
    Yield (frame_index, bgr_frame) tuples.

    WHAT IT DOES:
      Opens the video, seeks to `start`, then reads frames one by one.
      Yields every `step`-th frame (step=1 = every frame, step=5 = every 5th).
      Always releases the capture handle, even on early exit.

    ASSUMPTIONS:
      frame_index is 0-based and matches cv2's CAP_PROP_POS_FRAMES.

    Args:
        path:  Video file path.
        start: First frame index (0-based, default 0).
        end:   Last frame index (exclusive). None = all frames.
        step:  Frame step (default 1).
    """
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {path}")

    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if end is None:
            end = total
        end = min(end, total)

        if start > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, start)

        frame_idx = start
        while frame_idx < end:
            ret, frame = cap.read()
            if not ret:
                break
            if (frame_idx - start) % step == 0:
                yield frame_idx, frame
            frame_idx += 1
    finally:
        cap.release()


def save_frame(frame: np.ndarray, path: str | Path) -> None:
    """Save a BGR frame to disk. Creates parent directories if needed."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), frame)
