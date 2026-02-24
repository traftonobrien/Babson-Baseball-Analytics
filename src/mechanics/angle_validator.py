"""
Open-side camera angle validation for mechanics analysis.

Wraps the existing angle classifier to provide a clean validation API:
    validate_open_side(video_path, hand) -> ValidationResult

If the clip is not classified as the correct open-side angle with
sufficient confidence, the validation fails and provides a reason.
"""
from __future__ import annotations

import dataclasses
from pathlib import Path
from typing import Optional

from src.ingest.angle_classify import (
    AnglePrediction,
    classify_angle_from_frames,
    sample_segment_frames,
)
from src.mechanics.video_io import read_video_meta


# Minimum confidence to accept an open-side classification.
OPEN_SIDE_MIN_CONFIDENCE = 0.70


@dataclasses.dataclass
class ValidationResult:
    """Result of open-side camera angle validation."""
    valid: bool
    confidence: float
    angle_class: str
    reject_reason: Optional[str] = None
    prediction: Optional[AnglePrediction] = None

    def to_dict(self) -> dict:
        d = {
            "valid": self.valid,
            "confidence": round(self.confidence, 3),
            "angle_class": self.angle_class,
        }
        if self.reject_reason:
            d["reject_reason"] = self.reject_reason
        return d


def _expected_open_side_class(hand: str) -> str:
    """Return the expected angle class for a given pitcher hand."""
    return "open_side_RHP" if hand == "R" else "open_side_LHP"


def validate_open_side(
    video_path: str | Path,
    hand: str,
    min_confidence: float = OPEN_SIDE_MIN_CONFIDENCE,
    max_samples: int = 14,
) -> ValidationResult:
    """
    Validate that a video clip is filmed from the correct open-side angle.

    Args:
        video_path:     Path to the video clip.
        hand:           Pitcher throwing hand — "R" or "L".
        min_confidence: Minimum confidence threshold for acceptance.
        max_samples:    Maximum frames to sample for classification.

    Returns:
        ValidationResult with valid=True if the clip is open-side with
        sufficient confidence, or valid=False with a reject_reason.
    """
    path = Path(video_path)
    expected_class = _expected_open_side_class(hand)

    # Sample frames from the full clip.
    try:
        meta = read_video_meta(path)
        frames = sample_segment_frames(
            path,
            start_frame=0,
            end_frame=meta.frame_count - 1,
            max_samples=max_samples,
        )
    except (FileNotFoundError, OSError) as e:
        return ValidationResult(
            valid=False,
            confidence=0.0,
            angle_class="unknown",
            reject_reason=f"Cannot read video: {e}",
        )

    if not frames:
        return ValidationResult(
            valid=False,
            confidence=0.0,
            angle_class="unknown",
            reject_reason="No frames could be read from video",
        )

    prediction = classify_angle_from_frames(frames)

    # Check if the predicted class matches the expected open-side class.
    if prediction.angle_class != expected_class:
        # Allow the other open-side class (wrong hand assumption) as a soft fail.
        other_open_side = "open_side_LHP" if hand == "R" else "open_side_RHP"
        if prediction.angle_class == other_open_side:
            reason = (
                f"Classified as {prediction.angle_class} (expected {expected_class}). "
                f"Check pitcher hand setting."
            )
        elif prediction.angle_class == "unknown":
            reason = (
                f"Camera angle could not be determined "
                f"(confidence={prediction.confidence:.2f}). "
                f"Re-film from open side ({expected_class})."
            )
        else:
            reason = (
                f"Classified as {prediction.angle_class} "
                f"(expected {expected_class}, confidence={prediction.confidence:.2f}). "
                f"Re-film from open side."
            )
        return ValidationResult(
            valid=False,
            confidence=prediction.confidence,
            angle_class=prediction.angle_class,
            reject_reason=reason,
            prediction=prediction,
        )

    # Correct class but confidence too low.
    if prediction.confidence < min_confidence:
        return ValidationResult(
            valid=False,
            confidence=prediction.confidence,
            angle_class=prediction.angle_class,
            reject_reason=(
                f"Open-side classification confidence too low "
                f"({prediction.confidence:.2f} < {min_confidence:.2f}). "
                f"Metrics may be unreliable."
            ),
            prediction=prediction,
        )

    # Passed validation.
    return ValidationResult(
        valid=True,
        confidence=prediction.confidence,
        angle_class=prediction.angle_class,
        prediction=prediction,
    )


def validate_open_side_from_frames(
    frames: list,
    hand: str,
    min_confidence: float = OPEN_SIDE_MIN_CONFIDENCE,
) -> ValidationResult:
    """
    Validate open-side angle from pre-loaded frames (no video file needed).

    Useful when frames are already available from pose extraction or ingest.
    """
    expected_class = _expected_open_side_class(hand)

    if not frames:
        return ValidationResult(
            valid=False,
            confidence=0.0,
            angle_class="unknown",
            reject_reason="No frames provided",
        )

    prediction = classify_angle_from_frames(frames)

    if prediction.angle_class != expected_class:
        return ValidationResult(
            valid=False,
            confidence=prediction.confidence,
            angle_class=prediction.angle_class,
            reject_reason=f"Classified as {prediction.angle_class} (expected {expected_class})",
            prediction=prediction,
        )

    if prediction.confidence < min_confidence:
        return ValidationResult(
            valid=False,
            confidence=prediction.confidence,
            angle_class=prediction.angle_class,
            reject_reason=(
                f"Open-side confidence too low "
                f"({prediction.confidence:.2f} < {min_confidence:.2f})"
            ),
            prediction=prediction,
        )

    return ValidationResult(
        valid=True,
        confidence=prediction.confidence,
        angle_class=prediction.angle_class,
        prediction=prediction,
    )
