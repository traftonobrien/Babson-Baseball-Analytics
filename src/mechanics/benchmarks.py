"""
Mechanical Benchmarks — Mustard-inspired scoring with view-aware gating.

Open-side is the default and only trusted single-camera mode for this
repository. Front-view-only metrics are hard-gated out of open-side scoring
and issue prioritisation.
"""
from __future__ import annotations

import dataclasses
import math
from typing import Optional, Iterable, List

import numpy as np

from .pose import PoseResult, KP
from .phases import PitchPhases, Phase
from .utils import smooth_series, smoothing_residual_std


# ---------------------------------------------------------------------------
# Score-colour semantics (BGR tuples for OpenCV)
# ---------------------------------------------------------------------------

def score_color_bgr(score: Optional[float]) -> tuple[int, int, int]:
    """BGR colour for a benchmark score: green ≥8, yellow 5-7, red ≤4, gray N/A."""
    if score is None:
        return (150, 150, 150)
    if score >= 8.0:
        return (0, 200, 80)
    if score >= 5.0:
        return (0, 200, 240)
    return (30, 30, 240)


# ---------------------------------------------------------------------------
# Confidence helpers
# ---------------------------------------------------------------------------

def _clamp01(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


def _combine_confidence(*values: float) -> float:
    """Conservative combination: take the minimum non-None factor in [0,1]."""
    vals = [v for v in values if v is not None]
    if not vals:
        return 0.0
    return _clamp01(min(vals))


def _phase_confidence(phases: Iterable[Optional[Phase]]) -> float:
    """Aggregate confidence from a list of Phase objects."""
    vals = [p.confidence for p in phases if p is not None and p.confidence is not None]
    if not vals:
        return 0.45
    return _clamp01(min(vals))


def _visibility_confidence(pose: PoseResult, kps: List[str], min_vis: float = 0.25) -> float:
    """
    Average visibility score for a set of keypoints, scaled to [0,1].

    Values below min_vis contribute 0; values at 1.0 contribute 1.
    """
    vals: list[float] = []
    for kp in kps:
        lm = pose.landmarks[KP[kp]]
        if np.isnan(lm[0]):
            continue
        v = float(lm[2])
        if v < min_vis:
            continue
        vals.append((v - min_vis) / (1.0 - min_vis))
    if not vals:
        return 0.0
    return _clamp01(sum(vals) / len(vals))


def _stability_confidence(values: list[float | None], expected_span: float | None = None) -> float:
    """
    Estimate signal stability from a list of numeric samples.

    - Few samples (<3) → 0.5 baseline (unknown).
    - Larger spread relative to expected_span or coefficient of variation
      reduces confidence.
    """
    valid = [float(v) for v in values if v is not None and not math.isnan(v)]
    if len(valid) < 3:
        return 0.5

    span = max(valid) - min(valid)
    if expected_span is not None and expected_span > 1e-6:
        ratio = span / expected_span
        return _clamp01(1.0 - min(ratio, 1.5) / 1.5)

    mean = abs(sum(valid) / len(valid)) + 1e-3
    cv = float(np.std(valid) / mean)
    return _clamp01(1.0 - min(cv, 1.5) / 1.5)


def _residual_confidence(
    raw_values: list[float | None],
    smoothed_values: list[float | None] | np.ndarray,
    tolerance: float,
) -> float:
    """Convert smoothing residual noise into confidence in [0,1]."""
    if tolerance <= 1e-9:
        return 1.0
    std = smoothing_residual_std(raw_values, smoothed_values)
    return _clamp01(1.0 - min(std / tolerance, 1.0))


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def _px_safe(
    pose: PoseResult,
    kp: str,
    min_vis: float = 0.25,
) -> Optional[tuple[float, float]]:
    """
    Return pixel (x, y) for a named keypoint, or None if confidence is low.

    Pixel coords = normalised_coord * frame_dimension.
    The threshold 0.25 is deliberately lower than the drawing threshold (0.5)
    so we still attempt metric computation even when the skeleton is partially
    occluded, while excluding completely missing landmarks.
    """
    idx = KP[kp]
    lm = pose.landmarks[idx]
    if np.isnan(lm[0]) or float(lm[2]) < min_vis:
        return None
    return (float(lm[0]) * pose.width, float(lm[1]) * pose.height)


def _midpoint(
    a: tuple[float, float],
    b: tuple[float, float],
) -> tuple[float, float]:
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)


def _px_vis_safe(
    pose: PoseResult,
    kp: str,
    min_vis: float = 0.25,
) -> Optional[tuple[float, float, float]]:
    """Return (x_px, y_px, visibility), or None if keypoint is unusable."""
    idx = KP[kp]
    lm = pose.landmarks[idx]
    if np.isnan(lm[0]) or float(lm[2]) < min_vis:
        return None
    return (float(lm[0]) * pose.width, float(lm[1]) * pose.height, float(lm[2]))


def _weighted_midpoint(
    left: Optional[tuple[float, float, float]],
    right: Optional[tuple[float, float, float]],
) -> Optional[tuple[float, float]]:
    """
    Visibility-weighted midpoint from bilateral keypoints.

    If only one side is visible, that side is returned directly.
    """
    if left is None and right is None:
        return None
    if left is None:
        return (right[0], right[1]) if right is not None else None
    if right is None:
        return (left[0], left[1])

    w_l = max(1e-6, left[2])
    w_r = max(1e-6, right[2])
    w = w_l + w_r
    x = (left[0] * w_l + right[0] * w_r) / w
    y = (left[1] * w_l + right[1] * w_r) / w
    return (x, y)


def angle_from_vertical_deg(dx: float, dy: float) -> float:
    """
    Angle in degrees between vector (dx, dy) and the upward vertical.

    Convention:
      Image +Y is downward, so "upward vertical" = (0, -1).
      dot product with (0,-1) = -dy / length.
      Returns 0° for a perfectly upright vector, 90° for horizontal.
      Always non-negative.

    Equivalent to: atan2(|dx|, |dy|) when dy < 0 (pointing up).
    """
    length = math.sqrt(dx * dx + dy * dy)
    if length < 1e-6:
        return 0.0
    cos_a = max(-1.0, min(1.0, -dy / length))
    return math.degrees(math.acos(cos_a))


def angle_from_horizontal_deg(dx: float, dy: float) -> float:
    """
    Angle in degrees above horizontal, computed as atan2(|dy|, |dx|).

    Convention:
      Uses absolute values of both components so the result is always in
      [0°, 90°] regardless of the vector's quadrant.
      A perfectly horizontal vector → 0°.
      A perfectly vertical vector → 90°.
      This matches the spec: energy_angle = atan2(|dy|, |dx|).

    Note on image Y:
      Even though image +Y is downward, passing the raw image-space dy
      still works correctly because we take |dy|.  A stride_hip that is
      ABOVE the drive_ankle in the room has a SMALLER image-Y, so
      dy = stride_hip.y - drive_ankle.y < 0.  |dy| is the vertical rise.
    """
    return math.degrees(math.atan2(abs(dy), abs(dx) + 1e-9))


def shoulder_line_angle_deg(pose: PoseResult) -> Optional[float]:
    """
    Angle of the shoulder axis (LEFT → RIGHT shoulder) from horizontal.

    Uses atan2(dy, dx) in image space.  +Y is downward.
    0°  = perfectly level shoulders.
    >0° = right shoulder lower than left.
    <0° = right shoulder higher than left.

    Returns None if either shoulder keypoint has low confidence.
    """
    ls = _px_safe(pose, "LEFT_SHOULDER")
    rs = _px_safe(pose, "RIGHT_SHOULDER")
    if ls is None or rs is None:
        return None
    dx = rs[0] - ls[0]
    dy = rs[1] - ls[1]
    return math.degrees(math.atan2(dy, dx + 1e-9))


def _angle_diff_deg(a: float, b: float) -> float:
    """
    Minimum unsigned angular difference between two angles in degrees.

    Both angles are expected in the range [-180, 180] (atan2 output).
    Returns a value in [0, 180], accounting for the wraparound at ±180°.
    """
    d = abs(a - b) % 360.0
    return min(d, 360.0 - d)


def _angle_diff_signed_deg(a: float, b: float) -> float:
    """
    Signed shortest-path angular delta (a - b) in [-180, 180].
    """
    d = (a - b + 180.0) % 360.0 - 180.0
    return float(d)


def _pose_nearest(
    poses: list[PoseResult],
    phase: Optional[Phase],
) -> Optional[PoseResult]:
    """Return the PoseResult whose frame_idx is closest to phase.frame_idx."""
    if phase is None or not poses:
        return None
    return min(poses, key=lambda p: abs(p.frame_idx - phase.frame_idx))


def _poses_in_range(
    poses: list[PoseResult],
    start_frame: int,
    end_frame: int,
) -> list[PoseResult]:
    """Poses with frame_idx in [start_frame, end_frame] inclusive."""
    return [p for p in poses if start_frame <= p.frame_idx <= end_frame]


def _poses_around_phase(
    poses: list[PoseResult],
    phase: Optional[Phase],
    before: int = 4,
    after: int = 2,
) -> list[PoseResult]:
    """Small frame window around a phase for smoothing noisy signals."""
    if phase is None:
        return []
    return _poses_in_range(poses, phase.frame_idx - before, phase.frame_idx + after)


def _body_height_proxy_px(
    pose: Optional[PoseResult],
    fallback_height: float | None = None,
) -> Optional[float]:
    """
    Estimate body height in pixels from NOSE -> ankle midpoint.

    Falls back to shoulder midpoint -> ankle midpoint when NOSE is unavailable.
    """
    if pose is None:
        return fallback_height

    la = _px_safe(pose, "LEFT_ANKLE")
    ra = _px_safe(pose, "RIGHT_ANKLE")
    if la is None and ra is None:
        return fallback_height
    if la is None:
        ankle_mid = ra
    elif ra is None:
        ankle_mid = la
    else:
        ankle_mid = _midpoint(la, ra)

    nose = _px_safe(pose, "NOSE")
    if nose is None:
        ls = _px_safe(pose, "LEFT_SHOULDER")
        rs = _px_safe(pose, "RIGHT_SHOULDER")
        if ls is None and rs is None:
            return fallback_height
        if ls is None:
            nose = rs
        elif rs is None:
            nose = ls
        else:
            nose = _midpoint(ls, rs)

    height = abs(float(ankle_mid[1] - nose[1]))
    if height < 10.0:
        return fallback_height
    return height


