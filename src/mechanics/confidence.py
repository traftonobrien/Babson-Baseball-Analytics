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
)


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


def conf_from_jitter(mad: float, target_mad: float) -> float:
    """Monotonic decreasing confidence as jitter grows."""
    if target_mad <= 1e-9:
        return 1.0
    return clamp01(1.0 - (float(mad) / float(target_mad)))


def conf_from_motion(motion: float, min_motion: float) -> float:
    """Monotonic confidence from motion magnitude."""
    if min_motion <= 1e-9:
        return 1.0
    return clamp01(float(motion) / float(min_motion))


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

    if conf <= CONF_BLIND:
        if allow_soft_fail and conf > 0.0:
            status = "ok"
        else:
            status = "insufficient_data"
            score_eff = None
    else:
        status = "ok"

    return {
        "status": status,
        "confidence": conf,
        "reasons": reasons,
        "score_raw": raw,
        "score_eff": score_eff,
    }

