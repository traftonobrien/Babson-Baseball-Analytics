"""
Schema helpers for manual multi-angle clip definitions.
"""
from __future__ import annotations

import dataclasses
import json
from pathlib import Path
from typing import Any

from .utils import normalize_angle


REQUIRED_TOP_LEVEL = ("source_video", "player", "session", "fps", "width", "height", "clips")
REQUIRED_CLIP_FIELDS = ("pitch_idx", "angle", "start_frame", "end_frame")


@dataclasses.dataclass
class ManualClip:
    pitch_idx: int
    angle: str
    start_frame: int
    end_frame: int
    order: int | None = None
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        out = {
            "pitch_idx": int(self.pitch_idx),
            "angle": normalize_angle(self.angle),
            "start_frame": int(self.start_frame),
            "end_frame": int(self.end_frame),
        }
        if self.order is not None:
            out["order"] = int(self.order)
        if self.notes:
            out["notes"] = self.notes
        return out


@dataclasses.dataclass
class ManualClipsDoc:
    source_video: str
    player: str
    session: str
    fps: float
    width: int
    height: int
    clips: list[ManualClip] = dataclasses.field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_video": self.source_video,
            "player": self.player,
            "session": self.session,
            "fps": float(self.fps),
            "width": int(self.width),
            "height": int(self.height),
            "clips": [c.to_dict() for c in self.clips],
        }


def validate_manual_clips_dict(data: dict[str, Any]) -> None:
    for key in REQUIRED_TOP_LEVEL:
        if key not in data:
            raise ValueError(f"manual_clips.json missing required field: {key}")
    if not isinstance(data["clips"], list):
        raise ValueError("manual_clips.json field 'clips' must be a list")

    fps = float(data["fps"])
    if fps <= 0:
        raise ValueError("manual_clips.json fps must be > 0")
    width = int(data["width"])
    height = int(data["height"])
    if width <= 0 or height <= 0:
        raise ValueError("manual_clips.json width/height must be > 0")

    for idx, clip in enumerate(data["clips"]):
        if not isinstance(clip, dict):
            raise ValueError(f"clips[{idx}] must be an object")
        for key in REQUIRED_CLIP_FIELDS:
            if key not in clip:
                raise ValueError(f"clips[{idx}] missing required field: {key}")

        pitch_idx = int(clip["pitch_idx"])
        if pitch_idx <= 0:
            raise ValueError(f"clips[{idx}] pitch_idx must be >= 1")
        angle = normalize_angle(str(clip["angle"]))
        if not angle:
            raise ValueError(f"clips[{idx}] angle must be non-empty")
        start_frame = int(clip["start_frame"])
        end_frame = int(clip["end_frame"])
        if start_frame < 0 or end_frame < 0:
            raise ValueError(f"clips[{idx}] frame bounds must be >= 0")
        if end_frame <= start_frame:
            raise ValueError(f"clips[{idx}] end_frame must be greater than start_frame")
        if "order" in clip and int(clip["order"]) <= 0:
            raise ValueError(f"clips[{idx}] order must be >= 1")


def manual_doc_from_dict(data: dict[str, Any]) -> ManualClipsDoc:
    validate_manual_clips_dict(data)
    clips: list[ManualClip] = []
    for clip in data["clips"]:
        clips.append(
            ManualClip(
                pitch_idx=int(clip["pitch_idx"]),
                angle=normalize_angle(str(clip["angle"])),
                start_frame=int(clip["start_frame"]),
                end_frame=int(clip["end_frame"]),
                order=int(clip["order"]) if clip.get("order") is not None else None,
                notes=str(clip.get("notes", "")),
            )
        )
    return ManualClipsDoc(
        source_video=str(data["source_video"]),
        player=str(data["player"]),
        session=str(data["session"]),
        fps=float(data["fps"]),
        width=int(data["width"]),
        height=int(data["height"]),
        clips=clips,
    )


def load_manual_clips(path: str | Path) -> ManualClipsDoc:
    with open(path) as f:
        data = json.load(f)
    return manual_doc_from_dict(data)


def write_manual_clips(doc: ManualClipsDoc, path: str | Path) -> Path:
    """
    Atomic JSON write to avoid losing work during interactive clipping.
    """
    out_path = Path(path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_suffix(out_path.suffix + ".tmp")
    with open(tmp, "w") as f:
        json.dump(doc.to_dict(), f, indent=2)
    tmp.replace(out_path)
    return out_path


def new_manual_doc(
    source_video: str,
    player: str,
    session: str,
    fps: float,
    width: int,
    height: int,
) -> ManualClipsDoc:
    return ManualClipsDoc(
        source_video=source_video,
        player=player,
        session=session,
        fps=float(fps),
        width=int(width),
        height=int(height),
        clips=[],
    )
