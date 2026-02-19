"""
Exporter for manual multi-angle clips.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable, Optional

from src.ingest.ffmpeg_utils import cut_clip_opencv
from .schema import ManualClipsDoc, load_manual_clips
from .utils import build_manual_index, clip_rel_path, ingest_session_dir, normalize_angle

MAX_EXPORT_ANGLES_PER_PITCH = 3


def _clip_sort_key(clip: Any) -> tuple[int, int, str]:
    order = getattr(clip, "order", None)
    if order is None:
        order = 10_000
    return int(order), int(clip.start_frame), str(clip.angle)


def _select_export_clips(clips: list[Any]) -> list[Any]:
    by_pitch: dict[int, list[Any]] = {}
    for clip in clips:
        by_pitch.setdefault(int(clip.pitch_idx), []).append(clip)

    selected: list[Any] = []
    for pitch_idx in sorted(by_pitch.keys()):
        ordered = sorted(by_pitch[pitch_idx], key=_clip_sort_key)
        selected.extend(ordered[:MAX_EXPORT_ANGLES_PER_PITCH])
    return selected


def frame_range_to_timestamps(
    start_frame: int,
    end_frame: int,
    fps: float,
) -> tuple[float, float]:
    fps = max(float(fps), 1e-6)
    start_s = float(start_frame) / fps
    end_s = float(end_frame + 1) / fps
    return start_s, end_s


def build_ffmpeg_command(
    source_video: str | Path,
    out_path: str | Path,
    start_s: float,
    end_s: float,
    keep_audio: bool = False,
) -> list[str]:
    duration = max(0.0, end_s - start_s)
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        f"{start_s:.3f}",
        "-i",
        str(source_video),
        "-t",
        f"{duration:.3f}",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
    ]
    if not keep_audio:
        cmd.append("-an")
    cmd.append(str(out_path))
    return cmd


def _run_ffmpeg_clip(
    source_video: Path,
    out_path: Path,
    start_s: float,
    end_s: float,
    keep_audio: bool,
    runner: Callable[..., subprocess.CompletedProcess] = subprocess.run,
) -> bool:
    if shutil.which("ffmpeg") is None:
        return False
    cmd = build_ffmpeg_command(source_video, out_path, start_s, end_s, keep_audio=keep_audio)
    try:
        runner(cmd, check=True, capture_output=True)
        return True
    except Exception:
        return False


def export_manual_clips(
    manual_clips_path: str | Path,
    out_root: str | Path = "output/ingest",
    overwrite: bool = False,
    keep_audio: bool = False,
    runner: Callable[..., subprocess.CompletedProcess] = subprocess.run,
) -> Path:
    """
    Export all clips in manual_clips.json and write session index.json.
    """
    manual_path = Path(manual_clips_path).expanduser().resolve()
    doc: ManualClipsDoc = load_manual_clips(manual_path)
    session_dir = ingest_session_dir(
        out_root=Path(out_root),
        player=doc.player,
        session=doc.session,
    )
    session_dir.mkdir(parents=True, exist_ok=True)

    exported_for_index: list[dict[str, Any]] = []
    source_video = Path(doc.source_video).expanduser()
    if not source_video.is_absolute():
        source_video = (Path.cwd() / source_video).resolve()

    export_clips = _select_export_clips(doc.clips)
    for clip in export_clips:
        angle = normalize_angle(clip.angle)
        rel = Path(clip_rel_path(clip.pitch_idx, angle))
        out_path = session_dir / rel
        out_path.parent.mkdir(parents=True, exist_ok=True)
        start_s, end_s = frame_range_to_timestamps(clip.start_frame, clip.end_frame, doc.fps)

        if overwrite or (not out_path.exists()):
            ok = _run_ffmpeg_clip(
                source_video=source_video,
                out_path=out_path,
                start_s=start_s,
                end_s=end_s,
                keep_audio=keep_audio,
                runner=runner,
            )
            if not ok:
                cut_ok = cut_clip_opencv(
                    src_path=source_video,
                    out_path=out_path,
                    start_s=start_s,
                    end_s=end_s,
                )
                if not cut_ok:
                    raise RuntimeError(f"Failed to export clip: pitch={clip.pitch_idx} angle={angle}")

        exported_for_index.append(
            {
                "pitch_idx": int(clip.pitch_idx),
                "angle": angle,
                "start_frame": int(clip.start_frame),
                "end_frame": int(clip.end_frame),
                "path": str(rel.as_posix()),
            }
        )

    index = build_manual_index(
        source_video=str(source_video),
        player=doc.player,
        session=doc.session,
        clips=exported_for_index,
    )
    index_path = session_dir / "index.json"
    with open(index_path, "w") as f:
        json.dump(index, f, indent=2)
    return index_path