def _angle_between_vectors_deg(
    a: tuple[float, float],
    b: tuple[float, float],
) -> Optional[float]:
    """Unsigned angle in degrees between two vectors, or None if degenerate."""
    la = math.hypot(a[0], a[1])
    lb = math.hypot(b[0], b[1])
    if la < 1e-6 or lb < 1e-6:
        return None
    dot = a[0] * b[0] + a[1] * b[1]
    cos_theta = max(-1.0, min(1.0, dot / (la * lb)))
    return math.degrees(math.acos(cos_theta))


def _theil_sen_fit(
    xs: list[float],
    ys: list[float],
) -> Optional[tuple[float, float, float]]:
    """
    Robust linear fit via median pairwise slope.

    Returns (slope, intercept, median_abs_residual).
    """
    if len(xs) != len(ys) or len(xs) < 2:
        return None

    slopes: list[float] = []
    for i in range(len(xs)):
        xi = xs[i]
        yi = ys[i]
        for j in range(i + 1, len(xs)):
            xj = xs[j]
            dx = xj - xi
            if abs(dx) < 1e-6:
                continue
            slopes.append((ys[j] - yi) / dx)
    if not slopes:
        slope = 0.0
    else:
        slope = float(np.median(np.asarray(slopes, dtype=np.float64)))

    intercepts = [y - slope * x for x, y in zip(xs, ys)]
    intercept = float(np.median(np.asarray(intercepts, dtype=np.float64)))
    residuals = [abs(y - (slope * x + intercept)) for x, y in zip(xs, ys)]
    mad = float(np.median(np.asarray(residuals, dtype=np.float64)))
    return slope, intercept, mad


# ---------------------------------------------------------------------------
# Score-mapping helpers (public so tests can verify them directly)
# ---------------------------------------------------------------------------

def linear_score(
    value: float,
    lo: float,
    hi: float,
    lo_score: float,
    hi_score: float,
) -> float:
    """
    Map value in [lo, hi] to [lo_score, hi_score] by linear interpolation.

    Values below lo → lo_score.  Values above hi → hi_score.
    Works for both increasing and decreasing score directions.
    """
    if lo >= hi:
        return lo_score
    t = max(0.0, min(1.0, (value - lo) / (hi - lo)))
    return lo_score + t * (hi_score - lo_score)


def piecewise_timing_score(timing_sec: float) -> float:
    """
    Score for SET → FOOT STRIKE timing:
      ≤ 1.05 s          → 10
      ]1.05 … 1.15] s   → linear 10 → 6
      > 1.15 s           → 3
    """
    if timing_sec <= 1.05:
        return 10.0
    if timing_sec <= 1.15:
        return linear_score(timing_sec, 1.05, 1.15, 10.0, 6.0)
    return 3.0


# ---------------------------------------------------------------------------
# BenchmarkResult and BenchmarkReport dataclasses
# ---------------------------------------------------------------------------

@dataclasses.dataclass
class BenchmarkResult:
    """
    Result for one benchmark metric.

    Fields:
      name        — metric key (e.g. "timing")
      status      — "ok" | "insufficient_data"
      raw_value   — numeric result in natural units
      unit        — "s", "°", "%", "ratio", "boolean", ""
      score       — [0, 10] float, None if insufficient_data
      pass_fail   — True if score ≥ 6, None if insufficient_data
      sub_values  — secondary measurements used in computation
      note        — human-readable description
    """
    name: str
    status: str
    raw_value: Optional[float] = None
    unit: str = ""
    score: Optional[float] = None
    pass_fail: Optional[bool] = None
    sub_values: dict = dataclasses.field(default_factory=dict)
    note: str = ""
    confidence: Optional[float] = None  # 0–1 reliability (not serialised in to_dict)

    @classmethod
    def insufficient(cls, name: str, reason: str) -> "BenchmarkResult":
        """Convenience constructor for missing-data results."""
        return cls(name=name, status="insufficient_data", note=reason)

    @classmethod
    def requires_front_view(cls, name: str, reason: str) -> "BenchmarkResult":
        """Metric requires a front-facing camera that is not available."""
        return cls(name=name, status="requires_front_view", note=reason)

    def to_dict(self) -> dict:
        def _r(v):
            return round(v, 3) if isinstance(v, float) else v

        return {
            "name":       self.name,
            "status":     self.status,
            "raw_value":  _r(self.raw_value),
            "unit":       self.unit,
            "score":      round(self.score, 2) if self.score is not None else None,
            "pass_fail":  self.pass_fail,
            "sub_values": {k: _r(v) for k, v in self.sub_values.items()},
            "note":       self.note,
        }


@dataclasses.dataclass
class BenchmarkReport:
    """Container for all 7 benchmarks + overall efficiency score."""
    timing:           BenchmarkResult
    balance:          BenchmarkResult
    posture:          BenchmarkResult
    lift_thrust:      BenchmarkResult
    swivel_stabilize: BenchmarkResult
    stack_track:      BenchmarkResult      # or trunk_stability in open_side mode
    torque_retention: BenchmarkResult
    efficiency_score: Optional[float] = None
    efficiency_low_confidence: bool = False
    hand:             str = "R"
    view_mode:        str = "open_side"
    extra_metrics:    list[BenchmarkResult] = dataclasses.field(default_factory=list)

    def primary_metrics(self) -> list[BenchmarkResult]:
        return [
            self.timing, self.balance, self.posture,
            self.lift_thrust, self.swivel_stabilize,
            self.stack_track, self.torque_retention,
        ]

    def all_metrics(self) -> list[BenchmarkResult]:
        """Primary metrics plus any extra open-side-friendly add-ons."""
        return self.primary_metrics() + list(self.extra_metrics)

    def metric_by_name(self, name: str) -> Optional[BenchmarkResult]:
        for m in self.all_metrics():
            if m.name == name:
                return m
        return None

    def to_dict(self) -> dict:
        return {
            "efficiency_score": self.efficiency_score,
            "hand": self.hand,
            "view_mode": self.view_mode,
            "metrics": {m.name: m.to_dict() for m in self.primary_metrics()},
        }


# ---------------------------------------------------------------------------
# Individual metric computations
# ---------------------------------------------------------------------------

def _compute_timing(phases: PitchPhases) -> BenchmarkResult:
    """
    Timing: elapsed time from SET to FOOT STRIKE.

    Good pitchers stride quickly and efficiently; too slow can indicate
    hesitation or balance issues.

    Scoring: ≤1.05 s → 10;  [1.05,1.15] → 10→6;  >1.15 → 3.
    """
    name = "timing"
    if phases.set_pos is None:
        return BenchmarkResult.insufficient(name, "SET phase not detected")
    if phases.foot_strike is None:
        return BenchmarkResult.insufficient(name, "FOOT_STRIKE phase not detected")

    t = phases.foot_strike.time_s - phases.set_pos.time_s
    score = piecewise_timing_score(t)
    conf = _phase_confidence([phases.set_pos, phases.foot_strike])
    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=t,
        unit="s",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "t_set_s":         round(phases.set_pos.time_s, 3),
            "t_foot_strike_s": round(phases.foot_strike.time_s, 3),
        },
        note="SET → FOOT STRIKE elapsed time. Lower = faster delivery.",
        confidence=conf,
    )


def _compute_balance(
    poses: list[PoseResult],
    phases: PitchPhases,
) -> BenchmarkResult:
    """
    Balance: trunk lean (angle from vertical) at BALL RELEASE.

    Trunk = vector from mid-hip to mid-shoulder.
    Large lean indicates the head is off-centre, reducing force efficiency.

    Scoring: <6° → 10;  >40° → 0;  linear between.
    """
    name = "balance"
    pose = _pose_nearest(poses, phases.ball_release)
    if pose is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE pose not found")
    win = _poses_around_phase(poses, phases.ball_release, before=4, after=2)
    if not win:
        win = [pose]

    trunk_angles_raw: list[float | None] = []
    for wp in win:
        ls = _px_safe(wp, "LEFT_SHOULDER")
        rs = _px_safe(wp, "RIGHT_SHOULDER")
        lh = _px_safe(wp, "LEFT_HIP")
        rh = _px_safe(wp, "RIGHT_HIP")
        if not all([ls, rs, lh, rh]):
            trunk_angles_raw.append(np.nan)
            continue
        mid_hip = _midpoint(lh, rh)
        mid_sho = _midpoint(ls, rs)
        dx = mid_sho[0] - mid_hip[0]
        dy = mid_sho[1] - mid_hip[1]
        trunk_angles_raw.append(angle_from_vertical_deg(dx, dy))

    valid_raw = [a for a in trunk_angles_raw if a is not None and not np.isnan(a)]
    if len(valid_raw) < 2:
        return BenchmarkResult.insufficient(name, "Hip/shoulder keypoints below threshold at release")

    trunk_angles_smooth = smooth_series(trunk_angles_raw, window=5, polyorder=2)
    valid_smooth = trunk_angles_smooth[~np.isnan(trunk_angles_smooth)]
    if len(valid_smooth) < 2:
        return BenchmarkResult.insufficient(name, "Cannot smooth trunk lean around release")

    angle = float(np.median(valid_smooth))
    jitter_std = smoothing_residual_std(trunk_angles_raw, trunk_angles_smooth)
    score = linear_score(angle, 6.0, 40.0, 10.0, 0.0)
    jitter_conf = _residual_confidence(trunk_angles_raw, trunk_angles_smooth, tolerance=3.0)
    conf = _combine_confidence(
        _visibility_confidence(pose, ["LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"]),
        jitter_conf,
        _phase_confidence([phases.ball_release]),
    )

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=angle,
        unit="°",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "release_window_frames": len(win),
            "trunk_lean_med_deg": round(float(np.median(valid_raw)), 2),
            "trunk_lean_jitter_std_deg": round(jitter_std, 2),
        },
        note="Trunk angle from vertical at release. 0° = perfectly upright.",
        confidence=conf,
    )


