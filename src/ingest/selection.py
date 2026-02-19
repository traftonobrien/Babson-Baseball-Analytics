"""Shared heuristics for pitch-grouping and best-angle selection."""
from __future__ import annotations

from typing import Iterable, Optional

from .schema import PitchClip, PitchGroup


def angle_preference_score(angle_class: str, hand: str = "R") -> float:
    hand = (hand or "R").upper()
    preferred_open = "open_side_RHP" if hand == "R" else "open_side_LHP"
    other_open = "open_side_LHP" if preferred_open == "open_side_RHP" else "open_side_RHP"
    if angle_class == preferred_open:
        return 1.0
    if angle_class == other_open:
        return 0.92
    if angle_class == "behind_home":
        return 0.80
    if angle_class == "behind_center":
        return 0.68
    if angle_class.startswith("hitter_view"):
        return 0.54
    return 0.42


def candidate_quality_score(
    angle_class: str,
    hand: str,
    clip_confidence: float,
    fps: float,
    width: int,
    height: int,
    visibility_score: Optional[float] = None,
) -> float:
    pref = angle_preference_score(angle_class, hand=hand)
    fps_norm = max(0.0, min(1.0, fps / 60.0))
    res_norm = max(0.0, min(1.0, (width * height) / float(1920 * 1080)))
    vis = clip_confidence if visibility_score is None else visibility_score
    vis = max(0.0, min(1.0, vis))
    return 100.0 * pref + 20.0 * vis + 8.0 * fps_norm + 6.0 * res_norm


def group_pitch_clips(
    clips: Iterable[PitchClip],
    group_gap_s: float = 8.0,
) -> list[list[PitchClip]]:
    ordered = sorted(clips, key=lambda c: (c.start_s, c.end_s))
    if not ordered:
        return []
    groups: list[list[PitchClip]] = [[ordered[0]]]
    for clip in ordered[1:]:
        prev = groups[-1][-1]
        gap = clip.start_s - prev.start_s
        if gap <= group_gap_s:
            groups[-1].append(clip)
        else:
            groups.append([clip])
    return groups


def build_pitch_groups(
    clips: Iterable[PitchClip],
    hand: str = "R",
    group_gap_s: float = 8.0,
) -> list[PitchGroup]:
    groups = group_pitch_clips(clips, group_gap_s=group_gap_s)
    out: list[PitchGroup] = []
    for idx, candidates in enumerate(groups, start=1):
        pitch_id = f"pitch_{idx:03d}"
        best = None
        best_score = -1.0
        for c in candidates:
            score = candidate_quality_score(
                angle_class=c.angle_class,
                hand=hand,
                clip_confidence=c.confidence,
                fps=c.fps,
                width=c.width,
                height=c.height,
            )
            if score > best_score:
                best_score = score
                best = c

        out.append(
            PitchGroup(
                pitch_id=pitch_id,
                candidate_clip_ids=[c.clip_id for c in candidates],
                recommended_clip_id=(best.clip_id if best else None),
                recommended_angle=(best.angle_class if best else None),
                recommendation_confidence=max(0.0, min(1.0, (best_score / 140.0))) if best else 0.0,
                recommendation_reason=(
                    "angle_preference + clip confidence + fps + resolution"
                    if best
                    else "no_candidates"
                ),
            )
        )
    return out

