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

from .confidence import (
    CONF_BLIND,
    CONF_FULL,
    CONFIDENCE_REASONS,
    ConfidenceReport,
    apply_confidence_to_score,
    clamp01,
    combine_conf,
    conf_from_jitter,
    conf_from_motion,
    conf_from_visibility,
    conf_from_window,
    finalize_metric,
)
from .pose import PoseResult, KP
from .phases import PitchPhases, Phase
from .utils import smooth_series, smoothing_residual_std, window_clean


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
    return clamp01(v)


def _add_reason(reasons: list[str], reason: str) -> None:
    if reason not in CONFIDENCE_REASONS:
        return
    if reason not in reasons:
        reasons.append(reason)


def _confidence_scaled_factor(conf: float) -> float:
    return _clamp01((float(conf) - CONF_BLIND) / max(1e-6, CONF_FULL - CONF_BLIND))


def window_frames(center: int, radius: int, n_frames: int) -> list[int]:
    """Return clamped frame indices around a center index."""
    if n_frames <= 0:
        return []
    lo = max(0, int(center) - int(radius))
    hi = min(n_frames - 1, int(center) + int(radius))
    if hi < lo:
        return []
    return list(range(lo, hi + 1))


@dataclasses.dataclass
class MetricComponent:
    value_raw: Optional[float]
    score_raw: Optional[float]
    conf: float
    reasons: list[str] = dataclasses.field(default_factory=list)

    @property
    def valid(self) -> bool:
        return self.score_raw is not None and self.conf >= CONF_BLIND


def _aggregate_components(
    components: dict[str, MetricComponent],
    weights: dict[str, float],
    min_valid_components: int = 2,
) -> tuple[Optional[float], Optional[float], list[str], list[str]]:
    """
    Aggregate component score/conf with shared weights and blind re-normalisation.

    Returns:
      score_raw, conf, reasons, used_component_names
    """
    valid_names = [
        name
        for name, comp in components.items()
        if comp.valid and weights.get(name, 0.0) > 0.0
    ]
    if len(valid_names) < min_valid_components:
        reasons: list[str] = []
        for comp in components.values():
            for reason in comp.reasons:
                _add_reason(reasons, reason)
        if not reasons:
            reasons = ["missing_landmarks"]
        return None, None, reasons, []

    weight_sum = sum(weights[name] for name in valid_names)
    if weight_sum <= 1e-9:
        return None, None, ["missing_landmarks"], []

    score_raw = sum(float(components[name].score_raw) * weights[name] for name in valid_names) / weight_sum
    combined = combine_conf(
        *[
            ConfidenceReport(
                conf=float(components[name].conf),
                reasons=list(components[name].reasons),
                components={name: float(components[name].conf)},
            )
            for name in valid_names
        ],
        weights=[weights[name] for name in valid_names],
        mode="harmonic",
    )
    conf = combined.conf

    reasons: list[str] = list(combined.reasons)
    for name, comp in components.items():
        if name in valid_names:
            continue
        for reason in comp.reasons:
            _add_reason(reasons, reason)
    if conf < CONF_FULL and not reasons:
        # Only flag phase_uncertain when phase detection is genuinely weak.
        # Low confidence from visibility/jitter alone is already captured
        # by the component reasons — don't add a misleading blanket flag.
        pass

    return float(score_raw), float(conf), reasons, valid_names


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


def _series_quality(
    values: list[float | None],
    expected_frames: int,
    jitter_scale: float,
) -> tuple[float, float]:
    """
    Return (coverage, jitter_penalty) for a 1D series.

    coverage      = valid_frames / expected_frames
    jitter_penalty = MAD(derivative) normalised by jitter_scale
    """
    if expected_frames <= 0:
        expected_frames = max(1, len(values))
    arr = np.asarray(
        [np.nan if (v is None or (isinstance(v, float) and np.isnan(v))) else float(v) for v in values],
        dtype=np.float64,
    )
    valid = arr[~np.isnan(arr)]
    coverage = _clamp01(len(valid) / float(max(1, expected_frames)))

    if len(valid) < 3 or jitter_scale <= 1e-9:
        return coverage, 0.5

    deriv = np.diff(valid)
    med = float(np.median(deriv))
    mad = float(np.median(np.abs(deriv - med)))
    jitter_penalty = _clamp01(mad / jitter_scale)
    return coverage, jitter_penalty


def _metric_confidence(
    coverage: float,
    jitter_penalty: float,
    visibility: float,
) -> float:
    """
    Open-side metric confidence model.

    Jitter has a floor of 0.10 so it can never single-handedly zero out
    confidence — only missing landmarks or coverage gaps can do that.
    """
    cov_report = ConfidenceReport(conf=conf_from_window(_clamp01(coverage), 1.0))
    jit_report = ConfidenceReport(conf=conf_from_jitter(_clamp01(jitter_penalty), 1.0, floor=0.10))
    vis_report = ConfidenceReport(conf=conf_from_visibility(_clamp01(visibility)))
    return combine_conf(cov_report, jit_report, vis_report, mode="harmonic").conf


def _metric_reasons_from_quality(
    coverage: float,
    visibility: float,
    jitter_penalty: float,
    jump_penalty: float = 0.0,
    phase_conf: Optional[float] = None,
    low_motion: bool = False,
) -> list[str]:
    reasons: list[str] = []
    if coverage < 0.6:
        _add_reason(reasons, "window_too_small")
    if visibility < 0.5:
        _add_reason(reasons, "occluded")
    if visibility < 0.3:
        _add_reason(reasons, "missing_landmarks")
    if jitter_penalty > 0.55:
        _add_reason(reasons, "high_jitter")
    if jump_penalty > 0.35:
        _add_reason(reasons, "outlier_jump")
    if phase_conf is not None and phase_conf < 0.50:
        _add_reason(reasons, "phase_uncertain")
    if low_motion:
        _add_reason(reasons, "low_motion")
    return reasons


def _finalize_confidence_scored_metric(
    *,
    name: str,
    raw_value: Optional[float],
    unit: str,
    score_raw: Optional[float],
    conf: Optional[float],
    sub_values: dict,
    note: str,
    reasons: Optional[list[str]] = None,
    pass_threshold: float = 6.0,
    blind_reason: str = "Insufficient reliable signal",
) -> BenchmarkResult:
    reasons = list(reasons or [])
    conf = None if conf is None else _clamp01(conf)
    conf_report = ConfidenceReport(conf=conf or 0.0, reasons=reasons)
    fin = finalize_metric(score_raw=score_raw, conf_report=conf_report, allow_soft_fail=True)
    if fin["status"] == "insufficient_data":
        if not fin["reasons"]:
            fin["reasons"] = ["missing_landmarks"]
        result = BenchmarkResult.insufficient(name, blind_reason)
        result.confidence = fin["confidence"]
        result.score_raw = fin["score_raw"]
        result.score_eff = fin["score_eff"]
        result.reasons = fin["reasons"]
        result.sub_values = {**sub_values, "confidence_reasons": fin["reasons"]}
        return result

    score_raw = float(fin["score_raw"]) if fin["score_raw"] is not None else None
    score_eff = float(fin["score_eff"]) if fin["score_eff"] is not None else None
    result = BenchmarkResult(
        name=name,
        status=fin["status"],
        raw_value=raw_value,
        unit=unit,
        score=score_eff,
        pass_fail=(score_eff is not None and score_eff >= pass_threshold),
        sub_values={**sub_values, "confidence_reasons": fin["reasons"]},
        note=note,
        confidence=fin["confidence"],
        score_raw=score_raw,
        score_eff=score_eff,
        reasons=fin["reasons"],
    )
    return result


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
    if not poses:
        return []
    by_frame = {p.frame_idx: p for p in poses}
    n_frames = max(by_frame.keys()) + 1
    idxs = window_frames(phase.frame_idx, max(before, after), n_frames)
    lo = phase.frame_idx - before
    hi = phase.frame_idx + after
    return [by_frame[i] for i in idxs if lo <= i <= hi and i in by_frame]