def _compute_posture(
    poses: list[PoseResult],
    phases: PitchPhases,
) -> BenchmarkResult:
    """
    Posture: head (nose) vertical travel from SET to RELEASE,
    normalised by body height proxy.

    Head staying level = efficient energy transfer.
    Excessive bobbing (crouching then rising) wastes energy and disrupts timing.

    Scoring: ≤1% → 10;  ≥10% → 0;  linear between.
    """
    name = "posture"
    if phases.set_pos is None or phases.ball_release is None:
        return BenchmarkResult.insufficient(
            name, "SET or BALL_RELEASE phase not detected"
        )

    range_poses = _poses_in_range(
        poses, phases.set_pos.frame_idx, phases.ball_release.frame_idx
    )
    if not range_poses:
        return BenchmarkResult.insufficient(name, "No pose data between SET and RELEASE")

    nose_ys_raw: list[float | None] = []
    for p in range_poses:
        pt = _px_safe(p, "NOSE")
        nose_ys_raw.append(pt[1] if pt else np.nan)

    valid_nose = [v for v in nose_ys_raw if v is not None and not np.isnan(v)]
    if len(valid_nose) < 3:
        return BenchmarkResult.insufficient(name, "Fewer than 3 valid NOSE detections")

    # Body-height proxy: nose to mid-ankle at SET frame
    set_pose = _pose_nearest(poses, phases.set_pos)
    height_px: Optional[float] = None
    if set_pose:
        nose_pt = _px_safe(set_pose, "NOSE")
        la = _px_safe(set_pose, "LEFT_ANKLE")
        ra = _px_safe(set_pose, "RIGHT_ANKLE")
        if nose_pt and la and ra:
            ankle_mid = _midpoint(la, ra)
            height_px = abs(ankle_mid[1] - nose_pt[1])

    if height_px is None or height_px < 10.0:
        return BenchmarkResult.insufficient(name, "Cannot estimate body height at set")

    nose_ys_smooth = smooth_series(nose_ys_raw, window=7, polyorder=2)
    valid_smooth = nose_ys_smooth[~np.isnan(nose_ys_smooth)]
    if len(valid_smooth) < 3:
        return BenchmarkResult.insufficient(name, "Cannot smooth NOSE trajectory")

    head_y_range = float(np.max(valid_smooth) - np.min(valid_smooth))
    jitter_std = smoothing_residual_std(nose_ys_raw, nose_ys_smooth)
    posture_pct = head_y_range / height_px * 100.0
    score = linear_score(posture_pct, 1.0, 10.0, 10.0, 0.0)
    visibility_ratio = len(valid_nose) / max(len(nose_ys_raw), 1)
    jitter_conf = _residual_confidence(nose_ys_raw, nose_ys_smooth, tolerance=height_px * 0.012)
    conf = _combine_confidence(
        _stability_confidence(valid_smooth.tolist(), expected_span=height_px * 0.08),
        _visibility_confidence(set_pose, ["NOSE", "LEFT_ANKLE", "RIGHT_ANKLE"]),
        visibility_ratio,
        jitter_conf,
        _phase_confidence([phases.set_pos, phases.ball_release]),
    )
    low_conf = conf < 0.4

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=posture_pct,
        unit="%",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "head_y_range_px": round(head_y_range, 1),
            "height_proxy_px": round(height_px, 1),
            "n_nose_frames":   len(valid_nose),
            "head_jitter_std_px": round(jitter_std, 2),
            "low_conf": low_conf,
        },
        note="Head vertical travel as % of body-height proxy (lower = better)." + (" low_conf" if low_conf else ""),
        confidence=conf,
    )


def _compute_lift_thrust(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str,
) -> BenchmarkResult:
    """
    Lift & Thrust: energy-vector angle above horizontal at PEAK LEG LIFT.

    The energy vector runs from the drive ankle (back foot, planted)
    to the stride hip (front hip, elevated at peak lift).

    A steep angle indicates the hip is driving upward — efficient hip
    loading.  A flat angle suggests the pitcher is not loading the hip.

    Handedness:
      R → drive = RIGHT_ANKLE,  stride = LEFT_HIP
      L → drive = LEFT_ANKLE,   stride = RIGHT_HIP

    energy_angle = atan2(|dy|, |dx|)   [0°=flat … 90°=vertical]

    Scoring: ≥25° → 10;  ≤3° → 0;  linear between.
    """
    name = "lift_thrust"
    pose = _pose_nearest(poses, phases.peak_leg_lift)
    if pose is None:
        return BenchmarkResult.insufficient(name, "PEAK_LEG_LIFT pose not found")

    drive_kp  = "RIGHT_ANKLE" if hand == "R" else "LEFT_ANKLE"
    stride_kp = "LEFT_HIP"    if hand == "R" else "RIGHT_HIP"

    drive  = _px_safe(pose, drive_kp)
    stride = _px_safe(pose, stride_kp)

    if drive is None:
        return BenchmarkResult.insufficient(
            name, f"Drive ankle ({drive_kp}) low confidence at peak lift"
        )
    if stride is None:
        return BenchmarkResult.insufficient(
            name, f"Stride hip ({stride_kp}) low confidence at peak lift"
        )

    dx = stride[0] - drive[0]
    dy = stride[1] - drive[1]     # negative = stride_hip is above drive_ankle in room
    angle = angle_from_horizontal_deg(dx, dy)
    score = linear_score(angle, 3.0, 25.0, 0.0, 10.0)
    conf = _combine_confidence(
        _visibility_confidence(pose, [drive_kp, stride_kp]),
        _phase_confidence([phases.peak_leg_lift]),
    )

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=angle,
        unit="°",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "drive_ankle_px": [round(drive[0], 1), round(drive[1], 1)],
            "stride_hip_px":  [round(stride[0], 1), round(stride[1], 1)],
            "vec_dx_px":      round(dx, 1),
            "vec_dy_px":      round(dy, 1),
        },
        note=(
            f"Energy vector ({drive_kp} → {stride_kp}) angle above horizontal. "
            "Higher angle = hip driving up more aggressively."
        ),
        confidence=conf,
    )


def _compute_swivel_stabilize(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str,
) -> BenchmarkResult:
    """
    Swivel & Stabilize: glove wrist stays inside the torso x-bounds at RELEASE.

    If the glove arm flies out laterally, the pitcher loses their "stabilising
    anchor", reducing separation and balance.

    Torso frame: x-range of [L_shoulder, R_shoulder, L_hip, R_hip] at release.
    Condition: torso_min_x ≤ glove_wrist_x ≤ torso_max_x.

    Handedness:
      R throw → glove = LEFT_WRIST
      L throw → glove = RIGHT_WRIST

    Scoring: inside → 10;  outside → 3.
    """
    name = "swivel_stabilize"
    pose = _pose_nearest(poses, phases.ball_release)
    if pose is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE pose not found")

    glove_kp = "LEFT_WRIST" if hand == "R" else "RIGHT_WRIST"
    glove = _px_safe(pose, glove_kp)

    ls = _px_safe(pose, "LEFT_SHOULDER")
    rs = _px_safe(pose, "RIGHT_SHOULDER")
    lh = _px_safe(pose, "LEFT_HIP")
    rh = _px_safe(pose, "RIGHT_HIP")

    if glove is None:
        return BenchmarkResult.insufficient(
            name, f"Glove wrist ({glove_kp}) low confidence at release"
        )
    if not all([ls, rs, lh, rh]):
        return BenchmarkResult.insufficient(
            name, "Hip/shoulder keypoints below threshold at release"
        )

    xs = [p[0] for p in [ls, rs, lh, rh]]
    torso_min = min(xs)
    torso_max = max(xs)
    inside = torso_min <= glove[0] <= torso_max
    score = 10.0 if inside else 3.0
    conf = _combine_confidence(
        _visibility_confidence(pose, [glove_kp, "LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"]),
        _phase_confidence([phases.ball_release]),
    )

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=1.0 if inside else 0.0,
        unit="boolean",
        score=score,
        pass_fail=inside,
        sub_values={
            "glove_x_px":     round(glove[0], 1),
            "torso_min_x_px": round(torso_min, 1),
            "torso_max_x_px": round(torso_max, 1),
            "inside":         inside,
        },
        note=f"Glove ({glove_kp}) x-position inside torso x-bounds at release.",
        confidence=conf,
    )


def _compute_stack_track(
    poses: list[PoseResult],
    phases: PitchPhases,
) -> BenchmarkResult:
    """
    Stack & Track: shoulder-line rotation from SET baseline to RELEASE.

    SIDE-VIEW PROXY: true stacking requires a front-facing camera.
    Here we use the angle of the L→R shoulder axis from horizontal as a
    proxy for rotation visible in the sagittal plane.

    delta = |release_angle − baseline_angle|

    A low delta means the shoulder plane hasn't tilted much relative to
    its starting position, suggesting the pitcher stayed "stacked" over
    the rubber.

    Scoring: ≤3° → 10;  ≥33° → 0;  linear between.
    """
    name = "stack_track"
    set_pose = _pose_nearest(poses, phases.set_pos)
    rel_pose = _pose_nearest(poses, phases.ball_release)

    if set_pose is None:
        return BenchmarkResult.insufficient(name, "SET phase not detected")
    if rel_pose is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE phase not detected")

    baseline = shoulder_line_angle_deg(set_pose)
    release  = shoulder_line_angle_deg(rel_pose)

    if baseline is None:
        return BenchmarkResult.insufficient(
            name, "Shoulder keypoints low confidence at SET"
        )
    if release is None:
        return BenchmarkResult.insufficient(
            name, "Shoulder keypoints low confidence at RELEASE"
        )

    delta = _angle_diff_deg(release, baseline)
    score = linear_score(delta, 3.0, 33.0, 10.0, 0.0)
    conf = _combine_confidence(
        _visibility_confidence(set_pose, ["LEFT_SHOULDER", "RIGHT_SHOULDER"]),
        _visibility_confidence(rel_pose, ["LEFT_SHOULDER", "RIGHT_SHOULDER"]),
        _phase_confidence([phases.set_pos, phases.ball_release]),
    )

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=delta,
        unit="°",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "baseline_angle_deg": round(baseline, 2),
            "release_angle_deg":  round(release, 2),
        },
        note=(
            "Side-view proxy: shoulder-line tilt change SET→RELEASE. "
            "Smaller = shoulders stayed stacked."
        ),
        confidence=conf,
    )


