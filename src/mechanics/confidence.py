"""
Shared confidence utilities for open-side mechanics metrics.
"""
from __future__ import annotations

import dataclasses
from typing import Iterable, Sequence


CONF_BLIND = 0.15
CONF_FULL = 0.60

CONFIDENCE_REASONS: tuple[str, ...] = (
    "missing_landmarks",
    "occluded",
    "window_too_small",
    "high_jitter",
    "outlier_jump",
    "low_motion",
    "phase_uncertain",
    "angle_validation_failed",
    "pose_backend_low",
)

# When ViTPose is used and angle validation passes, confidence floor is higher.
CONF_FULL_VITPOSE = 0.70


@dataclasses.dataclass
class ConfidenceReport:
    conf: float
    reasons: list[str] = dataclasses.field(default_factory=list)
    components: dict[str, float] = dataclasses.field(default_factory=dict)


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _normalise_reasons(reasons: Iterable[str]) -> list[str]:
    out: list[str] = []
    for reason in reasons:
        if reason not in CONFIDENCE_REASONS:
            continue
        if reason not in out:
            out.append(reason)
    return out


def conf_from_visibility(vis_ratio: float) -> float:
    """Monotonic visibility confidence in [0, 1]."""
    return clamp01(vis_ratio)


def conf_from_window(n_frames: int, min_frames: int) -> float:
    """Monotonic confidence from frame support."""
    if min_frames <= 0:
        return 1.0
    return clamp01(float(n_frames) / float(min_frames))


def conf_from_jitter(mad: float, target_mad: float, floor: float = 0.10) -> float:
    """
    Monotonic decreasing confidence as jitter grows.

    Never goes below `floor` — jitter alone should reduce confidence
    but not drive it to zero (only missing landmarks do that).
    """
    if target_mad <= 1e-9:
        return 1.0
    raw = 1.0 - (float(mad) / float(target_mad))
    return clamp01(max(raw, floor))


def conf_from_motion(motion: float, min_motion: float) -> float:
    """Monotonic confidence from motion magnitude."""
    if min_motion <= 1e-9:
        return 1.0
    return clamp01(float(motion) / float(min_motion))


def conf_from_pose_backend(backend: str) -> ConfidenceReport:
    """
    Confidence boost/penalty based on pose estimation backend.

    ViTPose provides better occlusion handling → higher base confidence.
    MediaPipe is the baseline.
    """
    if backend == "vitpose":
        return ConfidenceReport(conf=0.90, components={"pose_backend": 0.90})
    # MediaPipe: baseline, no boost.
    return ConfidenceReport(
        conf=0.70,
        reasons=["pose_backend_low"],
        components={"pose_backend": 0.70},
    )


def conf_from_angle_validation(
    angle_valid: bool,
    angle_confidence: float = 0.0,
) -> ConfidenceReport:
    """
    Confidence from camera angle validation.

    If validation passed: slight boost based on angle confidence.
    If validation failed: cap confidence at 0.30 for all metrics.
    """
    if angle_valid:
        conf = clamp01(0.80 + 0.20 * angle_confidence)
        return ConfidenceReport(conf=conf, components={"angle_validation": conf})
    return ConfidenceReport(
        conf=min(0.30, angle_confidence),
        reasons=["angle_validation_failed"],
        components={"angle_validation": min(0.30, angle_confidence)},
    )


def conf_from_phase_quality(phases_data: dict) -> ConfidenceReport:
    """
    Aggregate confidence from phase detection quality.

    Args:
        phases_data: dict mapping phase name -> Phase-like dict with
                     'confidence' and optional 'reason' fields.
    """
    if not phases_data:
        return ConfidenceReport(conf=0.40, reasons=["phase_uncertain"])

    confs = []
    reasons: list[str] = []
    for phase_name, phase in phases_data.items():
        if phase is None:
            reasons.append("phase_uncertain")
            confs.append(0.0)
            continue
        c = float(phase.get("confidence", 0.5) if isinstance(phase, dict) else getattr(phase, "confidence", 0.5))
        confs.append(c)
        reason = phase.get("reason", "") if isinstance(phase, dict) else getattr(phase, "reason", "")
        if reason and reason in CONFIDENCE_REASONS:
            reasons.append(reason)

    if not confs:
        return ConfidenceReport(conf=0.40, reasons=["phase_uncertain"])

    # Use minimum phase confidence as the aggregate.
    conf = clamp01(min(confs))
    return ConfidenceReport(
        conf=conf,
        reasons=list(set(reasons)),
        components={"phase_quality": conf},
    )


