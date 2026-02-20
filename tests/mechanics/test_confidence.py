from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.mechanics.confidence import (
    CONF_BLIND,
    CONF_FULL,
    ConfidenceReport,
    apply_confidence_to_score,
    combine_conf,
    finalize_metric,
)


def test_apply_confidence_to_score_boundaries():
    assert apply_confidence_to_score(10.0, CONF_BLIND) == pytest.approx(0.0)
    assert apply_confidence_to_score(10.0, CONF_FULL) == pytest.approx(10.0)
    assert apply_confidence_to_score(10.0, 1.0) == pytest.approx(10.0)


def test_apply_confidence_to_score_midpoint():
    mid = (CONF_BLIND + CONF_FULL) / 2.0
    assert apply_confidence_to_score(10.0, mid) == pytest.approx(5.0)


def test_finalize_metric_soft_fail_when_low_conf_but_not_blind():
    report = ConfidenceReport(conf=0.10, reasons=["occluded"])
    out = finalize_metric(score_raw=8.0, conf_report=report, allow_soft_fail=True)
    assert out["status"] == "ok"
    assert out["score_raw"] == pytest.approx(8.0)
    assert out["score_eff"] == pytest.approx(0.0)
    assert "occluded" in out["reasons"]


def test_finalize_metric_insufficient_when_truly_blind():
    report = ConfidenceReport(conf=0.0, reasons=["missing_landmarks"])
    out = finalize_metric(score_raw=8.0, conf_report=report, allow_soft_fail=True)
    assert out["status"] == "insufficient_data"
    assert out["score_eff"] is None


def test_combine_conf_default_harmonic():
    a = ConfidenceReport(conf=0.8)
    b = ConfidenceReport(conf=0.4)
    c = combine_conf(a, b)
    assert 0.4 <= c.conf <= 0.8
    assert c.conf < ((0.8 + 0.4) / 2.0)