def _compute_torque_retention(
    poses: list[PoseResult],
    phases: PitchPhases,
) -> BenchmarkResult:
    """
    Torque Retention: how closed the shoulders remain at FOOT STRIKE
    relative to how open they are at RELEASE.

    SIDE-VIEW PROXY: uses the same shoulder-line angle as Stack & Track.

    open_at_fs  = |shoulder_angle_at_FS  − baseline|
    open_at_rel = |shoulder_angle_at_rel − baseline|
    ratio       = open_at_fs / max(open_at_rel, 1°)

    ratio ≈ 0  → shoulders barely rotated at foot strike (good)
    ratio ≈ 1  → shoulders already fully open at foot strike (no torque)

    Scoring: ratio ≤0.10 → 10;  ratio ≥0.80 → 0;  linear between.
    """
    name = "torque_retention"
    set_pose = _pose_nearest(poses, phases.set_pos)
    fs_pose  = _pose_nearest(poses, phases.foot_strike)
    rel_pose = _pose_nearest(poses, phases.ball_release)

    for label, p in [("SET", set_pose), ("FOOT_STRIKE", fs_pose), ("BALL_RELEASE", rel_pose)]:
        if p is None:
            return BenchmarkResult.insufficient(name, f"{label} phase not detected")

    baseline = shoulder_line_angle_deg(set_pose)
    fs_angle  = shoulder_line_angle_deg(fs_pose)
    rel_angle = shoulder_line_angle_deg(rel_pose)

    for label, v in [("SET", baseline), ("FOOT_STRIKE", fs_angle), ("RELEASE", rel_angle)]:
        if v is None:
            return BenchmarkResult.insufficient(
                name, f"Shoulder keypoints low confidence at {label}"
            )

    open_at_fs  = _angle_diff_deg(fs_angle,  baseline)
    open_at_rel = _angle_diff_deg(rel_angle, baseline)
    ratio = open_at_fs / max(open_at_rel, 1.0)
    score = linear_score(ratio, 0.10, 0.80, 10.0, 0.0)
    conf = _combine_confidence(
        _visibility_confidence(set_pose, ["LEFT_SHOULDER", "RIGHT_SHOULDER"]),
        _visibility_confidence(fs_pose,  ["LEFT_SHOULDER", "RIGHT_SHOULDER"]),
        _visibility_confidence(rel_pose, ["LEFT_SHOULDER", "RIGHT_SHOULDER"]),
        _phase_confidence([phases.set_pos, phases.foot_strike, phases.ball_release]),
    )

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=ratio,
        unit="ratio",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "baseline_angle_deg": round(baseline, 2),
            "open_at_fs_deg":     round(open_at_fs, 2),
            "open_at_rel_deg":    round(open_at_rel, 2),
            "fs_to_rel_ratio":    round(ratio, 3),
        },
        note=(
            "Side-view proxy. open_at_fs / open_at_rel. "
            "Lower ratio = more torque retained through foot strike."
        ),
        confidence=conf,
    )


def _compute_trunk_stability(
    poses: list[PoseResult],
    phases: PitchPhases,
) -> BenchmarkResult:
    """
    Trunk Stability: change in trunk lean between FOOT STRIKE and BALL RELEASE.

    Replaces Stack & Track in open_side mode. Trunk lean is the angle from
    vertical of the mid-hip → mid-shoulder vector, which is reliably measured
    from a side camera (unlike shoulder-line rotation).

    Scoring: ≤5° delta → 10;  ≥25° delta → 0;  linear between.
    """
    name = "trunk_stability"
    if phases.foot_strike is None:
        return BenchmarkResult.insufficient(name, "FOOT_STRIKE phase not detected")
    if phases.ball_release is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE phase not detected")

    fs_win = _poses_around_phase(poses, phases.foot_strike, before=4, after=4)
    rel_win = _poses_around_phase(poses, phases.ball_release, before=3, after=3)
    if not fs_win or not rel_win:
        return BenchmarkResult.insufficient(name, "Insufficient pose windows around FS/REL")

    def _signed_trunk_angle(p: PoseResult) -> tuple[Optional[float], float]:
        ls = _px_vis_safe(p, "LEFT_SHOULDER")
        rs = _px_vis_safe(p, "RIGHT_SHOULDER")
        lh = _px_vis_safe(p, "LEFT_HIP")
        rh = _px_vis_safe(p, "RIGHT_HIP")
        mid_sho = _weighted_midpoint(ls, rs)
        mid_hip = _weighted_midpoint(lh, rh)
        if mid_sho is None or mid_hip is None:
            return None, 0.0

        dx = mid_sho[0] - mid_hip[0]
        dy = mid_sho[1] - mid_hip[1]
        angle = math.degrees(math.atan2(dx, -dy))

        vis_vals = [v[2] for v in [ls, rs, lh, rh] if v is not None]
        vis = float(np.mean(vis_vals)) if vis_vals else 0.0
        return angle, vis

    fs_angles: list[float] = []
    rel_angles: list[float] = []
    fs_vis: list[float] = []
    rel_vis: list[float] = []

    for p in fs_win:
        angle, vis = _signed_trunk_angle(p)
        if angle is None:
            continue
        fs_angles.append(angle)
        fs_vis.append(vis)

    for p in rel_win:
        angle, vis = _signed_trunk_angle(p)
        if angle is None:
            continue
        rel_angles.append(angle)
        rel_vis.append(vis)

    min_fs_good = 5
    min_rel_good = 3
    if len(fs_angles) < min_fs_good or len(rel_angles) < min_rel_good:
        return BenchmarkResult.insufficient(
            name,
            f"Insufficient stable trunk frames (fs={len(fs_angles)}, rel={len(rel_angles)})",
        )

    def _mad(vals: list[float]) -> float:
        arr = np.asarray(vals, dtype=np.float64)
        med = float(np.median(arr))
        return float(np.median(np.abs(arr - med)))

    fs_angle = float(np.median(fs_angles))
    rel_angle = float(np.median(rel_angles))
    fs_mad = _mad(fs_angles)
    rel_mad = _mad(rel_angles)

    if fs_mad > 3.0 or rel_mad > 3.0:
        return BenchmarkResult.insufficient(
            name,
            f"Trunk jitter too high for reliable score (fs_mad={fs_mad:.2f}, rel_mad={rel_mad:.2f})",
        )

    delta_signed = _angle_diff_signed_deg(rel_angle, fs_angle)
    delta_abs = abs(delta_signed)
    score = linear_score(delta_abs, 5.0, 20.0, 10.0, 0.0)

    jitter_mad = max(fs_mad, rel_mad)
    jitter_score = _clamp01(jitter_mad / 3.0)
    coverage_conf = _clamp01(
        min(
            len(fs_angles) / max(len(fs_win), 1),
            len(rel_angles) / max(len(rel_win), 1),
        )
    )
    conf = _clamp01(min(coverage_conf, 1.0 - jitter_score))

    if abs(fs_angle) > 70.0:
        conf = _clamp01(conf * 0.35)

    if delta_signed > 1.0:
        direction = "forward-lean increase (dumping forward)"
    elif delta_signed < -1.0:
        direction = "upright shift (standing up/pulling off)"
    else:
        direction = "neutral trunk direction"

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=delta_abs,
        unit="°",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "trunk_angle_fs_deg": round(fs_angle, 2),
            "trunk_angle_rel_deg": round(rel_angle, 2),
            "delta_signed_deg": round(delta_signed, 2),
            "delta_abs_deg": round(delta_abs, 2),
            "delta_deg": round(delta_abs, 2),
            "fs_mad_deg": round(fs_mad, 2),
            "rel_mad_deg": round(rel_mad, 2),
            "fs_window_frames": len(fs_angles),
            "rel_window_frames": len(rel_angles),
            "coverage_ratio": round(coverage_conf, 2),
        },
        note=(
            "Windowed trunk-angle change FS->REL (median over phase windows). "
            f"Direction: {direction}."
        ),
        confidence=conf,
    )