def _phase_window(
    poses: list[PoseResult],
    phase: Optional[Phase],
    radius: int = 2,
) -> list[PoseResult]:
    """Symmetric phase window. Default radius=2 => 5-frame target window."""
    return _poses_around_phase(poses, phase, before=radius, after=radius)


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
    score_raw: Optional[float] = None
    score_eff: Optional[float] = None
    reasons: list[str] = dataclasses.field(default_factory=list)

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

        out = {
            "name":       self.name,
            "status":     self.status,
            "raw_value":  _r(self.raw_value),
            "unit":       self.unit,
            "score":      round(self.score, 2) if self.score is not None else None,
            "pass_fail":  self.pass_fail,
            "sub_values": {k: _r(v) for k, v in self.sub_values.items()},
            "note":       self.note,
        }
        if self.score_raw is not None:
            out["score_raw"] = round(self.score_raw, 2)
        if self.score_eff is not None:
            out["score_eff"] = round(self.score_eff, 2)
        if self.reasons:
            out["reasons"] = list(self.reasons)
        return out


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
    score_raw = piecewise_timing_score(t)
    phase_vis = _phase_confidence([phases.set_pos, phases.foot_strike])
    conf = _metric_confidence(1.0, 0.0, phase_vis)
    reasons = _metric_reasons_from_quality(
        coverage=1.0,
        visibility=phase_vis,
        jitter_penalty=0.0,
        phase_conf=phase_vis,
    ) if conf < CONF_FULL else []
    return _finalize_confidence_scored_metric(
        name=name,
        raw_value=t,
        unit="s",
        score_raw=score_raw,
        conf=conf,
        sub_values={
            "t_set_s": round(phases.set_pos.time_s, 3),
            "t_foot_strike_s": round(phases.foot_strike.time_s, 3),
        },
        note="SET → FOOT STRIKE elapsed time. Lower = faster delivery.",
        reasons=reasons,
        blind_reason="Timing confidence below blind threshold",
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
    score_raw = 10.0 if inside else 3.0

    rel_win = _poses_around_phase(poses, phases.ball_release, before=3, after=2)
    if not rel_win:
        rel_win = [pose]
    glove_offsets: list[float] = []
    vis_vals: list[float] = []
    for wp in rel_win:
        g = _px_safe(wp, glove_kp)
        wls = _px_safe(wp, "LEFT_SHOULDER")
        wrs = _px_safe(wp, "RIGHT_SHOULDER")
        wlh = _px_safe(wp, "LEFT_HIP")
        wrh = _px_safe(wp, "RIGHT_HIP")
        if g is None or not all([wls, wrs, wlh, wrh]):
            glove_offsets.append(np.nan)
            continue
        wxs = [pt[0] for pt in [wls, wrs, wlh, wrh]]
        wmin = min(wxs)
        wmax = max(wxs)
        glove_offsets.append(0.0 if (wmin <= g[0] <= wmax) else min(abs(g[0] - wmin), abs(g[0] - wmax)))
        vis_vals.append(_visibility_confidence(wp, [glove_kp, "LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"]))

    # Clean glove offsets to remove single-frame spikes before computing quality.
    cleaned_offsets = window_clean(glove_offsets, radius=len(glove_offsets), mad_k=3.0)
    cleaned_vals = [float(v) for v in cleaned_offsets.values if not np.isnan(v)]

    coverage, jitter_penalty = _series_quality(glove_offsets, expected_frames=len(rel_win), jitter_scale=14.0)
    # Require ≥2 consecutive jumps to trigger outlier_jump (single-frame spikes don't count).
    jump_penalty = _jump_penalty_consecutive(cleaned_vals, jump_scale=18.0, min_consecutive=2)
    if len(cleaned_vals) < 3:
        # Single-frame release clips cannot support robust jitter stats.
        jitter_penalty = min(jitter_penalty, 0.15)
        jump_penalty = 0.0
    visibility = float(np.mean(vis_vals)) if vis_vals else 0.0
    conf = _clamp01(
        _metric_confidence(coverage, max(jitter_penalty, jump_penalty), visibility)
        * _phase_confidence([phases.ball_release])
    )
    reasons = _metric_reasons_from_quality(
        coverage=coverage,
        visibility=visibility,
        jitter_penalty=jitter_penalty,
        jump_penalty=jump_penalty,
        phase_conf=_phase_confidence([phases.ball_release]),
    ) if conf < CONF_FULL else []

    return _finalize_confidence_scored_metric(
        name=name,
        raw_value=1.0 if inside else 0.0,
        unit="boolean",
        score_raw=score_raw,
        conf=conf,
        sub_values={
            "glove_x_px": round(glove[0], 1),
            "torso_min_x_px": round(torso_min, 1),
            "torso_max_x_px": round(torso_max, 1),
            "inside": inside,
        },
        note=f"Glove ({glove_kp}) x-position inside torso x-bounds at release.",
        reasons=reasons,
        blind_reason="Glove containment signal is blind at release",
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
    jitter_penalty = _clamp01(max(fs_mad, rel_mad) / 4.5)
    conf = _clamp01(
        _metric_confidence(coverage_conf, jitter_penalty, vis_conf)
        * _phase_confidence([phases.foot_strike, phases.ball_release])
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


def _knee_angle_abs_deg(
    pose: PoseResult,
    hip_kp: str,
    knee_kp: str,
    ankle_kp: str,
) -> Optional[float]:
    """
    Return absolute knee angle (0..180), where larger is firmer/straighter.

    This is derived from flexion to keep angle conventions consistent across
    the pipeline.
    """
    flex = _knee_flexion_deg(pose, hip_kp, knee_kp, ankle_kp)
    if flex is None:
        return None
    return max(0.0, min(180.0, 180.0 - float(flex)))


def _score_block_knee_firmness_abs(knee_angle_abs_rel: float) -> float:
    """Absolute lead-knee firmness at release."""
    if knee_angle_abs_rel >= 155.0:
        return 10.0
    if knee_angle_abs_rel >= 145.0:
        return linear_score(knee_angle_abs_rel, 145.0, 155.0, 6.0, 10.0)
    if knee_angle_abs_rel >= 135.0:
        return linear_score(knee_angle_abs_rel, 135.0, 145.0, 0.0, 6.0)
    return 0.0


def _score_block_shin_verticality(shin_tilt_deg: float) -> float:
    """Shin angle vs vertical at release."""
    if shin_tilt_deg <= 10.0:
        return 10.0
    if shin_tilt_deg <= 20.0:
        return linear_score(shin_tilt_deg, 10.0, 20.0, 10.0, 6.0)
    if shin_tilt_deg <= 30.0:
        return linear_score(shin_tilt_deg, 20.0, 30.0, 6.0, 0.0)
    return 0.0


def _score_block_hip_over_heel(hip_over_heel_norm: float) -> float:
    """Lead-hip alignment over lead heel at release."""
    v = abs(float(hip_over_heel_norm))
    if v <= 0.10:
        return 10.0
    if v <= 0.20:
        return linear_score(v, 0.10, 0.20, 10.0, 6.0)
    if v <= 0.30:
        return linear_score(v, 0.20, 0.30, 6.0, 0.0)
    return 0.0


def _score_block_low_forward_leak(forward_leak_norm: float) -> float:
    """Post-FS forward COM leak proxy (lower is better)."""
    v = abs(float(forward_leak_norm))
    if v <= 0.10:
        return 10.0
    if v <= 0.20:
        return linear_score(v, 0.10, 0.20, 10.0, 6.0)
    if v <= 0.30:
        return linear_score(v, 0.20, 0.30, 6.0, 0.0)
    return 0.0


def _score_block_extension_delta_bonus(knee_extension_delta_deg: float) -> float:
    """
    Secondary extension bonus.

    Neutral around 0..5°, rewards 5..20°, penalises strong negative collapse.
    """
    d = float(knee_extension_delta_deg)
    if d <= -12.0:
        return 0.0
    if d <= -5.0:
        return linear_score(d, -12.0, -5.0, 0.0, 3.0)
    if d < 5.0:
        return 5.0
    if d <= 20.0:
        return linear_score(d, 5.0, 20.0, 6.0, 10.0)
    if d <= 30.0:
        return linear_score(d, 20.0, 30.0, 10.0, 8.0)
    return 8.0


def _jump_penalty(
    values: list[float],
    jump_scale: float,
) -> float:
    """
    Penalize unstable frame-to-frame jumps even when visibility is high.

    Returns 0..1 where larger means less trustworthy temporal behaviour.
    """
    if len(values) < 4:
        return 0.0
    arr = np.asarray(values, dtype=np.float64)
    arr = arr[~np.isnan(arr)]
    if arr.size < 4:
        return 0.0
    diffs = np.abs(np.diff(arr))
    if diffs.size == 0:
        return 0.0
    med = float(np.median(diffs))
    mad = float(np.median(np.abs(diffs - med)))
    thresh = max(float(jump_scale), med + 3.0 * mad)
    jump_ratio = float(np.count_nonzero(diffs > thresh) / diffs.size)
    return _clamp01(jump_ratio * 1.5)


def _jump_penalty_consecutive(
    values: list[float],
    jump_scale: float,
    min_consecutive: int = 2,
) -> float:
    """
    Like _jump_penalty but only counts jumps that persist for ≥min_consecutive frames.

    A single-frame spike that immediately returns to baseline is not penalized —
    only sustained instability triggers outlier_jump.
    """
    if len(values) < 4:
        return 0.0
    arr = np.asarray(values, dtype=np.float64)
    arr = arr[~np.isnan(arr)]
    if arr.size < 4:
        return 0.0
    diffs = np.abs(np.diff(arr))
    if diffs.size == 0:
        return 0.0
    med = float(np.median(diffs))
    mad = float(np.median(np.abs(diffs - med)))
    thresh = max(float(jump_scale), med + 3.0 * max(mad, med * 0.5, 1e-9))

    # Count runs of consecutive above-threshold jumps.
    above = diffs > thresh
    consecutive_count = 0
    run = 0
    for a in above:
        if a:
            run += 1
        else:
            if run >= min_consecutive:
                consecutive_count += run
            run = 0
    if run >= min_consecutive:
        consecutive_count += run

    if consecutive_count == 0:
        return 0.0
    return _clamp01(consecutive_count / diffs.size * 1.5)


def _component_confidence(
    values: list[float],
    expected_frames: int,
    jitter_scale: float,
    visibility_values: list[float],
    phase_conf: float,
    jump_scale: float | None = None,
) -> float:
    if len(values) < 2:
        return 0.0
    coverage, jitter_penalty = _series_quality(
        values,
        expected_frames=max(1, expected_frames),
        jitter_scale=max(1e-6, jitter_scale),
    )
    jump_penalty = _jump_penalty(values, jump_scale if jump_scale is not None else jitter_scale)
    jitter_penalty = _clamp01(max(jitter_penalty, jump_penalty))
    visibility = float(np.mean(visibility_values)) if visibility_values else 0.0
    return _clamp01(_metric_confidence(coverage, jitter_penalty, visibility) * phase_conf)


def _compute_forward_leak_proxy(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str,
) -> BenchmarkResult:
    """
    Informational only: hip-to-heel leak at release.
    """
    name = "forward_leak_proxy"
    rel_win = _poses_around_phase(poses, phases.ball_release, before=4, after=2)
    if not rel_win:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE window unavailable")

    lead = "LEFT" if hand == "R" else "RIGHT"
    leak_vals: list[float] = []
    vis_vals: list[float] = []

    for p in rel_win:
        hip = _px_safe(p, f"{lead}_HIP")
        knee = _px_safe(p, f"{lead}_KNEE")
        ankle = _px_safe(p, f"{lead}_ANKLE")
        if hip is None or knee is None or ankle is None:
            continue
        leg_len = math.dist(hip, knee) + math.dist(knee, ankle)
        if leg_len < 1e-6:
            continue
        leak_vals.append(abs(hip[0] - ankle[0]) / leg_len)
        vis_vals.append(_visibility_confidence(p, [f"{lead}_HIP", f"{lead}_KNEE", f"{lead}_ANKLE"]))

    if len(leak_vals) < 2:
        return BenchmarkResult.insufficient(name, "Insufficient lead-leg visibility at release")

    leak_med = float(np.median(np.asarray(leak_vals, dtype=np.float64)))
    coverage, jitter_penalty = _series_quality(leak_vals, expected_frames=len(rel_win), jitter_scale=0.06)
    visibility = float(np.mean(vis_vals)) if vis_vals else 0.0
    conf = _clamp01(
        _metric_confidence(coverage, jitter_penalty, visibility)
        * _phase_confidence([phases.ball_release])
    )

    return BenchmarkResult(
        name=name,
        status="ok",
        raw_value=leak_med,
        unit="norm",
        score=None,
        pass_fail=None,
        sub_values={
            "hip_over_ankle_norm": round(leak_med, 3),
            "coverage": round(coverage, 3),
            "jitter_penalty": round(jitter_penalty, 3),
        },
        note="Informational only: lead-hip x relative to lead-ankle x at release.",
        confidence=conf,
    )


def _robust_threshold(values: list[float], k: float = 2.5) -> tuple[float, float, float]:
    """Return (median, mad, threshold=median+k*mad) for finite values."""
    arr = np.asarray(values, dtype=np.float64)
    arr = arr[~np.isnan(arr)]
    if arr.size == 0:
        return 0.0, 0.0, 0.0
    med = float(np.median(arr))
    mad = float(np.median(np.abs(arr - med)))
    return med, mad, float(med + k * mad)


def _first_sustained_above(
    values: list[float],
    frame_indices: list[int],
    threshold: float,
    min_consecutive: int = 3,
) -> Optional[int]:
    """
    First frame index where values stay above threshold for N consecutive frames.
    """
    run = 0
    first_idx = None
    for v, fi in zip(values, frame_indices):
        if np.isnan(v):
            run = 0
            first_idx = None
            continue
        if float(v) > threshold:
            if run == 0:
                first_idx = fi
            run += 1
            if run >= min_consecutive and first_idx is not None:
                return int(first_idx)
        else:
            run = 0
            first_idx = None
    return None


def _compute_lead_leg_block_v3(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str,
) -> BenchmarkResult:
    """
    Open-side lead leg block v3.

    Coach-first read: did the lead leg post through release, or leak/collapse?
    """
    name = "lead_leg_block_v3"
    if phases.foot_strike is None or phases.ball_release is None:
        return BenchmarkResult.insufficient(name, "FOOT_STRIKE/BALL_RELEASE phase not detected")

    lead = "LEFT" if hand == "R" else "RIGHT"
    lead_hip = f"{lead}_HIP"
    lead_knee = f"{lead}_KNEE"
    lead_ankle = f"{lead}_ANKLE"

    # Adaptive window: default radius=3 (7 frames), widen REL to 4 when
    # FS and REL are close together (≤4 frames apart).
    fs_radius = 3
    rel_radius = 3
    if abs(phases.ball_release.frame_idx - phases.foot_strike.frame_idx) <= 4:
        rel_radius = 4
    fs_win = _phase_window(poses, phases.foot_strike, radius=fs_radius)
    rel_win = _phase_window(poses, phases.ball_release, radius=rel_radius)
    if len(fs_win) < 2 or len(rel_win) < 2:  # Relaxed from 3 to 2
        result = BenchmarkResult.insufficient(name, "FS/REL windows too small")
        result.confidence = 0.0
        result.reasons = ["window_too_small"]
        return result

    fs_knee_abs: list[float] = []
    rel_knee_abs: list[float] = []
    rel_shin_vertical: list[float] = []
    rel_hip_over_heel: list[float] = []
    fs_mid_hip_x: list[float] = []
    rel_mid_hip_x: list[float] = []
    leg_norm: list[float] = []
    leg_vis_fs: list[float] = []
    leg_vis_rel: list[float] = []
    hip_vis_fs: list[float] = []
    hip_vis_rel: list[float] = []

    for p in fs_win:
        hip = _px_safe(p, lead_hip)
        knee = _px_safe(p, lead_knee)
        ankle = _px_safe(p, lead_ankle)
        if hip is not None and knee is not None and ankle is not None:
            knee_abs = _knee_angle_abs_deg(p, lead_hip, lead_knee, lead_ankle)
            if knee_abs is not None:
                fs_knee_abs.append(float(knee_abs))
            leg_len = math.dist(hip, knee) + math.dist(knee, ankle)
            if leg_len > 1e-6:
                leg_norm.append(float(leg_len))
            leg_vis_fs.append(_visibility_confidence(p, [lead_hip, lead_knee, lead_ankle]))

        lh = _px_vis_safe(p, "LEFT_HIP")
        rh = _px_vis_safe(p, "RIGHT_HIP")
        mid_hip = _weighted_midpoint(lh, rh)
        if mid_hip is not None:
            fs_mid_hip_x.append(float(mid_hip[0]))
            hip_vis_fs.append(_visibility_confidence(p, ["LEFT_HIP", "RIGHT_HIP"]))

    for p in rel_win:
        hip = _px_safe(p, lead_hip)
        knee = _px_safe(p, lead_knee)
        ankle = _px_safe(p, lead_ankle)
        if hip is not None and knee is not None and ankle is not None:
            knee_abs = _knee_angle_abs_deg(p, lead_hip, lead_knee, lead_ankle)
            if knee_abs is not None:
                rel_knee_abs.append(float(knee_abs))
            shin_vec = (knee[0] - ankle[0], knee[1] - ankle[1])
            rel_shin_vertical.append(float(angle_from_vertical_deg(shin_vec[0], shin_vec[1])))
            leg_len = math.dist(hip, knee) + math.dist(knee, ankle)
            if leg_len > 1e-6:
                leg_norm.append(float(leg_len))
                rel_hip_over_heel.append(abs(hip[0] - ankle[0]) / leg_len)
            leg_vis_rel.append(_visibility_confidence(p, [lead_hip, lead_knee, lead_ankle]))

        lh = _px_vis_safe(p, "LEFT_HIP")
        rh = _px_vis_safe(p, "RIGHT_HIP")
        mid_hip = _weighted_midpoint(lh, rh)
        if mid_hip is not None:
            rel_mid_hip_x.append(float(mid_hip[0]))
            hip_vis_rel.append(_visibility_confidence(p, ["LEFT_HIP", "RIGHT_HIP"]))

    norm_len = float(np.median(np.asarray(leg_norm, dtype=np.float64))) if leg_norm else None
    if norm_len is None or norm_len <= 1e-6:
        result = BenchmarkResult.insufficient(name, "Cannot estimate lead-leg length proxy")
        result.confidence = 0.0
        result.reasons = ["missing_landmarks"]
        return result

    knee_angle_fs = float(np.median(np.asarray(fs_knee_abs, dtype=np.float64))) if fs_knee_abs else None
    knee_angle_rel = float(np.median(np.asarray(rel_knee_abs, dtype=np.float64))) if rel_knee_abs else None
    knee_extension_change = (
        float(knee_angle_rel - knee_angle_fs)
        if knee_angle_fs is not None and knee_angle_rel is not None
        else None
    )
    shin_vertical_rel = (
        float(np.median(np.asarray(rel_shin_vertical, dtype=np.float64)))
        if rel_shin_vertical
        else None
    )
    hip_over_heel_rel = (
        float(np.median(np.asarray(rel_hip_over_heel, dtype=np.float64)))
        if rel_hip_over_heel
        else None
    )
    forward_leak = (
        abs(float(np.median(np.asarray(rel_mid_hip_x, dtype=np.float64))) - float(np.median(np.asarray(fs_mid_hip_x, dtype=np.float64)))) / norm_len
        if fs_mid_hip_x and rel_mid_hip_x
        else None
    )

    phase_conf_fs = _phase_confidence([phases.foot_strike])
    phase_conf_rel = _phase_confidence([phases.ball_release])
    phase_conf_pair = _phase_confidence([phases.foot_strike, phases.ball_release])
    components: dict[str, MetricComponent] = {}
    comp_weights = {
        "knee_firmness": 0.40,
        "shin_verticality": 0.25,
        "hip_over_heel": 0.20,
        "forward_leak": 0.15,
    }

    # Knee firmness: absolute REL firmness + a small extension bonus.
    # Apply window_clean to remove spike frames before computing medians.
    if rel_knee_abs:
        cleaned_knee = window_clean(rel_knee_abs, radius=len(rel_knee_abs), mad_k=3.0)
        clean_knee_vals = cleaned_knee.values[~np.isnan(cleaned_knee.values)]
        if len(clean_knee_vals) >= 1:
            knee_angle_rel = float(np.median(clean_knee_vals))
    if knee_angle_rel is not None:
        ext_bonus = _score_block_extension_delta_bonus(knee_extension_change or 0.0) if knee_extension_change is not None else 5.0
        knee_score = 0.8 * _score_block_knee_firmness_abs(knee_angle_rel) + 0.2 * ext_bonus
        cleaned_knee_result = window_clean(rel_knee_abs, radius=len(rel_knee_abs), mad_k=3.0)
        coverage = _clamp01(cleaned_knee_result.kept_count / max(1, len(rel_win)))
        visibility = float(np.mean(leg_vis_rel)) if leg_vis_rel else 0.0
        conf = _clamp01(
            _metric_confidence(coverage, cleaned_knee_result.jitter_score, visibility) * phase_conf_rel
        )
        reasons = _metric_reasons_from_quality(
            coverage=coverage,
            visibility=visibility,
            jitter_penalty=cleaned_knee_result.jitter_score,
            phase_conf=phase_conf_rel,
        )
        components["knee_firmness"] = MetricComponent(
            value_raw=knee_angle_rel,
            score_raw=knee_score,
            conf=conf,
            reasons=reasons,
        )
    else:
        components["knee_firmness"] = MetricComponent(None, None, 0.0, ["missing_landmarks"])

    if rel_shin_vertical:
        cleaned_shin = window_clean(rel_shin_vertical, radius=len(rel_shin_vertical), mad_k=3.0)
        clean_shin_vals = cleaned_shin.values[~np.isnan(cleaned_shin.values)]
        if len(clean_shin_vals) >= 1:
            shin_vertical_rel = float(np.median(clean_shin_vals))
    if shin_vertical_rel is not None:
        cleaned_shin_result = window_clean(rel_shin_vertical, radius=len(rel_shin_vertical), mad_k=3.0)
        coverage = _clamp01(cleaned_shin_result.kept_count / max(1, len(rel_win)))
        visibility = float(np.mean(leg_vis_rel)) if leg_vis_rel else 0.0
        conf = _clamp01(
            _metric_confidence(coverage, cleaned_shin_result.jitter_score, visibility) * phase_conf_rel
        )
        reasons = _metric_reasons_from_quality(
            coverage=coverage,
            visibility=visibility,
            jitter_penalty=cleaned_shin_result.jitter_score,
            phase_conf=phase_conf_rel,
        )
        components["shin_verticality"] = MetricComponent(
            value_raw=shin_vertical_rel,
            score_raw=_score_block_shin_verticality(shin_vertical_rel),
            conf=conf,
            reasons=reasons,
        )
    else:
        components["shin_verticality"] = MetricComponent(None, None, 0.0, ["missing_landmarks"])

    if rel_hip_over_heel:
        cleaned_hoh = window_clean(rel_hip_over_heel, radius=len(rel_hip_over_heel), mad_k=3.0)
        clean_hoh_vals = cleaned_hoh.values[~np.isnan(cleaned_hoh.values)]
        if len(clean_hoh_vals) >= 1:
            hip_over_heel_rel = float(np.median(clean_hoh_vals))
    if hip_over_heel_rel is not None:
        cleaned_hoh_result = window_clean(rel_hip_over_heel, radius=len(rel_hip_over_heel), mad_k=3.0)
        coverage = _clamp01(cleaned_hoh_result.kept_count / max(1, len(rel_win)))
        visibility = float(np.mean(leg_vis_rel)) if leg_vis_rel else 0.0
        conf = _clamp01(
            _metric_confidence(coverage, cleaned_hoh_result.jitter_score, visibility) * phase_conf_rel
        )
        reasons = _metric_reasons_from_quality(
            coverage=coverage,
            visibility=visibility,
            jitter_penalty=cleaned_hoh_result.jitter_score,
            phase_conf=phase_conf_rel,
        )
        components["hip_over_heel"] = MetricComponent(
            value_raw=hip_over_heel_rel,
            score_raw=_score_block_hip_over_heel(hip_over_heel_rel),
            conf=conf,
            reasons=reasons,
        )
    else:
        components["hip_over_heel"] = MetricComponent(None, None, 0.0, ["missing_landmarks"])

    if forward_leak is not None:
        forward_series = fs_mid_hip_x + rel_mid_hip_x
        cleaned_fwd = window_clean(forward_series, radius=len(forward_series), mad_k=3.0)
        coverage = _clamp01(cleaned_fwd.kept_count / max(1, len(fs_win) + len(rel_win)))
        visibility = float(np.mean(hip_vis_fs + hip_vis_rel)) if (hip_vis_fs or hip_vis_rel) else 0.0
        conf = _clamp01(
            _metric_confidence(coverage, cleaned_fwd.jitter_score, visibility) * phase_conf_pair
        )
        reasons = _metric_reasons_from_quality(
            coverage=coverage,
            visibility=visibility,
            jitter_penalty=cleaned_fwd.jitter_score,
            phase_conf=phase_conf_pair,
        )
        components["forward_leak"] = MetricComponent(
            value_raw=forward_leak,
            score_raw=_score_block_low_forward_leak(forward_leak),
            conf=conf,
            reasons=reasons,
        )
    else:
        components["forward_leak"] = MetricComponent(None, None, 0.0, ["missing_landmarks"])

    # Accept even with 1 valid component (partial data is better than insufficient)
    score_raw, conf, reasons, used_components = _aggregate_components(components, comp_weights, min_valid_components=1)
    if score_raw is None or conf is None:
        result = BenchmarkResult.insufficient(name, "Lead-leg block cannot be estimated reliably")
        result.confidence = 0.0
        result.reasons = reasons
        return result

    collapse_penalty = 0.0
    if knee_extension_change is not None and knee_extension_change < -5.0:
        collapse_penalty += min(2.5, abs(knee_extension_change + 5.0) * 0.2)
    if forward_leak is not None and forward_leak > 0.22:
        collapse_penalty += min(2.0, (forward_leak - 0.22) * 12.0)
    score_raw = max(0.0, min(10.0, score_raw - collapse_penalty))

    visual_braced = bool(
        knee_angle_rel is not None
        and knee_angle_rel >= 155.0
        and shin_vertical_rel is not None
        and shin_vertical_rel <= 12.0
        and hip_over_heel_rel is not None
        and abs(hip_over_heel_rel) <= 0.12
        and forward_leak is not None
        and forward_leak <= 0.12
    )
    if visual_braced:
        score_raw = max(score_raw, 7.5)
        label = "BRACED"
    elif collapse_penalty >= 1.25:
        label = "COLLAPSE"
    elif forward_leak is not None and forward_leak > 0.22:
        label = "LEAK"
    else:
        label = "SOFT"

    explain = "Lead leg posted through release." if label == "BRACED" else "Lead leg leaked/collapsed through release."
    return _finalize_confidence_scored_metric(
        name=name,
        raw_value=score_raw,
        unit="score",
        score_raw=score_raw,
        conf=conf,
        sub_values={
            "label": label,
            "knee_extension_change_deg": round(knee_extension_change, 3) if knee_extension_change is not None else None,
            "knee_firmness_rel_deg": round(knee_angle_rel, 3) if knee_angle_rel is not None else None,
            "knee_firmness_fs_deg": round(knee_angle_fs, 3) if knee_angle_fs is not None else None,
            "shin_vertical_rel_deg": round(shin_vertical_rel, 3) if shin_vertical_rel is not None else None,
            "hip_over_heel_rel_norm": round(hip_over_heel_rel, 4) if hip_over_heel_rel is not None else None,
            "forward_leak_norm": round(forward_leak, 4) if forward_leak is not None else None,
            "collapse_penalty": round(collapse_penalty, 3),
            "visual_brace_override": visual_braced,
            "subcomponent_scores": {
                k: round(float(v.score_raw), 3) if v.score_raw is not None else None
                for k, v in components.items()
            },
            "subcomponent_confidence": {k: round(v.conf, 3) for k, v in components.items()},
            "subcomponents_used": used_components,
        },
        note=explain,
        reasons=reasons,
        blind_reason="Lead-leg block is blind in FS/REL windows",
    )


def _compute_hip_shoulder_sep_v3(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str,
) -> BenchmarkResult:
    """
    Open-side separation v3 proxy:
      - shoulder rotation burst timing
      - pelvis forward-burst timing
      - penalize early pelvis dump before shoulder rotation
    """
    name = "hip_shoulder_sep_v3"
    if phases.foot_strike is None or phases.ball_release is None:
        return BenchmarkResult.insufficient(name, "FOOT_STRIKE/BALL_RELEASE phase not detected")

    if phases.set_pos is not None:
        start_frame = phases.set_pos.frame_idx
    elif phases.peak_leg_lift is not None:
        start_frame = phases.peak_leg_lift.frame_idx
    else:
        start_frame = max(0, phases.foot_strike.frame_idx - 18)
    end_frame = phases.ball_release.frame_idx
    win = _poses_in_range(poses, min(start_frame, end_frame), max(start_frame, end_frame))
    if len(win) < 6:  # Relaxed from 8 to 6
        result = BenchmarkResult.insufficient(name, "Insufficient analysis window for separation proxy")
        result.confidence = 0.0
        result.reasons = ["window_too_small"]
        return result

    shoulder_angle_raw: list[float] = []
    pelvis_x_raw: list[float] = []
    vis_vals: list[float] = []
    frame_idx: list[int] = []

    for p in win:
        frame_idx.append(int(p.frame_idx))
        ls = _px_safe(p, "LEFT_SHOULDER")
        rs = _px_safe(p, "RIGHT_SHOULDER")
        lh = _px_safe(p, "LEFT_HIP")
        rh = _px_safe(p, "RIGHT_HIP")
        if ls is None or rs is None or lh is None or rh is None:
            shoulder_angle_raw.append(np.nan)
            pelvis_x_raw.append(np.nan)
            continue
        shoulder_angle_raw.append(float(math.degrees(math.atan2(rs[1] - ls[1], rs[0] - ls[0] + 1e-9))))
        back_hip = rh if hand == "R" else lh
        mid_hip_x = float((lh[0] + rh[0]) / 2.0)
        pelvis_x_raw.append(0.7 * float(back_hip[0]) + 0.3 * mid_hip_x)
        vis_vals.append(_visibility_confidence(p, ["LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"]))

    shoulder_arr = np.asarray(shoulder_angle_raw, dtype=np.float64)
    pelvis_arr = np.asarray(pelvis_x_raw, dtype=np.float64)
    valid_frames = int(np.count_nonzero(~np.isnan(shoulder_arr) & ~np.isnan(pelvis_arr)))
    if valid_frames < 4:  # Relaxed from 6 to 4
        result = BenchmarkResult.insufficient(name, "Insufficient shoulder/hip visibility coverage")
        result.confidence = 0.0
        result.reasons = ["missing_landmarks", "occluded"]
        return result

    shoulder_smooth = smooth_series(shoulder_angle_raw, window=7, polyorder=2)
    pelvis_smooth = smooth_series(pelvis_x_raw, window=7, polyorder=2)

    shoulder_unwrap = np.asarray(shoulder_smooth, dtype=np.float64)
    valid_sh = ~np.isnan(shoulder_unwrap)
    if np.count_nonzero(valid_sh) >= 2:
        shoulder_unwrap[valid_sh] = np.rad2deg(np.unwrap(np.deg2rad(shoulder_unwrap[valid_sh])))

    set_pose = _pose_nearest(poses, phases.set_pos) or win[0]
    body_height = _body_height_proxy_px(set_pose, fallback_height=float(set_pose.height) * 0.55)
    if body_height is None or body_height < 1e-6:
        result = BenchmarkResult.insufficient(name, "Cannot estimate body-height proxy")
        result.confidence = 0.0
        result.reasons = ["missing_landmarks"]
        return result

    vel_frames: list[int] = []
    shoulder_vel: list[float] = []
    pelvis_vel: list[float] = []
    for i in range(1, len(frame_idx)):
        dt_frames = frame_idx[i] - frame_idx[i - 1]
        if dt_frames <= 0:
            continue
        sh0 = shoulder_unwrap[i - 1]
        sh1 = shoulder_unwrap[i]
        px0 = pelvis_smooth[i - 1]
        px1 = pelvis_smooth[i]
        if np.isnan(sh0) or np.isnan(sh1) or np.isnan(px0) or np.isnan(px1):
            continue
        vel_frames.append(frame_idx[i])
        shoulder_vel.append(abs(float((sh1 - sh0) * phases.fps / dt_frames)))
        pelvis_vel.append(abs(float(((px1 - px0) * phases.fps / dt_frames) / body_height)))

    if len(vel_frames) < 3:  # Relaxed from 5 to 3
        result = BenchmarkResult.insufficient(name, "Insufficient velocity samples for separation proxy")
        result.confidence = 0.0
        result.reasons = ["window_too_small", "missing_landmarks"]
        return result

    sh_med, sh_mad, sh_thr = _robust_threshold(shoulder_vel, k=2.3)
    pe_med, pe_mad, pe_thr = _robust_threshold(pelvis_vel, k=2.3)
    shoulder_peak_vel = float(max(shoulder_vel))
    pelvis_peak_vel = float(max(pelvis_vel))
    low_motion = pelvis_peak_vel < 0.05

    shoulder_burst_frame = _first_sustained_above(
        shoulder_vel,
        vel_frames,
        max(sh_thr, 8.0),
        min_consecutive=2,
    )
    pelvis_burst_frame = _first_sustained_above(
        pelvis_vel,
        vel_frames,
        max(pe_thr, 0.04),
        min_consecutive=2,
    )

    if shoulder_burst_frame is None:
        shoulder_burst_frame = int(vel_frames[int(np.argmax(np.asarray(shoulder_vel, dtype=np.float64)))])
    if low_motion:
        pelvis_burst_frame = end_frame
    elif pelvis_burst_frame is None:
        pelvis_burst_frame = int(vel_frames[int(np.argmax(np.asarray(pelvis_vel, dtype=np.float64)))])

    lag_s = (pelvis_burst_frame - shoulder_burst_frame) / max(phases.fps, 1e-6)
    vel_ratio = shoulder_peak_vel / max(pelvis_peak_vel, 0.05)

    if lag_s >= 0.04:
        lag_score = 10.0
    elif lag_s >= 0.01:
        lag_score = linear_score(lag_s, 0.01, 0.04, 7.0, 10.0)
    elif lag_s >= -0.01:
        lag_score = linear_score(lag_s, -0.01, 0.01, 5.0, 7.0)
    elif lag_s >= -0.05:
        lag_score = linear_score(lag_s, -0.05, -0.01, 0.0, 5.0)
    else:
        lag_score = 0.0

    if vel_ratio >= 1.8:
        ratio_score = 10.0
    elif vel_ratio >= 1.1:
        ratio_score = linear_score(vel_ratio, 1.1, 1.8, 4.0, 10.0)
    elif vel_ratio >= 0.8:
        ratio_score = linear_score(vel_ratio, 0.8, 1.1, 0.0, 4.0)
    else:
        ratio_score = 0.0

    collapse_before_rotate = False
    for f, pv, sv in zip(vel_frames, pelvis_vel, shoulder_vel):
        if f >= shoulder_burst_frame:
            break
        if pv > max(0.05, pe_thr) and sv < max(4.0, sh_thr * 0.45):
            collapse_before_rotate = True
            break
    if low_motion:
        collapse_before_rotate = False

    early_pelvis = lag_s < -0.02
    collapse_score = 2.0 if (early_pelvis or collapse_before_rotate) else 10.0
    pelvis_activity_score = 6.0 if low_motion else 10.0

    phase_conf = _phase_confidence([phases.set_pos, phases.peak_leg_lift, phases.foot_strike, phases.ball_release])
    cov_sh, jit_sh = _series_quality(shoulder_angle_raw, expected_frames=len(win), jitter_scale=7.0)
    cov_pe, jit_pe = _series_quality(pelvis_x_raw, expected_frames=len(win), jitter_scale=body_height * 0.02)
    jump_sh = _jump_penalty(shoulder_vel, jump_scale=35.0)
    jump_pe = _jump_penalty(pelvis_vel, jump_scale=0.18)
    visibility = float(np.mean(vis_vals)) if vis_vals else 0.0

    components: dict[str, MetricComponent] = {}
    comp_weights = {
        "lag_timing": 0.45,
        "velocity_ratio": 0.30,
        "collapse_guard": 0.15,
        "pelvis_activity": 0.10,
    }

    lag_motion_conf = conf_from_motion(shoulder_peak_vel, 8.0)
    lag_conf = _clamp01(
        _metric_confidence(min(cov_sh, cov_pe), max(jit_sh, jit_pe), visibility)
        * phase_conf
        * lag_motion_conf
    )
    lag_reasons = _metric_reasons_from_quality(
        coverage=min(cov_sh, cov_pe),
        visibility=visibility,
        jitter_penalty=max(jit_sh, jit_pe),
        jump_penalty=max(jump_sh, jump_pe),
        phase_conf=phase_conf,
    )
    components["lag_timing"] = MetricComponent(lag_s, lag_score, lag_conf, lag_reasons)

    ratio_motion_conf = combine_conf(
        ConfidenceReport(conf=conf_from_motion(shoulder_peak_vel, 8.0)),
        ConfidenceReport(conf=conf_from_motion(pelvis_peak_vel, 0.05), reasons=["low_motion"] if low_motion else []),
        mode="harmonic",
    ).conf
    ratio_conf = _clamp01(
        _metric_confidence(min(cov_sh, cov_pe), max(jit_sh, jit_pe, jump_sh), visibility)
        * phase_conf
        * ratio_motion_conf
    )
    ratio_reasons = _metric_reasons_from_quality(
        coverage=min(cov_sh, cov_pe),
        visibility=visibility,
        jitter_penalty=max(jit_sh, jit_pe),
        jump_penalty=jump_sh,
        phase_conf=phase_conf,
        low_motion=low_motion,
    )
    components["velocity_ratio"] = MetricComponent(vel_ratio, ratio_score, ratio_conf, ratio_reasons)

    collapse_conf = _clamp01(
        _metric_confidence(min(cov_sh, cov_pe), max(jit_sh, jit_pe, jump_pe), visibility)
        * phase_conf
        * conf_from_motion(shoulder_peak_vel, 8.0)
    )
    collapse_reasons = _metric_reasons_from_quality(
        coverage=min(cov_sh, cov_pe),
        visibility=visibility,
        jitter_penalty=max(jit_sh, jit_pe),
        jump_penalty=jump_pe,
        phase_conf=phase_conf,
        low_motion=low_motion,
    )
    components["collapse_guard"] = MetricComponent(
        value_raw=1.0 if collapse_before_rotate else 0.0,
        score_raw=collapse_score,
        conf=collapse_conf,
        reasons=collapse_reasons,
    )

    pelvis_conf = _clamp01(
        _metric_confidence(cov_pe, max(jit_pe, jump_pe), visibility)
        * phase_conf
        * conf_from_motion(pelvis_peak_vel, 0.05)
    )
    pelvis_reasons = _metric_reasons_from_quality(
        coverage=cov_pe,
        visibility=visibility,
        jitter_penalty=jit_pe,
        jump_penalty=jump_pe,
        phase_conf=phase_conf,
        low_motion=low_motion,
    )
    components["pelvis_activity"] = MetricComponent(
        value_raw=pelvis_peak_vel,
        score_raw=pelvis_activity_score,
        conf=pelvis_conf,
        reasons=pelvis_reasons,
    )

    score_raw, conf, reasons, used_components = _aggregate_components(
        components,
        comp_weights,
        min_valid_components=1,  # Relaxed: partial data still produces a score
    )
    if score_raw is None or conf is None:
        result = BenchmarkResult.insufficient(name, "Separation proxy is blind for this clip")
        result.confidence = 0.0
        result.reasons = reasons
        return result

    penalty = 0.0
    if early_pelvis:
        penalty += min(2.0, abs(lag_s + 0.02) * 25.0)
    if collapse_before_rotate:
        penalty += 1.5
    score_raw = max(0.0, min(10.0, score_raw - penalty))

    if early_pelvis or collapse_before_rotate:
        label = "EARLY HIP COLLAPSE"
    elif lag_s >= 0.01:
        label = "GOOD LAG"
    else:
        label = "SIMULTANEOUS"

    return _finalize_confidence_scored_metric(
        name=name,
        raw_value=lag_s,
        unit="s",
        score_raw=score_raw,
        conf=conf,
        sub_values={
            "label": label,
            "t_shoulder_burst_frame": shoulder_burst_frame,
            "t_pelvis_burst_frame": pelvis_burst_frame,
            "lag_s": round(lag_s, 4),
            "lag_score": round(lag_score, 3),
            "velocity_ratio": round(vel_ratio, 3),
            "ratio_score": round(ratio_score, 3),
            "collapse_before_rotate": collapse_before_rotate,
            "early_pelvis": early_pelvis,
            "penalty": round(penalty, 3),
            "shoulder_peak_vel": round(shoulder_peak_vel, 3),
            "pelvis_peak_vel_norm": round(pelvis_peak_vel, 4),
            "subcomponent_scores": {
                k: round(float(v.score_raw), 3) if v.score_raw is not None else None
                for k, v in components.items()
            },
            "subcomponent_confidence": {k: round(v.conf, 3) for k, v in components.items()},
            "subcomponents_used": used_components,
        },
        note="Open-side separation proxy from shoulder-vs-pelvis burst timing.",
        reasons=reasons,
        blind_reason="Separation proxy is blind due to missing or unstable landmarks",
    )


def _compute_front_side_closedness_v2(
    poses: list[PoseResult],
    phases: PitchPhases,
    hand: str,
) -> BenchmarkResult:
    """
    Front-side closedness v2 (PLL->REL) with fallback + outlier rescue:
      - glove hand/elbow containment vs torso
      - Falls back to elbow/shoulder when wrist is unstable
      - window_clean removes spike frames
      - Jitter penalises confidence, not score
    """
    name = "front_side_closedness_v2"
    if phases.peak_leg_lift is None or phases.foot_strike is None or phases.ball_release is None:
        return BenchmarkResult.insufficient(name, "PEAK_LEG_LIFT/FOOT_STRIKE/BALL_RELEASE phase not detected")

    start = phases.peak_leg_lift.frame_idx
    end = phases.ball_release.frame_idx
    if end <= start:
        return BenchmarkResult.insufficient(name, "Invalid phase ordering for front-side metric")
    win = _poses_in_range(poses, start, end)
    if len(win) < 4:  # Relaxed from 6 to 4
        result = BenchmarkResult.insufficient(name, "Not enough PLL->REL frames")
        result.confidence = 0.0
        result.reasons = ["window_too_small"]
        return result

    fs_win = _phase_window(poses, phases.foot_strike, radius=2)
    rel_win = _phase_window(poses, phases.ball_release, radius=2)
    if len(fs_win) < 2 or len(rel_win) < 2:  # Relaxed from 3 to 2
        result = BenchmarkResult.insufficient(name, "Insufficient FS/REL windows for closedness")
        result.confidence = 0.0
        result.reasons = ["window_too_small"]
        return result

    glove_wrist = "LEFT_WRIST" if hand == "R" else "RIGHT_WRIST"
    glove_elbow = "LEFT_ELBOW" if hand == "R" else "RIGHT_ELBOW"
    glove_shoulder = "LEFT_SHOULDER" if hand == "R" else "RIGHT_SHOULDER"

    closedness_raw: list[float] = []
    vis_vals: list[float] = []
    used_fallback = False

    for p in win:
        ls = _px_safe(p, "LEFT_SHOULDER")
        rs = _px_safe(p, "RIGHT_SHOULDER")
        lh = _px_safe(p, "LEFT_HIP")
        rh = _px_safe(p, "RIGHT_HIP")
        gw = _px_safe(p, glove_wrist)
        ge = _px_safe(p, glove_elbow)
        gs = _px_safe(p, glove_shoulder)

        # Need torso landmarks at minimum
        if not all([ls, rs, lh, rh]):
            closedness_raw.append(np.nan)
            continue

        shoulder_w = math.dist(ls, rs)
        if shoulder_w < 1e-6:
            closedness_raw.append(np.nan)
            continue

        mid_sh = _midpoint(ls, rs)
        mid_hip = _midpoint(lh, rh)
        sternum = ((mid_sh[0] + mid_hip[0]) / 2.0, (mid_sh[1] + mid_hip[1]) / 2.0)

        # Adaptive weighting: use what's available
        # Full: wrist 0.45 + elbow 0.30 + shoulder 0.25
        # No wrist: elbow 0.60 + shoulder 0.40 (reduced conf)
        # No wrist/elbow: shoulder only (very reduced conf)
        if gw is not None and ge is not None and gs is not None:
            wrist_off = abs(gw[0] - sternum[0]) / shoulder_w
            elbow_off = abs(ge[0] - sternum[0]) / shoulder_w
            shoulder_off = abs(gs[0] - sternum[0]) / shoulder_w
            index = 0.45 * wrist_off + 0.30 * elbow_off + 0.25 * shoulder_off
        elif ge is not None and gs is not None:
            elbow_off = abs(ge[0] - sternum[0]) / shoulder_w
            shoulder_off = abs(gs[0] - sternum[0]) / shoulder_w
            index = 0.60 * elbow_off + 0.40 * shoulder_off
            used_fallback = True
        elif gs is not None:
            shoulder_off = abs(gs[0] - sternum[0]) / shoulder_w
            index = shoulder_off
            used_fallback = True
        else:
            closedness_raw.append(np.nan)
            continue

        closedness_raw.append(index)
        vis_kps = ["LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"]
        if gw is not None:
            vis_kps.append(glove_wrist)
        if ge is not None:
            vis_kps.append(glove_elbow)
        vis_kps.append(glove_shoulder)
        vis_vals.append(_visibility_confidence(p, vis_kps))

    # Apply window_clean to full series
    cleaned_result = window_clean(closedness_raw, radius=len(closedness_raw), mad_k=3.0)
    clean_series = list(cleaned_result.values)

    smooth_idx = smooth_series(clean_series, window=7, polyorder=2)
    smooth_map = {}
    for p, v in zip(win, smooth_idx):
        if np.isnan(v):
            continue
        smooth_map[p.frame_idx] = float(v)

    fs_vals = [smooth_map[p.frame_idx] for p in fs_win if p.frame_idx in smooth_map]
    rel_vals = [smooth_map[p.frame_idx] for p in rel_win if p.frame_idx in smooth_map]
    if len(fs_vals) < 1 or len(rel_vals) < 1:  # Relaxed from 3 to 1
        result = BenchmarkResult.insufficient(name, "Insufficient smoothed FS/REL closedness samples")
        result.confidence = 0.0
        result.reasons = ["window_too_small", "missing_landmarks"]
        return result

    fs_index = float(np.median(np.asarray(fs_vals, dtype=np.float64)))
    rel_index = float(np.median(np.asarray(rel_vals, dtype=np.float64)))
    open_drop = rel_index - fs_index  # positive => opened up

    score_fs = linear_score(fs_index, 0.08, 0.60, 10.0, 0.0)
    score_rel = linear_score(rel_index, 0.10, 0.75, 10.0, 0.0)
    if open_drop <= 0.0:
        drop_score = 10.0
    elif open_drop <= 0.08:
        drop_score = linear_score(open_drop, 0.0, 0.08, 10.0, 6.0)
    elif open_drop <= 0.20:
        drop_score = linear_score(open_drop, 0.08, 0.20, 6.0, 0.0)
    else:
        drop_score = 0.0

    score_raw = max(0.0, min(10.0, 0.40 * score_fs + 0.25 * score_rel + 0.35 * drop_score))
    label = "STAYS CLOSED" if (open_drop <= 0.08 and score_raw >= 6.0) else "OPENS EARLY"
    cov = _clamp01(cleaned_result.kept_count / max(1, len(win)))
    visibility = float(np.mean(vis_vals)) if vis_vals else 0.0
    fallback_penalty = 0.15 if used_fallback else 0.0
    phase_conf = _phase_confidence([phases.peak_leg_lift, phases.foot_strike, phases.ball_release])
    conf = _clamp01(
        _metric_confidence(cov, cleaned_result.jitter_score + fallback_penalty, visibility)
        * phase_conf
    )
    reasons = _metric_reasons_from_quality(
        coverage=cov,
        visibility=visibility,
        jitter_penalty=cleaned_result.jitter_score,
        phase_conf=phase_conf,
    ) if conf < CONF_FULL else []

    return _finalize_confidence_scored_metric(
        name=name,
        raw_value=score_raw,
        unit="score",
        score_raw=score_raw,
        conf=conf,
        sub_values={
            "label": label,
            "closedness_fs": round(fs_index, 4),
            "closedness_rel": round(rel_index, 4),
            "open_drop_fs_to_rel": round(open_drop, 4),
            "score_fs": round(score_fs, 3),
            "score_rel": round(score_rel, 3),
            "drop_score": round(drop_score, 3),
            "used_elbow_fallback": used_fallback,
            "frames_kept": cleaned_result.kept_count,
            "frames_dropped": cleaned_result.dropped_count,
        },
        note="Front-side containment through FS->REL using glove/torso open-side proxies.",
        reasons=reasons,
        blind_reason="Front-side closedness is blind due to missing glove/torso landmarks",
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
    Open-side release extension composite (v2 upgraded with outlier rescue):
      A) reach depth proxy — best-frame + window_clean, body-height normalised
      B) release-angle proxy (shoulder->wrist vs trunk line)
      C) forward intent (smoothed wrist x-velocity pre-release)

    Key improvements:
      - Uses window_clean to remove spike frames before median.
      - Picks best frame by (visibility × inverse jump) for component A.
      - Falls back to elbow when wrist is missing.
      - Jitter penalises confidence only, never score.
      - min_valid_components=1 so partial data still produces a score.
    """
    name = "release_extension_v2"
    if phases.ball_release is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE phase not detected")

    rel_pose = _pose_nearest(poses, phases.ball_release)
    if rel_pose is None:
        return BenchmarkResult.insufficient(name, "BALL_RELEASE pose not found")

    throw_wrist = "RIGHT_WRIST" if hand == "R" else "LEFT_WRIST"
    throw_elbow = "RIGHT_ELBOW" if hand == "R" else "LEFT_ELBOW"
    drive_hip = "RIGHT_HIP" if hand == "R" else "LEFT_HIP"
    comp_weights = {"A": 0.55, "B": 0.25, "C": 0.20}
    components: dict[str, MetricComponent] = {}
    sub_values: dict[str, float] = {}

    # ------------------------------------------------------------------
    # Component A: reach depth from release window (outlier-rescued)
    # ------------------------------------------------------------------
    rel_win = _phase_window(poses, phases.ball_release, radius=2)
    if not rel_win:
        rel_win = [rel_pose]

    body_height = _body_height_proxy_px(
        _pose_nearest(poses, phases.set_pos) or rel_pose,
        fallback_height=float(rel_pose.height) * 0.55,
    )

    reach_raw: list[float] = []
    reach_vis: list[float] = []
    used_elbow_fallback = False
    for p in rel_win:
        wrist = _px_safe(p, throw_wrist)
        hip = _px_safe(p, drive_hip)
        ls = _px_safe(p, "LEFT_SHOULDER")
        rs = _px_safe(p, "RIGHT_SHOULDER")
        elbow = _px_safe(p, throw_elbow)

        # Elbow fallback: if wrist missing but elbow present, use elbow
        reach_pt = wrist
        if reach_pt is None and elbow is not None:
            reach_pt = elbow
            used_elbow_fallback = True

        if reach_pt is None or hip is None:
            reach_raw.append(np.nan)
            continue

        # Normalise by body height when available, else shoulder width
        if body_height is not None and body_height > 10.0:
            reach_raw.append(math.dist(reach_pt, hip) / body_height)
        elif ls is not None and rs is not None:
            sw = math.dist(ls, rs)
            if sw < 1e-3:
                reach_raw.append(np.nan)
                continue
            reach_raw.append(math.dist(reach_pt, hip) / sw)
        else:
            reach_raw.append(np.nan)
            continue

        kps = [drive_hip, "LEFT_SHOULDER", "RIGHT_SHOULDER"]
        kps.append(throw_wrist if wrist is not None else throw_elbow)
        reach_vis.append(_visibility_confidence(p, kps))

    # Apply window_clean to remove spike frames
    cleaned = window_clean(reach_raw, radius=len(reach_raw), mad_k=3.0)
    reach_cleaned = cleaned.values[~np.isnan(cleaned.values)]

    if len(reach_cleaned) >= 1:
        reach_norm = float(np.median(reach_cleaned))
        # Score uses body-height normalised reach: 0.45..0.75 maps to 0..10
        if body_height is not None and body_height > 10.0:
            a_score = linear_score(reach_norm, 0.45, 0.75, 0.0, 10.0)
        else:
            a_score = _score_release_extension_proxy(reach_norm)
        a_cov = _clamp01(len(reach_cleaned) / max(1, len(rel_win)))
        a_vis = float(np.mean(reach_vis)) if reach_vis else 0.0
        elbow_penalty = 0.15 if used_elbow_fallback else 0.0
        a_conf = _clamp01(
            _metric_confidence(a_cov, cleaned.jitter_score + elbow_penalty, a_vis)
            * _phase_confidence([phases.ball_release])
        )
        a_reasons = _metric_reasons_from_quality(
            coverage=a_cov,
            visibility=a_vis,
            jitter_penalty=cleaned.jitter_score,
            phase_conf=_phase_confidence([phases.ball_release]),
        )
        components["A"] = MetricComponent(reach_norm, a_score, a_conf, a_reasons)
        sub_values["component_a_reach_norm"] = round(reach_norm, 3)
        sub_values["component_a_score"] = round(a_score, 3)
        sub_values["component_a_elbow_fallback"] = used_elbow_fallback
        sub_values["component_a_frames_kept"] = cleaned.kept_count
    else:
        components["A"] = MetricComponent(None, None, 0.0, ["missing_landmarks"])
        reach_norm = None

    # ------------------------------------------------------------------
    # Component B: release angle proxy (arm line vs trunk line), windowed
    # ------------------------------------------------------------------
    b_angles: list[float] = []
    b_vis_vals: list[float] = []
    for p in rel_win:
        ls = _px_vis_safe(p, "LEFT_SHOULDER")
        rs = _px_vis_safe(p, "RIGHT_SHOULDER")
        lh = _px_vis_safe(p, "LEFT_HIP")
        rh = _px_vis_safe(p, "RIGHT_HIP")
        wrist_rel = _px_vis_safe(p, throw_wrist)
        # Elbow fallback for angle too
        if wrist_rel is None:
            wrist_rel = _px_vis_safe(p, throw_elbow)
        mid_sh = _weighted_midpoint(ls, rs)
        mid_hip = _weighted_midpoint(lh, rh)
        if mid_sh is None or mid_hip is None or wrist_rel is None:
            continue
        arm_vec = (wrist_rel[0] - mid_sh[0], wrist_rel[1] - mid_sh[1])
        trunk_vec = (mid_hip[0] - mid_sh[0], mid_hip[1] - mid_sh[1])
        angle = _angle_between_vectors_deg(arm_vec, trunk_vec)
        if angle is None:
            continue
        b_angles.append(float(angle))
        vis_vals = [v[2] for v in [ls, rs, lh, rh, wrist_rel] if v is not None]
        b_vis_vals.append(float(np.mean(vis_vals)) if vis_vals else 0.0)

    # Clean angle series
    b_cleaned = window_clean(b_angles, radius=len(b_angles), mad_k=3.0)
    b_clean_vals = b_cleaned.values[~np.isnan(b_cleaned.values)]

    if len(b_clean_vals) >= 1:
        b_angle = float(np.median(b_clean_vals))
        b_score = _score_release_angle_proxy(b_angle)
        b_cov = _clamp01(len(b_clean_vals) / max(1, len(rel_win)))
        b_vis = _clamp01((float(np.mean(b_vis_vals)) - 0.25) / 0.75) if b_vis_vals else 0.0
        b_conf = _clamp01(
            _metric_confidence(b_cov, b_cleaned.jitter_score, b_vis)
            * _phase_confidence([phases.ball_release])
        )
        b_reasons = _metric_reasons_from_quality(
            coverage=b_cov,
            visibility=b_vis,
            jitter_penalty=b_cleaned.jitter_score,
            phase_conf=_phase_confidence([phases.ball_release]),
        )
        components["B"] = MetricComponent(b_angle, b_score, b_conf, b_reasons)
        sub_values["component_b_angle_deg"] = round(float(b_angle), 3)
        sub_values["component_b_score"] = round(b_score, 3)
    else:
        components["B"] = MetricComponent(None, None, 0.0, ["missing_landmarks"])

    # ------------------------------------------------------------------
    # Component C: forward intent from pre-release wrist-x velocity
    # ------------------------------------------------------------------
    pre_start = max(0, phases.ball_release.frame_idx - 6)
    pre_win = _poses_in_range(poses, pre_start, phases.ball_release.frame_idx)

    wrist_x_raw: list[float] = []
    wrist_vis: list[float] = []
    for p in pre_win:
        wpt = _px_vis_safe(p, throw_wrist)
        if wpt is None:
            wpt = _px_vis_safe(p, throw_elbow)  # elbow fallback
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
        c_cov, c_jitter = _series_quality(
            wrist_x_raw,
            expected_frames=len(pre_win),
            jitter_scale=max(body_height * 0.02, 1.0),
        )
        c_jump = _jump_penalty(vx_vals, jump_scale=max(25.0, phases.fps * 0.8))
        c_vis = float(np.mean(wrist_vis)) if wrist_vis else 0.0
        c_conf = _clamp01(
            _metric_confidence(c_cov, max(c_jitter, c_jump), c_vis)
            * _phase_confidence([phases.ball_release])
            * conf_from_motion(vx_norm, 0.12)
        )
        c_reasons = _metric_reasons_from_quality(
            coverage=c_cov,
            visibility=c_vis,
            jitter_penalty=c_jitter,
            jump_penalty=c_jump,
            phase_conf=_phase_confidence([phases.ball_release]),
            low_motion=(vx_norm < 0.12),
        )
        components["C"] = MetricComponent(vx_norm, c_score, c_conf, c_reasons)
        sub_values["component_c_wrist_vx_norm"] = round(vx_norm, 3)
        sub_values["component_c_score"] = round(c_score, 3)
    else:
        components["C"] = MetricComponent(None, None, 0.0, ["missing_landmarks"])

    score_raw, conf, reasons, used_components = _aggregate_components(
        components,
        comp_weights,
        min_valid_components=1,  # Accept even partial data
    )
    if score_raw is None or conf is None:
        result = BenchmarkResult.insufficient(name, "Release extension cannot be estimated reliably")
        result.confidence = 0.0
        result.reasons = reasons
        return result

    sub_values["components_used"] = used_components
    sub_values["components_used_count"] = len(used_components)
    return _finalize_confidence_scored_metric(
        name=name,
        raw_value=reach_norm,
        unit="x shoulder",
        score_raw=max(0.0, min(10.0, score_raw)),
        conf=conf,
        sub_values=sub_values,
        note="Composite release extension proxy from reach, release-angle, and forward-intent cues.",
        reasons=reasons,
        blind_reason="Release extension signal is blind at release",
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
    "lead_leg_block_v3",
    "hip_shoulder_sep_v3",
    "front_side_closedness_v2",
    "release_extension_v2",
    "timing",
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
    "trunk_stability_v2",
    "release_extension_proxy",
    "drift_forward",
    "front_knee_flexion_fs",
    "front_knee_extension_rel",
    "lead_leg_block_v2",
    "hip_shoulder_sep_v2",
    "front_side_closedness",
    "forward_leak_proxy",
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
    "lead_leg_block_v3": 1.0,
    "hip_shoulder_sep_v3": 1.0,
    "front_side_closedness_v2": 1.0,
}

_OPEN_SIDE_WEIGHTS: dict[str, float] = {
    "lead_leg_block_v3": 2.0,
    "hip_shoulder_sep_v3": 1.8,
    "front_side_closedness_v2": 1.6,
    "release_extension_v2": 1.0,
    "timing": 0.7,
    "swivel_stabilize": 0.5,
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
        if view_mode == "open_side" and conf_raw < CONF_BLIND:
            continue
        eff_weight = weight
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
                   and uses Open-Side Pro v3 official metrics for efficiency.
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
        _compute_lead_leg_block_v3(poses, phases, hand),
        _compute_hip_shoulder_sep_v3(poses, phases, hand),
        _compute_front_side_closedness_v2(poses, phases, hand),
        _compute_release_extension_v2(poses, phases, hand),
        _compute_drift_forward(poses, phases),
        _compute_forward_leak_proxy(poses, phases, hand),
        _compute_front_knee_flexion_fs(poses, phases, hand),
        _compute_front_knee_extension_rel(poses, phases, hand),
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
