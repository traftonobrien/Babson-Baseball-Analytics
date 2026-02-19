"""
Schemas for multi-angle ingest indices.

These dataclasses are intentionally JSON-friendly and stable so downstream
scripts can rely on the same fields across reruns.
"""
from __future__ import annotations

import dataclasses
from typing import Any, Optional


ANGLE_CLASSES: tuple[str, ...] = (
    "behind_home",
    "behind_center",
    "open_side_RHP",
    "open_side_LHP",
    "hitter_view_RHH",
    "hitter_view_LHH",
    "unknown",
)


@dataclasses.dataclass
class Segment:
    segment_id: str
    start_s: float
    end_s: float
    start_frame: int
    end_frame: int
    angle_class: str
    angle_confidence: float
    angle_cues: list[str] = dataclasses.field(default_factory=list)
    feature_scores: dict[str, float] = dataclasses.field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclasses.dataclass
class PitchClip:
    clip_id: str
    segment_id: str
    angle_class: str
    start_s: float
    end_s: float
    start_frame: int
    end_frame: int
    duration_s: float
    set_frame: Optional[int]
    release_frame: Optional[int]
    confidence: float
    clip_path_abs: str
    clip_path_rel: str
    metadata_path_abs: str
    metadata_path_rel: str
    fps: float
    width: int
    height: int
    pitch_group_id: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclasses.dataclass
class PitchGroup:
    pitch_id: str
    candidate_clip_ids: list[str]
    recommended_clip_id: Optional[str]
    recommended_angle: Optional[str]
    recommendation_confidence: float
    recommendation_reason: str

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


@dataclasses.dataclass
class IngestIndex:
    schema_version: int
    source_video_abs: str
    source_video_rel: str
    player_slug: str
    session_slug: str
    fps: float
    frame_count: int
    width: int
    height: int
    segments: list[Segment] = dataclasses.field(default_factory=list)
    pitch_clips: list[PitchClip] = dataclasses.field(default_factory=list)
    pitch_groups: list[PitchGroup] = dataclasses.field(default_factory=list)
    angle_summary: dict[str, int] = dataclasses.field(default_factory=dict)
    warnings: list[str] = dataclasses.field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "source_video_abs": self.source_video_abs,
            "source_video_rel": self.source_video_rel,
            "player_slug": self.player_slug,
            "session_slug": self.session_slug,
            "fps": self.fps,
            "frame_count": self.frame_count,
            "width": self.width,
            "height": self.height,
            "segments": [s.to_dict() for s in self.segments],
            "pitch_clips": [p.to_dict() for p in self.pitch_clips],
            "pitch_groups": [g.to_dict() for g in self.pitch_groups],
            "angle_summary": dict(self.angle_summary),
            "warnings": list(self.warnings),
        }