def _compute_trunk_stability_v2(
    poses: list[PoseResult],
    phases: PitchPhases,
) -> BenchmarkResult:
    """
    Trunk Stability v2:
      - Wider windows around FS/REL
      - Robust Theil-Sen fit per window
      - Delta from fitted window centres
      - Hard gating on residuals, coverage, and visibility
    """
    name = "trunk_stability_v2"
    if phases.foot_strike is None:
        return BenchmarkResult.insufficient(name, "FOOT_STRIKE phase not detected")
    if phases.ball_release is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE phase not detected")

    fs_win = _poses_around_phase(poses, phases.foot_strike, before=6, after=6)
    rel_win = _poses_around_phase(poses, phases.ball_release, before=5, after=5)
    if not fs_win or not rel_win:
        return BenchmarkResult.insufficient(name, "Insufficient trunk windows around FS/REL")

    def _sample_window(win: list[PoseResult]) -> tuple[list[float], list[float], list[float]]:
        xs: list[float] = []
        ys: list[float] = []
        vis: list[float] = []
        for p in win:
            ls = _px_vis_safe(p, "LEFT_SHOULDER")
            rs = _px_vis_safe(p, "RIGHT_SHOULDER")
            lh = _px_vis_safe(p, "LEFT_HIP")
            rh = _px_vis_safe(p, "RIGHT_HIP")
            mid_sho = _weighted_midpoint(ls, rs)
            mid_hip = _weighted_midpoint(lh, rh)
            if mid_sho is None or mid_hip is None:
                continue
            vis_vals = [v[2] for v in [ls, rs, lh, rh] if v is not None]
            mean_vis = float(np.mean(vis_vals)) if vis_vals else 0.0
            if mean_vis < 0.25:
                continue
            dx = mid_sho[0] - mid_hip[0]
            dy = mid_sho[1] - mid_hip[1]
            angle = math.degrees(math.atan2(dx, -dy))
            xs.append(float(p.frame_idx))
            ys.append(float(angle))
            vis.append(mean_vis)
        return xs, ys, vis

    fs_x, fs_y, fs_vis = _sample_window(fs_win)
    rel_x, rel_y, rel_vis = _sample_window(rel_win)
    min_fs = 6
    min_rel = 5
    if len(fs_x) < min_fs or len(rel_x) < min_rel:
        return BenchmarkResult.insufficient(
            name,
            f"Insufficient stable trunk frames (fs={len(fs_x)}, rel={len(rel_x)})",
        )

    fs_fit = _theil_sen_fit(fs_x, fs_y)
    rel_fit = _theil_sen_fit(rel_x, rel_y)
    if fs_fit is None or rel_fit is None:
        return BenchmarkResult.insufficient(name, "Robust trunk fit failed")

    fs_slope, fs_intercept, fs_mad = fs_fit
    rel_slope, rel_intercept, rel_mad = rel_fit

    fs_cov = len(fs_x) / max(len(fs_win), 1)
    rel_cov = len(rel_x) / max(len(rel_win), 1)
    if fs_cov < 0.45 or rel_cov < 0.45:
        return BenchmarkResult.insufficient(
            name,
            f"Low trunk window coverage (fs={fs_cov:.2f}, rel={rel_cov:.2f})",
        )

    if fs_mad > 4.0 or rel_mad > 4.0:
        return BenchmarkResult.insufficient(
            name,
            f"High trunk fit residuals (fs={fs_mad:.2f}, rel={rel_mad:.2f})",
        )

    fs_center_x = float(phases.foot_strike.frame_idx)
    rel_center_x = float(phases.ball_release.frame_idx)
    fs_angle = fs_slope * fs_center_x + fs_intercept
    rel_angle = rel_slope * rel_center_x + rel_intercept

    delta_signed = _angle_diff_signed_deg(rel_angle, fs_angle)
    delta_abs = abs(delta_signed)
    score = linear_score(delta_abs, 5.0, 20.0, 10.0, 0.0)

    vis_conf = _clamp01((min(np.mean(fs_vis), np.mean(rel_vis)) - 0.25) / 0.75)
    coverage_conf = _clamp01(min(fs_cov, rel_cov))
    residual_conf = _clamp01(1.0 - max(fs_mad, rel_mad) / 4.5)
    conf = _combine_confidence(
        vis_conf,
        coverage_conf,
        residual_conf,
        _phase_confidence([phases.foot_strike, phases.ball_release]),
    )

    if abs(fs_angle) > 70.0:
        conf = _clamp01(conf * 0.35)

    if delta_signed > 1.0:
        direction = "forward-lean increase (dumping forward)"
    elif delta_signed < -1.0:
        direction = "upright shift (standing up/pulling off)"
    else:
        direction = "neutral trunk direction"

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=delta_abs,
        unit="°",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "trunk_angle_fs_deg": round(fs_angle, 2),
            "trunk_angle_rel_deg": round(rel_angle, 2),
            "delta_signed_deg": round(delta_signed, 2),
            "delta_abs_deg": round(delta_abs, 2),
            "fs_fit_mad_deg": round(fs_mad, 2),
            "rel_fit_mad_deg": round(rel_mad, 2),
            "fs_window_frames": len(fs_x),
            "rel_window_frames": len(rel_x),
            "fs_coverage": round(fs_cov, 2),
            "rel_coverage": round(rel_cov, 2),
        },
        note=(
            "Trunk-angle change FS->REL from robust fitted windows. "
            f"Direction: {direction}."
        ),
        confidence=conf,
    )


# ---------------------------------------------------------------------------
# Additional open-side-friendly metrics
# ---------------------------------------------------------------------------

def _knee_flexion_deg(
    pose: PoseResult,
    hip_kp: str,
    knee_kp: str,
    ankle_kp: str,
) -> Optional[float]:
    """Return knee flexion in degrees (0 = straight, larger = more flexed)."""

    def _angle_between_vectors(a: tuple[float, float], b: tuple[float, float]) -> float:
        dot = a[0] * b[0] + a[1] * b[1]
        la = math.hypot(a[0], a[1])
        lb = math.hypot(b[0], b[1])
        if la < 1e-6 or lb < 1e-6:
            return 0.0
        cos_theta = max(-1.0, min(1.0, dot / (la * lb)))
        return math.degrees(math.acos(cos_theta))

    hip = _px_safe(pose, hip_kp)
    knee = _px_safe(pose, knee_kp)
    ankle = _px_safe(pose, ankle_kp)
    if not all([hip, knee, ankle]):
        return None
    v1 = (hip[0] - knee[0], hip[1] - knee[1])      # hip -> knee
    v2 = (ankle[0] - knee[0], ankle[1] - knee[1])  # ankle -> knee
    angle = _angle_between_vectors(v1, v2)         # 0..180 at the joint
    flexion = max(0.0, min(180.0, 180.0 - angle))  # convert to flexion
    return flexion


def _score_front_knee_flexion_fs(flexion: float) -> float:
    # Ideal landing flexion ~35–65°. Collapse >95° or locked <15° scores low.
    if flexion <= 15:
        return 0.0
    if flexion >= 95:
        return 0.0
    if flexion <= 35:
        return linear_score(flexion, 15.0, 35.0, 0.0, 10.0)
    if flexion <= 65:
        return 10.0
    return linear_score(flexion, 65.0, 95.0, 10.0, 0.0)


def _score_front_knee_extension_rel(flexion: float) -> float:
    # At release we want the lead leg firming up: ~5–35° flexion ideal.
    if flexion < 0:
        return 0.0
    if flexion <= 5:
        return linear_score(flexion, 0.0, 5.0, 0.0, 10.0)
    if flexion <= 35:
        return 10.0
    if flexion >= 80:
        return 0.0
    return linear_score(flexion, 35.0, 80.0, 10.0, 0.0)


def _compute_front_knee_flexion_fs(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str,
) -> BenchmarkResult:
    name = "front_knee_flexion_fs"
    pose = _pose_nearest(poses, phases.foot_strike)
    if pose is None:
        return BenchmarkResult.insufficient(name, "FOOT_STRIKE pose not found")

    lead_prefix = "LEFT" if hand == "R" else "RIGHT"
    flex = _knee_flexion_deg(
        pose, f"{lead_prefix}_HIP", f"{lead_prefix}_KNEE", f"{lead_prefix}_ANKLE"
    )
    if flex is None:
        return BenchmarkResult.insufficient(
            name, "Lead leg keypoints low confidence at foot strike"
        )

    score = _score_front_knee_flexion_fs(flex)
    conf = _combine_confidence(
        _visibility_confidence(
            pose, [f"{lead_prefix}_HIP", f"{lead_prefix}_KNEE", f"{lead_prefix}_ANKLE"]
        ),
        _phase_confidence([phases.foot_strike]),
    )

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=flex,
        unit="° flexion",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={"flexion_deg": round(flex, 1)},
        note="Lead knee flexion at foot strike (firm but not locked).",
        confidence=conf,
    )


def _compute_front_knee_extension_rel(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str,
) -> BenchmarkResult:
    """
    Front-knee bracing into release (FS -> REL).

    Keeps legacy metric key `front_knee_extension_rel` for backward compatibility,
    but the primary raw value is the flexion delta:
      delta_flexion_deg = flexion_at_FS - flexion_at_REL
    Positive delta means the knee extends/braces into release.
    """
    name = "front_knee_extension_rel"
    fs_pose = _pose_nearest(poses, phases.foot_strike)
    rel_pose = _pose_nearest(poses, phases.ball_release)
    if fs_pose is None:
        return BenchmarkResult.insufficient(name, "FOOT_STRIKE pose not found")
    if rel_pose is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE pose not found")

    lead_prefix = "LEFT" if hand == "R" else "RIGHT"
    fs_flex = _knee_flexion_deg(
        fs_pose, f"{lead_prefix}_HIP", f"{lead_prefix}_KNEE", f"{lead_prefix}_ANKLE"
    )
    rel_flex = _knee_flexion_deg(
        rel_pose, f"{lead_prefix}_HIP", f"{lead_prefix}_KNEE", f"{lead_prefix}_ANKLE"
    )
    if fs_flex is None or rel_flex is None:
        return BenchmarkResult.insufficient(
            name, "Lead leg keypoints low confidence at foot strike/release"
        )

    delta_flex = fs_flex - rel_flex
    dt = max(1.0 / max(phases.fps, 1e-6), phases.ball_release.time_s - phases.foot_strike.time_s)
    brace_rate = delta_flex / dt if dt > 1e-9 else 0.0

    lead_knee_rel = _px_safe(rel_pose, f"{lead_prefix}_KNEE")
    lead_ankle_rel = _px_safe(rel_pose, f"{lead_prefix}_ANKLE")
    ls_rel = _px_safe(rel_pose, "LEFT_SHOULDER")
    rs_rel = _px_safe(rel_pose, "RIGHT_SHOULDER")
    if not all([lead_knee_rel, lead_ankle_rel, ls_rel, rs_rel]):
        return BenchmarkResult.insufficient(
            name, "Lead knee/ankle/shoulder keypoints low confidence at release"
        )

    shoulder_width = math.dist(ls_rel, rs_rel)
    if shoulder_width < 1e-3:
        return BenchmarkResult.insufficient(name, "Shoulder width too small at release")

    knee_over_ankle_x = (lead_knee_rel[0] - lead_ankle_rel[0]) / shoulder_width
    leak_mag = abs(knee_over_ankle_x)

    delta_score = linear_score(delta_flex, 3.0, 20.0, 0.0, 10.0)
    rate_score = linear_score(brace_rate, 40.0, 170.0, 0.0, 10.0)
    leak_score = linear_score(leak_mag, 0.05, 0.55, 10.0, 0.0)
    rel_score = _score_front_knee_extension_rel(rel_flex)
    score = max(0.0, min(10.0, 0.42 * delta_score + 0.28 * rate_score + 0.20 * leak_score + 0.10 * rel_score))

    if delta_flex <= 0.0:
        score *= 0.25
    if leak_mag > 0.75:
        score = min(score, 3.0)

    conf = _combine_confidence(
        _visibility_confidence(
            fs_pose, [f"{lead_prefix}_HIP", f"{lead_prefix}_KNEE", f"{lead_prefix}_ANKLE"]
        ),
        _visibility_confidence(
            rel_pose, [f"{lead_prefix}_HIP", f"{lead_prefix}_KNEE", f"{lead_prefix}_ANKLE"]
        ),
        _phase_confidence([phases.foot_strike, phases.ball_release]),
    )

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=delta_flex,
        unit="° delta",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "flexion_fs_deg": round(fs_flex, 1),
            "flexion_rel_deg": round(rel_flex, 1),
            "delta_flexion_deg": round(delta_flex, 1),
            "brace_rate_deg_s": round(brace_rate, 1),
            "knee_over_ankle_x": round(knee_over_ankle_x, 3),
            "knee_leak_mag": round(leak_mag, 3),
        },
        note=(
            "Lead-knee bracing FS->REL using flexion delta, brace rate, and knee-over-ankle leak control."
        ),
        confidence=conf,
    )