def build_confidence_breakdown(
    landmark_quality: float,
    phase_quality: float,
    pose_backend: float,
    angle_validation: float,
) -> dict[str, float]:
    """
    Build a confidence breakdown dict for notes.json.

    Each source is a float [0, 1]. The breakdown is stored per-metric
    so coaches can see why confidence is low.
    """
    return {
        "landmark_quality": round(clamp01(landmark_quality), 3),
        "phase_quality": round(clamp01(phase_quality), 3),
        "pose_backend": round(clamp01(pose_backend), 3),
        "angle_validation": round(clamp01(angle_validation), 3),
    }


def combine_conf(
    *reports: ConfidenceReport,
    weights: Sequence[float] | None = None,
    mode: str = "harmonic",
) -> ConfidenceReport:
    """
    Combine multiple ConfidenceReports.

    mode:
      - "min": conservative minimum
      - "harmonic": weighted harmonic mean (default)
      - "weighted": weighted arithmetic mean
    """
    active = [r for r in reports if r is not None]
    if not active:
        return ConfidenceReport(conf=0.0, reasons=["missing_landmarks"])

    if weights is None:
        w = [1.0] * len(active)
    else:
        w = [max(0.0, float(v)) for v in weights][: len(active)]
        if len(w) < len(active):
            w.extend([1.0] * (len(active) - len(w)))
    if sum(w) <= 1e-9:
        w = [1.0] * len(active)

    conf_values = [clamp01(r.conf) for r in active]
    reasons = _normalise_reasons(reason for r in active for reason in r.reasons)

    if mode == "min":
        conf = min(conf_values)
    elif mode == "weighted":
        conf = sum(c * ww for c, ww in zip(conf_values, w)) / sum(w)
    else:
        if any(c <= 0.0 for c in conf_values):
            conf = 0.0
        else:
            conf = sum(w) / sum((ww / c) for c, ww in zip(conf_values, w))

    components: dict[str, float] = {}
    for report in active:
        components.update(report.components)
    return ConfidenceReport(conf=clamp01(conf), reasons=reasons, components=components)


def apply_confidence_to_score(score_raw: float, conf: float) -> float:
    """
    Penalize metric score by confidence.

    score_eff = score_raw * clamp01((conf - CONF_BLIND)/(CONF_FULL - CONF_BLIND))
    """
    raw = max(0.0, min(10.0, float(score_raw)))
    c = clamp01(conf)
    if c <= CONF_BLIND:
        return 0.0
    conf_scaled = clamp01((c - CONF_BLIND) / max(1e-9, CONF_FULL - CONF_BLIND))
    return raw * conf_scaled


def finalize_metric(
    score_raw: float | None,
    conf_report: ConfidenceReport,
    allow_soft_fail: bool = True,
) -> dict:
    """
    Normalize confidence-driven metric status and scores.

    Rules:
      - score_raw is None → insufficient_data (no signal at all).
      - conf <= CONF_BLIND with only jitter/motion reasons → still "ok"
        with penalised score_eff (soft degrade, never blind).
      - conf <= CONF_BLIND with missing_landmarks/window_too_small → insufficient.
      - conf > CONF_BLIND → "ok".

    Always returns:
      status, confidence, reasons, score_raw, score_eff
    """
    conf = clamp01(conf_report.conf if conf_report is not None else 0.0)
    reasons = _normalise_reasons(conf_report.reasons if conf_report is not None else [])

    if score_raw is None:
        return {
            "status": "insufficient_data",
            "confidence": conf,
            "reasons": reasons or ["missing_landmarks"],
            "score_raw": None,
            "score_eff": None,
        }

    raw = max(0.0, min(10.0, float(score_raw)))
    score_eff = apply_confidence_to_score(raw, conf)

    # Determine if the signal is truly blind vs just noisy.
    # Only structural reasons (missing data) cause insufficient_data.
    _STRUCTURAL_REASONS = {"missing_landmarks", "window_too_small", "occluded"}
    has_structural_reason = bool(_STRUCTURAL_REASONS & set(reasons))

    if conf <= CONF_BLIND:
        if has_structural_reason and not allow_soft_fail:
            status = "insufficient_data"
            score_eff = None
        elif has_structural_reason and conf <= 0.0:
            status = "insufficient_data"
            score_eff = None
        else:
            # Jitter/motion reasons alone → soft degrade, keep "ok"
            status = "ok"
    else:
        status = "ok"

    return {
        "status": status,
        "confidence": conf,
        "reasons": reasons,
        "score_raw": raw,
        "score_eff": score_eff,
    }

