"""
Metric extraction from pose keypoints and detected phases.

WHAT THIS MODULE DOES:
  Takes the pose sequence + detected phases and computes a small set of
  coaching-style metrics at specific moments in the delivery.

METRICS:
  stride_length_px     — pixel distance between ankles at foot strike.
  stride_length_norm   — stride_length_px / shoulder_width_px.
                         Normalizes for camera distance and body size.
                         ~1.4–1.8x shoulder width is typical for pros.
  trunk_lean_deg       — angle of torso from vertical at foot strike.
                         Forward lean (toward home) reads as positive.
  hip_shoulder_sep_deg — angle between hip axis and shoulder axis at foot strike.
                         Positive = hips are ahead of shoulders (desired).
  arm_slot_deg         — elevation of throwing upper arm from horizontal at release.
                         90 = over the top; ~45 = three-quarter;
                         ~0 = sidearm; negative = submarine.
                         NOTE: this is a 2D projection from the side camera;
                         true arm slot requires a front or overhead camera.

ALL ANGLES are in degrees. Pixel distances are in the source image space.

MISSING DATA: any metric where the required keypoints are below visibility
threshold returns None. Check the `notes` dict for the reason.
"""
from __future__ import annotations

import dataclasses
import math
from typing import Optional

import numpy as np

from .pose import PoseResult, KP
from .phases import PitchPhases, Phase


@dataclasses.dataclass
class Metrics:
    stride_length_px: Optional[float] = None
    stride_length_norm: Optional[float] = None
    trunk_lean_deg: Optional[float] = None
    hip_shoulder_sep_deg: Optional[float] = None
    arm_slot_deg: Optional[float] = None
    shoulder_width_px: Optional[float] = None
    notes: dict = dataclasses.field(default_factory=dict)

    def to_dict(self) -> dict:
        def _fmt(v):
            if v is None:
                return None
            if isinstance(v, float):
                return round(v, 2)
            return v

        return {
            "stride_length_px":     _fmt(self.stride_length_px),
            "stride_length_norm":   _fmt(self.stride_length_norm),
            "trunk_lean_deg":       _fmt(self.trunk_lean_deg),
            "hip_shoulder_sep_deg": _fmt(self.hip_shoulder_sep_deg),
            "arm_slot_deg":         _fmt(self.arm_slot_deg),
            "shoulder_width_px":    _fmt(self.shoulder_width_px),
            "notes":                self.notes,
        }


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def _angle_from_vertical(dx: float, dy: float) -> float:
    """
    Angle in degrees between vector (dx, dy) and the vertical (pointing up).

    In image space +Y is down, so "pointing up" = (0, -1).
    Return value increases as the vector tilts away from vertical.
    For a trunk leaning forward: dx ≠ 0, dy ≠ 0 → lean angle > 0.
    """
    length = math.sqrt(dx * dx + dy * dy)
    if length < 1e-6:
        return 0.0
    cos_a = -dy / length          # dot product with (0, -1)
    cos_a = max(-1.0, min(1.0, cos_a))
    return math.degrees(math.acos(cos_a))


def _angle_between_vecs(v1: tuple, v2: tuple) -> float:
    """Unsigned angle in degrees between two 2D vectors."""
    dx1, dy1 = v1
    dx2, dy2 = v2
    dot   = dx1 * dx2 + dy1 * dy2
    cross = dx1 * dy2 - dy1 * dx2
    return abs(math.degrees(math.atan2(cross, dot)))