def _score_drift_to_pll_pct(drift_to_pll_pct: float) -> float:
    if drift_to_pll_pct <= 1.0:
        return 0.0
    if drift_to_pll_pct <= 4.0:
        return linear_score(drift_to_pll_pct, 1.0, 4.0, 0.0, 10.0)
    if drift_to_pll_pct <= 10.0:
        return linear_score(drift_to_pll_pct, 4.0, 10.0, 10.0, 6.0)
    if drift_to_pll_pct <= 18.0:
        return linear_score(drift_to_pll_pct, 10.0, 18.0, 6.0, 0.0)
    return 0.0


def _score_drift_ratio(early_ratio: float) -> float:
    if early_ratio <= 0.15:
        return 0.0
    if early_ratio <= 0.40:
        return linear_score(early_ratio, 0.15, 0.40, 0.0, 10.0)
    if early_ratio <= 0.70:
        return linear_score(early_ratio, 0.40, 0.70, 10.0, 8.0)
    if early_ratio <= 0.90:
        return linear_score(early_ratio, 0.70, 0.90, 8.0, 1.0)
    return 0.0


def _score_total_drift_pct(total_pct: float) -> float:
    if total_pct <= 4.0:
        return 0.0
    if total_pct <= 14.0:
        return linear_score(total_pct, 4.0, 14.0, 0.0, 10.0)
    if total_pct <= 25.0:
        return linear_score(total_pct, 14.0, 25.0, 10.0, 8.0)
    if total_pct <= 40.0:
        return linear_score(total_pct, 25.0, 40.0, 8.0, 0.0)
    return 0.0


def _compute_drift_forward(
    poses: list[PoseResult],
    phases: PitchPhases,
) -> BenchmarkResult:
    """
    Drift forward (open-side):
      - drift_to_pll: SET -> PEAK_LEG_LIFT hip-midpoint x shift
      - drift_pll_to_fs: PEAK_LEG_LIFT -> FOOT_STRIKE hip-midpoint x shift

    Uses body-height normalisation so values are scale-independent.
    """
    name = "drift_forward"
    if phases.set_pos is None or phases.peak_leg_lift is None or phases.foot_strike is None:
        return BenchmarkResult.insufficient(name, "SET/PEAK_LEG_LIFT/FOOT_STRIKE phase not detected")

    start = min(phases.set_pos.frame_idx, phases.foot_strike.frame_idx)
    end = max(phases.set_pos.frame_idx, phases.foot_strike.frame_idx)
    span = _poses_in_range(poses, start, end)
    if len(span) < 6:
        return BenchmarkResult.insufficient(name, "Not enough frames between SET and FOOT_STRIKE")

    frames: list[int] = []
    hip_x_raw: list[float] = []
    hip_vis: list[float] = []

    for p in span:
        lh = _px_vis_safe(p, "LEFT_HIP")
        rh = _px_vis_safe(p, "RIGHT_HIP")
        mid = _weighted_midpoint(lh, rh)
        if mid is None:
            continue
        vis_vals = [v[2] for v in [lh, rh] if v is not None]
        vis = float(np.mean(vis_vals)) if vis_vals else 0.0
        frames.append(p.frame_idx)
        hip_x_raw.append(float(mid[0]))
        hip_vis.append(vis)

    if len(frames) < 6:
        return BenchmarkResult.insufficient(name, "Insufficient hip visibility in SET->FS window")

    hip_x_smooth = smooth_series(hip_x_raw, window=7, polyorder=2)
    frame_to_x: dict[int, float] = {
        f: float(x)
        for f, x in zip(frames, hip_x_smooth)
        if not np.isnan(x)
    }
    if len(frame_to_x) < 5:
        return BenchmarkResult.insufficient(name, "Unable to smooth hip midpoint trajectory")

    def _phase_x(phase: Phase, radius: int = 3) -> Optional[float]:
        vals: list[float] = []
        for f in range(phase.frame_idx - radius, phase.frame_idx + radius + 1):
            v = frame_to_x.get(f)
            if v is not None:
                vals.append(v)
        if not vals:
            return None
        return float(np.median(np.asarray(vals, dtype=np.float64)))

    set_x = _phase_x(phases.set_pos, radius=3)
    pll_x = _phase_x(phases.peak_leg_lift, radius=3)
    fs_x = _phase_x(phases.foot_strike, radius=3)
    if set_x is None or pll_x is None or fs_x is None:
        return BenchmarkResult.insufficient(name, "Cannot estimate stable hip positions at SET/PLL/FS")

    set_pose = _pose_nearest(poses, phases.set_pos)
    body_height = _body_height_proxy_px(set_pose, fallback_height=float(span[0].height) * 0.55)
    if body_height is None or body_height < 10.0:
        return BenchmarkResult.insufficient(name, "Cannot estimate body-height proxy")

    drift_to_pll = abs(pll_x - set_x) / body_height * 100.0
    drift_pll_to_fs = abs(fs_x - pll_x) / body_height * 100.0
    total_drift = abs(fs_x - set_x) / body_height * 100.0
    early_ratio = drift_to_pll / max(total_drift, 1e-6)

    score = max(
        0.0,
        min(
            10.0,
            0.45 * _score_drift_to_pll_pct(drift_to_pll)
            + 0.35 * _score_drift_ratio(early_ratio)
            + 0.20 * _score_total_drift_pct(total_drift),
        ),
    )

    vis_scaled = [_clamp01((v - 0.25) / 0.75) for v in hip_vis]
    visibility_conf = float(np.mean(vis_scaled)) if vis_scaled else 0.0
    coverage_conf = _clamp01(len(frame_to_x) / max(len(span), 1))
    jitter_conf = _residual_confidence(hip_x_raw, hip_x_smooth, tolerance=body_height * 0.010)
    smooth_vals = [v for v in hip_x_smooth if not np.isnan(v)]
    stability_conf = _stability_confidence(smooth_vals, expected_span=body_height * 0.18)
    conf = _combine_confidence(
        visibility_conf,
        coverage_conf,
        jitter_conf,
        stability_conf,
        _phase_confidence([phases.set_pos, phases.peak_leg_lift, phases.foot_strike]),
    )

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=total_drift,
        unit="% height",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "drift_to_pll_pct_height": round(drift_to_pll, 3),
            "drift_pll_to_fs_pct_height": round(drift_pll_to_fs, 3),
            "total_drift_pct_height": round(total_drift, 3),
            "early_ratio": round(early_ratio, 3),
        },
        note=(
            "Hip midpoint drift profile SET->PLL->FS. "
            "Rewards early controlled move; penalises staying back or collapsing early."
        ),
        confidence=conf,
    )


