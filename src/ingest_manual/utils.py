"""
Utilities for manual multi-angle clipping workflow.
"""
from __future__ import annotations

import datetime as _dt
from pathlib import Path
from typing import Any, Iterable

from src.mechanics.utils import slugify


ANGLE_ORDER: tuple[str, ...] = (
    "open_side",
    "home_plate_front",
    "front",
    "behind",
    "back",
    "behind_home",
    "center",
    "unknown",
)

ANGLE_HOTKEY_MAP: dict[int, str] = {
    ord("1"): "open_side",
    ord("2"): "front",
    ord("3"): "back",
    ord("4"): "behind_home",
    ord("5"): "center",
    ord("6"): "unknown",
}


def normalize_angle(value: str) -> str:
    v = (value or "").strip().lower()
    aliases = {
        "other": "unknown",
        "other/unknown": "unknown",
        "behind-center": "center",
        "behind_center": "center",
    }
    return aliases.get(v, v)


def choose_preferred_angle(angles: Iterable[str]) -> str:
    present = {normalize_angle(a) for a in angles}
    for angle in ANGLE_ORDER:
        if angle in present:
            return angle
    return "unknown"


def pitch_dir_name(pitch_idx: int) -> str:
    return f"pitch_{int(pitch_idx):03d}"


def clip_rel_path(pitch_idx: int, angle: str) -> str:
    return str(Path("clips") / pitch_dir_name(pitch_idx) / f"{normalize_angle(angle)}.mp4")


def ingest_session_dir(
    out_root: str | Path,
    player: str,
    session: str,
) -> Path:
    return Path(out_root) / slugify(player) / slugify(session)


def now_iso_utc() -> str:
    return _dt.datetime.now(tz=_dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_manual_index(
    source_video: str,
    player: str,
    session: str,
    clips: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Build grouped index structure expected by manual workflow.

    clips entries should include: pitch_idx, angle, start_frame, end_frame, path.
    """
    by_pitch: dict[int, dict[str, Any]] = {}
    for clip in clips:
        pitch_idx = int(clip["pitch_idx"])
        angle = normalize_angle(str(clip["angle"]))
        if pitch_idx not in by_pitch:
            by_pitch[pitch_idx] = {
                "pitch_idx": pitch_idx,
                "angles": {},
            }
        by_pitch[pitch_idx]["angles"][angle] = {
            "path": str(clip.get("path", "")),
            "start_frame": int(clip["start_frame"]),
            "end_frame": int(clip["end_frame"]),
        }

    rows: list[dict[str, Any]] = []
    for pitch_idx in sorted(by_pitch.keys()):
        row = by_pitch[pitch_idx]
        preferred = choose_preferred_angle(row["angles"].keys())
        row["preferred_angle"] = preferred
        rows.append(row)

    return {
        "source_video": source_video,
        "player": player,
        "session": session,
        "created_at": now_iso_utc(),
        "clips": rows,
    }