def _px(pose: PoseResult, kp: str, min_vis: float = 0.3) -> Optional[tuple[float, float]]:
    """Pixel coords for a keypoint, or None if below visibility threshold."""
    idx = KP[kp]
    lm = pose.landmarks[idx]
    if np.isnan(lm[0]) or lm[2] < min_vis:
        return None
    return pose.pixel(kp)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def extract_metrics(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str = "R",
) -> Metrics:
    """
    Compute mechanics metrics from pose sequences and detected phases.

    Args:
        poses:  List of PoseResult for each frame.
        phases: Detected pitch phases (from detect_phases).
        hand:   Pitcher throwing hand "R" or "L".

    Returns:
        Metrics dataclass. Missing keypoints yield None (not NaN) in output.
    """
    metrics = Metrics()

    if not poses:
        return metrics

    # Handedness-dependent keypoints
    if hand == "R":
        lead_ankle, drive_ankle         = "LEFT_ANKLE",   "RIGHT_ANKLE"
        lead_hip,   drive_hip           = "LEFT_HIP",     "RIGHT_HIP"
        lead_sho,   drive_sho           = "LEFT_SHOULDER","RIGHT_SHOULDER"
        throw_sho,  throw_elbow         = "RIGHT_SHOULDER","RIGHT_ELBOW"
        throw_wrist                     = "RIGHT_WRIST"
    else:
        lead_ankle, drive_ankle         = "RIGHT_ANKLE",  "LEFT_ANKLE"
        lead_hip,   drive_hip           = "RIGHT_HIP",    "LEFT_HIP"
        lead_sho,   drive_sho           = "RIGHT_SHOULDER","LEFT_SHOULDER"
        throw_sho,  throw_elbow         = "LEFT_SHOULDER", "LEFT_ELBOW"
        throw_wrist                     = "LEFT_WRIST"

    # Reference shoulder width from first valid frame
    ref_pose = next((p for p in poses if p.valid), None)
    if ref_pose:
        ls = _px(ref_pose, "LEFT_SHOULDER")
        rs = _px(ref_pose, "RIGHT_SHOULDER")
        if ls and rs:
            metrics.shoulder_width_px = math.dist(ls, rs)

    # Map actual frame index → PoseResult for O(1) lookup
    frame_map: dict[int, PoseResult] = {p.frame_idx: p for p in poses}

    def _pose_at(phase: Optional[Phase]) -> Optional[PoseResult]:
        if phase is None:
            return None
        if phase.frame_idx in frame_map:
            return frame_map[phase.frame_idx]
        # Nearest frame fallback
        return min(poses, key=lambda p: abs(p.frame_idx - phase.frame_idx))

    # ---- STRIDE LENGTH at foot strike ---------------------------------------
    fs_pose = _pose_at(phases.foot_strike)
    if fs_pose:
        la = _px(fs_pose, lead_ankle)
        da = _px(fs_pose, drive_ankle)
        if la and da:
            metrics.stride_length_px = math.dist(la, da)
            if metrics.shoulder_width_px and metrics.shoulder_width_px > 0:
                metrics.stride_length_norm = (
                    metrics.stride_length_px / metrics.shoulder_width_px
                )
        else:
            metrics.notes["stride"] = "Ankle keypoints below threshold at foot strike"

    # ---- TRUNK LEAN at foot strike -----------------------------------------
    # Trunk = vector from mid-hip to mid-shoulder.
    # Angle from vertical gives forward lean.
    if fs_pose:
        lh = _px(fs_pose, lead_hip)
        dh = _px(fs_pose, drive_hip)
        ls = _px(fs_pose, lead_sho)
        ds = _px(fs_pose, drive_sho)
        if lh and dh and ls and ds:
            hip_mid = ((lh[0] + dh[0]) / 2, (lh[1] + dh[1]) / 2)
            sho_mid = ((ls[0] + ds[0]) / 2, (ls[1] + ds[1]) / 2)
            trunk_dx = sho_mid[0] - hip_mid[0]
            trunk_dy = sho_mid[1] - hip_mid[1]
            metrics.trunk_lean_deg = _angle_from_vertical(trunk_dx, trunk_dy)
        else:
            metrics.notes["trunk_lean"] = "Hip/shoulder keypoints below threshold at foot strike"

    # ---- HIP / SHOULDER SEPARATION at foot strike --------------------------
    # Hip-axis vector vs shoulder-axis vector. Positive = hips ahead of shoulders.
    if fs_pose:
        lh = _px(fs_pose, lead_hip)
        dh = _px(fs_pose, drive_hip)
        ls = _px(fs_pose, lead_sho)
        ds = _px(fs_pose, drive_sho)
        if lh and dh and ls and ds:
            hip_vec = (dh[0] - lh[0], dh[1] - lh[1])
            sho_vec = (ds[0] - ls[0], ds[1] - ls[1])
            metrics.hip_shoulder_sep_deg = _angle_between_vecs(hip_vec, sho_vec)
        else:
            metrics.notes["hip_sho_sep"] = "Hip/shoulder keypoints below threshold at foot strike"

    # ---- ARM SLOT at ball release -------------------------------------------
    # Use upper arm (shoulder → elbow) elevation angle.
    # From a side camera this is a 2D projection; actual arm slot needs
    # a front or overhead view.
    br_pose = _pose_at(phases.ball_release)
    if br_pose:
        ts = _px(br_pose, throw_sho)
        te = _px(br_pose, throw_elbow)
        if ts and te:
            arm_dx = te[0] - ts[0]
            arm_dy = te[1] - ts[1]   # positive = elbow below shoulder (image)
            # Elevation = angle above horizontal: positive = over the top tendency
            # atan2(vertical_component, horizontal_magnitude)
            elevation = math.degrees(math.atan2(-arm_dy, abs(arm_dx) + 1e-9))
            metrics.arm_slot_deg = elevation
        else:
            metrics.notes["arm_slot"] = "Shoulder/elbow keypoints below threshold at release"

    return metrics