def _compute_tilt_consistency_release(
    poses: list[PoseResult],
    phases: PitchPhases,
) -> BenchmarkResult:
    """
    Hip/shoulder tilt consistency at release (side-view friendly).
    Measures |shoulder tilt − hip tilt|; smaller gap = better stack.
    """
    name = "tilt_consistency"
    pose = _pose_nearest(poses, phases.ball_release)
    if pose is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE pose not found")

    win = _poses_around_phase(poses, phases.ball_release, before=4, after=2)
    if not win:
        win = [pose]

    shoulder_raw: list[float | None] = []
    hip_raw: list[float | None] = []
    for wp in win:
        shoulder_raw.append(shoulder_line_angle_deg(wp))
        l_hip = _px_safe(wp, "LEFT_HIP")
        r_hip = _px_safe(wp, "RIGHT_HIP")
        if l_hip and r_hip:
            dx = r_hip[0] - l_hip[0]
            dy = r_hip[1] - l_hip[1]
            hip_raw.append(math.degrees(math.atan2(dy, dx + 1e-9)))
        else:
            hip_raw.append(np.nan)

    shoulder_smooth = smooth_series(shoulder_raw, window=5, polyorder=2)
    hip_smooth = smooth_series(hip_raw, window=5, polyorder=2)
    valid_sh = shoulder_smooth[~np.isnan(shoulder_smooth)]
    valid_hp = hip_smooth[~np.isnan(hip_smooth)]
    if len(valid_sh) < 2 or len(valid_hp) < 2:
        return BenchmarkResult.insufficient(name, "Hip/shoulder keypoints low confidence at release")

    shoulder_tilt = float(np.median(valid_sh))
    hip_tilt = float(np.median(valid_hp))
    diff = abs(shoulder_tilt - hip_tilt)
    score = linear_score(diff, 8.0, 25.0, 10.0, 0.0)
    jitter_conf = min(
        _residual_confidence(shoulder_raw, shoulder_smooth, tolerance=3.0),
        _residual_confidence(hip_raw, hip_smooth, tolerance=3.0),
    )
    conf = _combine_confidence(
        _visibility_confidence(pose, ["LEFT_HIP", "RIGHT_HIP", "LEFT_SHOULDER", "RIGHT_SHOULDER"]),
        jitter_conf,
        _phase_confidence([phases.ball_release]),
    )

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=diff,
        unit="°",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "shoulder_tilt_deg": round(shoulder_tilt, 2),
            "hip_tilt_deg": round(hip_tilt, 2),
            "tilt_gap_deg": round(diff, 2),
            "tilt_window_frames": len(win),
            "shoulder_jitter_std_deg": round(smoothing_residual_std(shoulder_raw, shoulder_smooth), 2),
            "hip_jitter_std_deg": round(smoothing_residual_std(hip_raw, hip_smooth), 2),
        },
        note="Shoulder vs hip tilt gap at release. Smaller gap = better stack.",
        confidence=conf,
    )


def _compute_release_extension_proxy(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str,
) -> BenchmarkResult:
    """
    Release extension proxy from side view:
      normalized distance (throwing wrist → drive hip) / shoulder width.

    Side-view measures forward reach; not true extension depth but correlates.
    """
    name = "release_extension_proxy"
    pose = _pose_nearest(poses, phases.ball_release)
    if pose is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE pose not found")

    throw_wrist = "RIGHT_WRIST" if hand == "R" else "LEFT_WRIST"
    drive_hip   = "RIGHT_HIP" if hand == "R" else "LEFT_HIP"

    wrist = _px_safe(pose, throw_wrist)
    hip = _px_safe(pose, drive_hip)
    ls = _px_safe(pose, "LEFT_SHOULDER")
    rs = _px_safe(pose, "RIGHT_SHOULDER")

    if wrist is None or hip is None or ls is None or rs is None:
        return BenchmarkResult.insufficient(
            name, "Wrist/hip/shoulder keypoints low confidence at release"
        )

    shoulder_width = math.dist(ls, rs)
    if shoulder_width < 1e-3:
        return BenchmarkResult.insufficient(name, "Shoulder width too small to normalise")

    dist = math.dist(wrist, hip)
    norm = dist / shoulder_width

    score = _score_release_extension_proxy(norm)

    conf = _combine_confidence(
        _visibility_confidence(pose, [throw_wrist, drive_hip, "LEFT_SHOULDER", "RIGHT_SHOULDER"]),
        _phase_confidence([phases.ball_release]),
    )

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=norm,
        unit="x shoulder",
        score=score,
        pass_fail=score >= 6.0,
        sub_values={
            "distance_px": round(dist, 1),
            "shoulder_width_px": round(shoulder_width, 1),
            "norm_distance": round(norm, 2),
        },
        note="Side-view proxy for release reach (wrist vs drive hip) normalised by shoulder width.",
        confidence=conf,
    )


def _score_release_angle_proxy(angle_deg: float) -> float:
    """
    Shoulder->wrist line relative to trunk line at release.

    Very small angle often indicates a collapsed arm path; very large can
    indicate inefficient arm path for this side-view proxy.
    """
    if angle_deg <= 20.0:
        return 0.0
    if angle_deg <= 65.0:
        return linear_score(angle_deg, 20.0, 65.0, 0.0, 10.0)
    if angle_deg <= 110.0:
        return linear_score(angle_deg, 65.0, 110.0, 10.0, 8.0)
    if angle_deg <= 150.0:
        return linear_score(angle_deg, 110.0, 150.0, 8.0, 0.0)
    return 0.0


def _score_forward_intent(vx_norm_per_s: float) -> float:
    """Score smoothed wrist-x velocity (normalised by body height per second)."""
    if vx_norm_per_s <= 0.12:
        return 0.0
    if vx_norm_per_s <= 0.35:
        return linear_score(vx_norm_per_s, 0.12, 0.35, 0.0, 8.0)
    if vx_norm_per_s <= 0.80:
        return linear_score(vx_norm_per_s, 0.35, 0.80, 8.0, 10.0)
    return 10.0


def _compute_release_extension_v2(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str,
) -> BenchmarkResult:
    """
    Open-side release extension composite:
      A) reach depth proxy (stabilised)
      B) release-angle proxy (shoulder->wrist vs trunk line)
      C) forward intent (smoothed wrist x-velocity pre-release)
    """
    name = "release_extension_v2"
    if phases.ball_release is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE phase not detected")

    rel_pose = _pose_nearest(poses, phases.ball_release)
    if rel_pose is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE pose not found")

    throw_wrist = "RIGHT_WRIST" if hand == "R" else "LEFT_WRIST"
    drive_hip = "RIGHT_HIP" if hand == "R" else "LEFT_HIP"

    total_w = 0.55 + 0.25 + 0.20
    comp_scores: dict[str, float] = {}
    comp_conf: dict[str, float] = {}
    comp_weights = {"A": 0.55, "B": 0.25, "C": 0.20}
    sub_values: dict[str, float] = {}

    # ------------------------------------------------------------------
    # Component A: reach depth from release window (smoothed)
    # ------------------------------------------------------------------
    rel_win = _poses_around_phase(poses, phases.ball_release, before=4, after=2)
    if not rel_win:
        rel_win = [rel_pose]

    reach_raw: list[float] = []
    reach_vis: list[float] = []
    for p in rel_win:
        wrist = _px_safe(p, throw_wrist)
        hip = _px_safe(p, drive_hip)
        ls = _px_safe(p, "LEFT_SHOULDER")
        rs = _px_safe(p, "RIGHT_SHOULDER")
        if wrist is None or hip is None or ls is None or rs is None:
            reach_raw.append(np.nan)
            continue
        shoulder_width = math.dist(ls, rs)
        if shoulder_width < 1e-3:
            reach_raw.append(np.nan)
            continue
        reach_raw.append(math.dist(wrist, hip) / shoulder_width)
        reach_vis.append(
            _visibility_confidence(
                p,
                [throw_wrist, drive_hip, "LEFT_SHOULDER", "RIGHT_SHOULDER"],
            )
        )

    reach_smooth = smooth_series(reach_raw, window=5, polyorder=2)
    reach_valid = reach_smooth[~np.isnan(reach_smooth)]
    if len(reach_valid) < 2:
        return BenchmarkResult.insufficient(name, "Insufficient release reach visibility")

    reach_norm = float(np.median(reach_valid))
    a_score = _score_release_extension_proxy(reach_norm)
    a_conf = _combine_confidence(
        float(np.mean(reach_vis)) if reach_vis else 0.0,
        _residual_confidence(reach_raw, reach_smooth, tolerance=0.35),
        _phase_confidence([phases.ball_release]),
    )
    comp_scores["A"] = a_score
    comp_conf["A"] = a_conf
    sub_values["component_a_reach_norm"] = round(reach_norm, 3)
    sub_values["component_a_score"] = round(a_score, 3)

    # ------------------------------------------------------------------
    # Component B: release angle proxy (arm line vs trunk line)
    # ------------------------------------------------------------------
    ls = _px_vis_safe(rel_pose, "LEFT_SHOULDER")
    rs = _px_vis_safe(rel_pose, "RIGHT_SHOULDER")
    lh = _px_vis_safe(rel_pose, "LEFT_HIP")
    rh = _px_vis_safe(rel_pose, "RIGHT_HIP")
    wrist_rel = _px_vis_safe(rel_pose, throw_wrist)
    mid_sh = _weighted_midpoint(ls, rs)
    mid_hip = _weighted_midpoint(lh, rh)

    b_angle = None
    if mid_sh is not None and mid_hip is not None and wrist_rel is not None:
        arm_vec = (wrist_rel[0] - mid_sh[0], wrist_rel[1] - mid_sh[1])
        trunk_vec = (mid_hip[0] - mid_sh[0], mid_hip[1] - mid_sh[1])
        b_angle = _angle_between_vectors_deg(arm_vec, trunk_vec)

    if b_angle is not None:
        b_score = _score_release_angle_proxy(float(b_angle))
        vis_vals = [v[2] for v in [ls, rs, lh, rh, wrist_rel] if v is not None]
        vis_conf = _clamp01((float(np.mean(vis_vals)) - 0.25) / 0.75) if vis_vals else 0.0
        comp_scores["B"] = b_score
        comp_conf["B"] = _combine_confidence(vis_conf, _phase_confidence([phases.ball_release]))
        sub_values["component_b_angle_deg"] = round(float(b_angle), 3)
        sub_values["component_b_score"] = round(b_score, 3)

    # ------------------------------------------------------------------
    # Component C: forward intent from pre-release wrist-x velocity
    # ------------------------------------------------------------------
    pre_start = max(0, phases.ball_release.frame_idx - 6)
    pre_win = _poses_in_range(poses, pre_start, phases.ball_release.frame_idx)
    body_height = _body_height_proxy_px(
        _pose_nearest(poses, phases.set_pos) or rel_pose,
        fallback_height=float(rel_pose.height) * 0.55,
    )

    wrist_x_raw: list[float] = []
    wrist_vis: list[float] = []
    for p in pre_win:
        wpt = _px_vis_safe(p, throw_wrist)
        if wpt is None:
            wrist_x_raw.append(np.nan)
            continue
        wrist_x_raw.append(float(wpt[0]))
        wrist_vis.append(_clamp01((wpt[2] - 0.25) / 0.75))

    wrist_x_smooth = smooth_series(wrist_x_raw, window=5, polyorder=2)
    vx_vals: list[float] = []
    for i in range(1, len(wrist_x_smooth)):
        a = wrist_x_smooth[i - 1]
        b = wrist_x_smooth[i]
        if np.isnan(a) or np.isnan(b):
            continue
        vx_vals.append((b - a) * phases.fps)

    if vx_vals and body_height is not None and body_height > 1e-6:
        vx_norm = float(np.median(np.abs(np.asarray(vx_vals, dtype=np.float64))) / body_height)
        c_score = _score_forward_intent(vx_norm)
        c_conf = _combine_confidence(
            float(np.mean(wrist_vis)) if wrist_vis else 0.0,
            _residual_confidence(wrist_x_raw, wrist_x_smooth, tolerance=body_height * 0.012),
            _phase_confidence([phases.ball_release]),
        )
        comp_scores["C"] = c_score
        comp_conf["C"] = c_conf
        sub_values["component_c_wrist_vx_norm"] = round(vx_norm, 3)
        sub_values["component_c_score"] = round(c_score, 3)

    # A is mandatory; B/C may drop with occlusion and are confidence-penalised.
    if "A" not in comp_scores:
        return BenchmarkResult.insufficient(name, "Release reach component unavailable")

    used_weights = {k: comp_weights[k] for k in comp_scores.keys()}
    weight_sum = sum(used_weights.values())
    if weight_sum <= 1e-9:
        return BenchmarkResult.insufficient(name, "No extension_v2 components available")

    score = sum(comp_scores[k] * used_weights[k] for k in comp_scores.keys()) / weight_sum
    conf_weighted = sum(comp_conf.get(k, 0.0) * used_weights[k] for k in comp_scores.keys()) / weight_sum
    coverage_penalty = _clamp01(weight_sum / total_w)
    conf = _clamp01(conf_weighted * coverage_penalty)

    sub_values["components_used"] = len(comp_scores)
    sub_values["coverage_weight"] = round(coverage_penalty, 3)

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=reach_norm,
        unit="x shoulder",
        score=max(0.0, min(10.0, score)),
        pass_fail=score >= 6.0,
        sub_values=sub_values,
        note="Composite release extension proxy from reach, release-angle, and forward-intent cues.",
        confidence=conf,
    )


def _score_release_extension_proxy(value: float) -> float:
    """
    Smooth linear score map for release extension proxy.

    x is clamped to [8.0, 10.5]:
      score = 10 * (x - 8.0) / (10.5 - 8.0)
    """
    x = max(8.0, min(10.5, float(value)))
    score = 10.0 * (x - 8.0) / 2.5
    return max(0.0, min(10.0, score))


# ---------------------------------------------------------------------------
# Efficiency scoring
# ---------------------------------------------------------------------------

OPEN_SIDE_METRIC_ORDER: tuple[str, ...] = (
    "timing",
    "drift_forward",
    "front_knee_flexion_fs",
    "front_knee_extension_rel",
    "trunk_stability_v2",
    "release_extension_v2",
    "swivel_stabilize",
)

FRONT_VIEW_METRIC_ORDER: tuple[str, ...] = (
    "timing",
    "balance",
    "posture",
    "lift_thrust",
    "swivel_stabilize",
    "stack_track",
    "torque_retention",
    "front_knee_flexion_fs",
    "front_knee_extension_rel",
    "tilt_consistency",
    "drift_forward",
    "release_extension_v2",
    "release_extension_proxy",
)

FRONT_VIEW_ONLY_METRICS: tuple[str, ...] = ("stack_track", "torque_retention")
OPEN_SIDE_DEBUG_METRICS: tuple[str, ...] = (
    "balance",
    "posture",
    "lift_thrust",
    "tilt_consistency",
    "trunk_stability",
    "release_extension_proxy",
)


def official_metric_names(view_mode: str) -> tuple[str, ...]:
    """Metric names that are eligible for scoring and issue ranking."""
    return FRONT_VIEW_METRIC_ORDER if view_mode == "front" else OPEN_SIDE_METRIC_ORDER


_COMMON_WEIGHTS: dict[str, float] = {
    "timing": 1.0,
    "balance": 1.0,
    "posture": 1.0,
    "lift_thrust": 1.0,
    "swivel_stabilize": 1.0,
    "drift_forward": 1.0,
    "front_knee_flexion_fs": 1.0,
    "front_knee_extension_rel": 1.0,
    "trunk_stability_v2": 1.0,
    "tilt_consistency": 1.0,
    "release_extension_v2": 1.0,
    "release_extension_proxy": 1.0,
}

_OPEN_SIDE_WEIGHTS: dict[str, float] = {
    "timing": 1.0,
    "drift_forward": 1.3,
    "front_knee_flexion_fs": 1.1,
    "front_knee_extension_rel": 1.4,
    "trunk_stability_v2": 0.8,
    "release_extension_v2": 1.8,
    "swivel_stabilize": 1.1,
}

_FRONT_WEIGHTS: dict[str, float] = {
    **_COMMON_WEIGHTS,
    "stack_track": 1.0,
    "torque_retention": 1.0,
}


def _efficiency_weight(metric_name: str, view_mode: str) -> float:
    if view_mode == "front":
        return _FRONT_WEIGHTS.get(metric_name, 1.0)
    return _OPEN_SIDE_WEIGHTS.get(metric_name, 1.0)


def _compute_efficiency_score(
    metrics: list[BenchmarkResult],
    view_mode: str,
) -> Optional[float]:
    score, _ = _compute_efficiency_details(metrics, view_mode)
    return score


def _compute_efficiency_details(
    metrics: list[BenchmarkResult],
    view_mode: str,
) -> tuple[Optional[float], bool]:
    """
    Weighted, confidence-aware efficiency score in [0,10].

    Uses only metrics with status == "ok" and score available.
    """
    weighted_sum = 0.0
    weight_total = 0.0
    eligible_count = 0
    allowed = set(official_metric_names(view_mode))

    for m in metrics:
        if m.name not in allowed:
            continue
        if m.status != "ok" or m.score is None:
            continue
        weight = _efficiency_weight(m.name, view_mode)
        conf_raw = _clamp01(m.confidence if m.confidence is not None else 1.0)
        if view_mode == "open_side" and conf_raw < 0.35:
            continue
        conf = max(0.25, conf_raw)
        eff_weight = weight * conf
        if eff_weight <= 0.0:
            continue
        eligible_count += 1
        weighted_sum += float(m.score) * eff_weight
        weight_total += eff_weight

    if weight_total <= 1e-9:
        return None, True

    score = weighted_sum / weight_total
    score = max(0.0, min(10.0, score))
    if view_mode == "open_side":
        low_confidence = eligible_count < 4
    else:
        low_confidence = weight_total < 0.5
    return round(score, 2), low_confidence


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def compute_benchmarks(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str = "R",
    view_mode: str = "open_side",
) -> BenchmarkReport:
    """
    Compute all 7 mechanical benchmarks from poses + phases.

    Args:
        poses:     Full pose sequence (one PoseResult per frame).
        phases:    Detected pitch phases (from detect_phases or loaded from JSON).
        hand:      Pitcher throwing hand — "R" (default) or "L".
        view_mode: "open_side" (default) or "front".
                   open_side: replaces Stack & Track with Trunk Stability v2,
                   and uses Open-Side Pro v2 official metrics for efficiency.
                   front: uses original Stack & Track and Torque Retention.

    Returns:
        BenchmarkReport with all 7 metrics and efficiency_score.
        Any metric with missing data has status="insufficient_data" and score=None.
        Metrics with status="requires_front_view" have score=None and are
        excluded from the efficiency average.
    """
    if not poses:
        empty = BenchmarkResult.insufficient
        report = BenchmarkReport(
            timing=           empty("timing",           "No pose data"),
            balance=          empty("balance",          "No pose data"),
            posture=          empty("posture",          "No pose data"),
            lift_thrust=      empty("lift_thrust",      "No pose data"),
            swivel_stabilize= empty("swivel_stabilize", "No pose data"),
            stack_track=      empty(
                "trunk_stability_v2" if view_mode == "open_side" else "stack_track",
                "No pose data",
            ),
            torque_retention= empty("torque_retention", "No pose data"),
            hand=hand,
            view_mode=view_mode,
        )
        return report

    b1 = _compute_timing(phases)
    b2 = _compute_balance(poses, phases)
    b3 = _compute_posture(poses, phases)
    b4 = _compute_lift_thrust(poses, phases, hand)
    b5 = _compute_swivel_stabilize(poses, phases, hand)
    extras: list[BenchmarkResult] = [
        _compute_drift_forward(poses, phases),
        _compute_front_knee_flexion_fs(poses, phases, hand),
        _compute_front_knee_extension_rel(poses, phases, hand),
        _compute_release_extension_v2(poses, phases, hand),
        _compute_trunk_stability(poses, phases),  # legacy debug metric
        _compute_tilt_consistency_release(poses, phases),
        _compute_release_extension_proxy(poses, phases, hand),  # legacy debug metric
    ]

    if view_mode == "open_side":
        b6 = _compute_trunk_stability_v2(poses, phases)
        b7 = BenchmarkResult.requires_front_view(
            "torque_retention",
            "Not measurable from this view (open_side). Requires front view.",
        )
    else:
        b6 = _compute_stack_track(poses, phases)
        b7 = _compute_torque_retention(poses, phases)

    report = BenchmarkReport(
        timing=b1, balance=b2, posture=b3,
        lift_thrust=b4, swivel_stabilize=b5,
        stack_track=b6, torque_retention=b7,
        hand=hand,
        view_mode=view_mode,
        extra_metrics=extras,
    )

    eff, low_conf = _compute_efficiency_details(report.all_metrics(), report.view_mode)
    report.efficiency_score = eff
    report.efficiency_low_confidence = low_conf

    return report
