"""
Pitch phase detection using heuristic analysis of pose keypoint sequences.

WHAT THIS MODULE DOES:
  Identifies eight key moments in a pitch from the keypoint time series.
  Each detector uses a simple rule (min/max value, velocity threshold,
  velocity drop) on one or two keypoints. No ML model is trained here —
  these are all hand-written rules.

PHASES (in order):
  set            - pitcher is still in the set/windup position
  first_movement - first detectable motion (weight shift / leg lift start)
  peak_leg_lift  - lead knee at maximum height above hip
  most_loaded    - maximum hip hinge + lead knee at lowest before stride
  foot_strike    - lead foot fully planted (both heel AND toe grounded)
  weight_bearing - weight fully transferred to lead leg (after foot strike)
  arm_flip_up    - throwing arm reaches cocked position (45-90° ext. rotation)
  ball_release   - throwing wrist reaches peak velocity

CAMERA ASSUMPTION:
  Open-side camera: 3B side for RHP, 1B side for LHP.
  This means the lead leg is visible and moves clearly through the frame.

KNOWN LIMITATIONS:
  - SET is fragile if the clip starts mid-delivery.
  - FOOT_STRIKE can misfire if the ankle keypoint is occluded mid-stride.
  - BALL_RELEASE via wrist velocity is rough — motion blur during
    arm acceleration makes wrist tracking unreliable. A dedicated
    ball-detection model (YOLO) would be far more accurate here.
  - All detections assume a single pitch per clip. Multi-pitch clips
    will return results for the first pitch only.

WHY THIS APPROACH:
  Heuristic rules are fast, transparent, and easy to debug. You can
  print the velocity series and see exactly why a phase was placed.
  The cost is brittleness — any unusual delivery style or occlusion
  can confuse the rules. Once you have ground-truth labels for a few
  clips, you can swap these rules for a small classifier.
"""
from __future__ import annotations

import dataclasses
import math
from typing import Dict, List, Optional

import numpy as np

from .pose import PoseResult, KP


@dataclasses.dataclass
class Phase:
    name: str
    frame_idx: int
    time_s: float
    confidence: float  # [0, 1] rough estimate of detection quality
    note: str = ""
    reason: str = ""   # machine-readable reason tag for confidence level

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)


@dataclasses.dataclass
class PitchPhases:
    set_pos: Optional[Phase]
    first_movement: Optional[Phase]
    peak_leg_lift: Optional[Phase]
    most_loaded: Optional[Phase]
    foot_strike: Optional[Phase]
    weight_bearing: Optional[Phase]
    arm_flip_up: Optional[Phase]
    ball_release: Optional[Phase]
    fps: float

    def to_dict(self) -> dict:
        return {
            "set": self.set_pos.to_dict() if self.set_pos else None,
            "first_movement": self.first_movement.to_dict() if self.first_movement else None,
            "peak_leg_lift": self.peak_leg_lift.to_dict() if self.peak_leg_lift else None,
            "most_loaded": self.most_loaded.to_dict() if self.most_loaded else None,
            "foot_strike": self.foot_strike.to_dict() if self.foot_strike else None,
            "weight_bearing": self.weight_bearing.to_dict() if self.weight_bearing else None,
            "arm_flip_up": self.arm_flip_up.to_dict() if self.arm_flip_up else None,
            "ball_release": self.ball_release.to_dict() if self.ball_release else None,
            "fps": self.fps,
        }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_y(poses: List[PoseResult], kp_name: str, min_vis: float = 0.3) -> np.ndarray:
    """Y-pixel series for a keypoint. NaN where visibility < min_vis."""
    out = np.full(len(poses), np.nan, dtype=np.float64)
    idx = KP[kp_name]
    for i, p in enumerate(poses):
        lm = p.landmarks[idx]
        if not np.isnan(lm[0]) and lm[2] >= min_vis:
            out[i] = float(lm[1]) * p.height
    return out


def _get_x(poses: List[PoseResult], kp_name: str, min_vis: float = 0.3) -> np.ndarray:
    """X-pixel series for a keypoint. NaN where visibility < min_vis."""
    out = np.full(len(poses), np.nan, dtype=np.float64)
    idx = KP[kp_name]
    for i, p in enumerate(poses):
        lm = p.landmarks[idx]
        if not np.isnan(lm[0]) and lm[2] >= min_vis:
            out[i] = float(lm[0]) * p.width
    return out


def _velocity(series: np.ndarray) -> np.ndarray:
    """
    Frame-to-frame absolute displacement (pixels/frame).
    First frame is NaN. NaN propagates when either neighbor is NaN.
    """
    vel = np.full_like(series, np.nan)
    for i in range(1, len(series)):
        if not (np.isnan(series[i]) or np.isnan(series[i - 1])):
            vel[i] = abs(series[i] - series[i - 1])
    return vel


def _smooth(series: np.ndarray, window: int = 5) -> np.ndarray:
    """
    Sliding-window mean, NaN-aware. Ignores NaN neighbors.
    Output is NaN only if the entire window is NaN.
    """
    out = np.full_like(series, np.nan)
    half = window // 2
    for i in range(len(series)):
        lo = max(0, i - half)
        hi = min(len(series), i + half + 1)
        patch = series[lo:hi]
        valid = patch[~np.isnan(patch)]
        if len(valid) > 0:
            out[i] = valid.mean()
    return out


# ---------------------------------------------------------------------------
# Delivery-start detector (motion energy approach)
# ---------------------------------------------------------------------------

def _body_height_proxy(pose: PoseResult, min_vis: float = 0.25) -> Optional[float]:
    """
    Estimate body height in normalised coords: nose-to-mid-ankle distance.
    Returns None if insufficient keypoints.
    """
    nose_idx = KP["NOSE"]
    la_idx = KP["LEFT_ANKLE"]
    ra_idx = KP["RIGHT_ANKLE"]

    nose = pose.landmarks[nose_idx]
    la = pose.landmarks[la_idx]
    ra = pose.landmarks[ra_idx]

    if np.isnan(nose[0]) or nose[2] < min_vis:
        return None

    ankles = []
    if not np.isnan(la[0]) and la[2] >= min_vis:
        ankles.append(la[1])
    if not np.isnan(ra[0]) and ra[2] >= min_vis:
        ankles.append(ra[1])
    if not ankles:
        return None

    mid_ankle_y = sum(ankles) / len(ankles)
    height = abs(mid_ankle_y - nose[1])
    return height if height > 0.05 else None  # reject degenerate


_ENERGY_KPS = [
    "LEFT_WRIST", "RIGHT_WRIST",
    "LEFT_ANKLE", "RIGHT_ANKLE",
]


def _pt_norm(
    pose: PoseResult,
    kp_name: str,
    min_vis: float = 0.25,
) -> Optional[tuple[float, float]]:
    """Normalized (x,y) for keypoint, or None if low visibility."""
    lm = pose.landmarks[KP[kp_name]]
    if np.isnan(lm[0]) or lm[2] < min_vis:
        return None
    return float(lm[0]), float(lm[1])


def _mid_norm(
    a: Optional[tuple[float, float]],
    b: Optional[tuple[float, float]],
) -> Optional[tuple[float, float]]:
    if a is None or b is None:
        return None
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)


def _motion_points(
    pose: PoseResult,
    min_vis: float = 0.25,
) -> list[Optional[tuple[float, float]]]:
    """Stable points used for delivery-start motion energy."""
    l_hip = _pt_norm(pose, "LEFT_HIP", min_vis=min_vis)
    r_hip = _pt_norm(pose, "RIGHT_HIP", min_vis=min_vis)
    l_sho = _pt_norm(pose, "LEFT_SHOULDER", min_vis=min_vis)
    r_sho = _pt_norm(pose, "RIGHT_SHOULDER", min_vis=min_vis)
    return [
        _mid_norm(l_hip, r_hip),           # mid-hips
        _mid_norm(l_sho, r_sho),           # mid-shoulders
        _pt_norm(pose, "LEFT_WRIST", min_vis=min_vis),
        _pt_norm(pose, "RIGHT_WRIST", min_vis=min_vis),
        _pt_norm(pose, "LEFT_ANKLE", min_vis=min_vis),
        _pt_norm(pose, "RIGHT_ANKLE", min_vis=min_vis),
    ]


def _compute_motion_energy(
    poses: List[PoseResult],
    min_vis: float = 0.25,
) -> np.ndarray:
    """
    Per-frame motion energy: sum of frame-to-frame displacements for 8
    keypoints, normalised by a body-height proxy.

    Returns array of length len(poses). First frame is 0.
    """
    n = len(poses)
    energy = np.zeros(n, dtype=np.float64)

    # Precompute body-height proxy (use first valid measurement)
    bh: Optional[float] = None
    for p in poses:
        bh = _body_height_proxy(p)
        if bh is not None:
            break
    if bh is None:
        bh = 0.5  # fallback: half the normalised frame

    for i in range(1, n):
        prev_pts = _motion_points(poses[i - 1], min_vis=min_vis)
        curr_pts = _motion_points(poses[i], min_vis=min_vis)
        disps: list[float] = []
        for prev, curr in zip(prev_pts, curr_pts):
            if prev is None or curr is None:
                continue
            dx = curr[0] - prev[0]
            dy = curr[1] - prev[1]
            disps.append(float(np.sqrt(dx * dx + dy * dy)))
        if disps:
            energy[i] = (float(np.mean(disps))) / max(bh, 1e-3)
        else:
            energy[i] = np.nan

    return energy


def _earliest_stable_frame(
    poses: List[PoseResult],
    start_idx: int,
    min_consecutive: int = 3,
    min_points: int = 4,
    min_vis: float = 0.25,
) -> Optional[int]:
    """
    Return first frame with enough visible motion points for several frames.

    Used as a safe fallback when a clip starts mid-motion (no clear idle->move edge).
    """
    run_start: Optional[int] = None
    run_len = 0

    for i in range(max(0, start_idx), len(poses)):
        pts = _motion_points(poses[i], min_vis=min_vis)
        visible = sum(1 for p in pts if p is not None)
        if visible >= min_points:
            if run_start is None:
                run_start = i
                run_len = 1
            else:
                run_len += 1
            if run_len >= min_consecutive:
                return run_start
        else:
            run_start = None
            run_len = 0

    return None


def _detect_delivery_start(
    poses: List[PoseResult],
    fps: float = 30.0,
    ignore_initial_s: float = 0.5,
    rolling_window: int = 7,
    min_consecutive: int = 5,
    mad_k: float = 3.5,
) -> Optional[int]:
    """
    Find the frame where the pitcher transitions from idle to delivery.

    Scans smoothed motion energy forward: first frame where energy > threshold
    for >= min_consecutive frames.

    Returns frame *list index* (not frame_idx), or None if no clear transition.
    """
    n = len(poses)
    if n < 10:
        return None

    energy = _compute_motion_energy(poses)
    energy_baseline = _smooth(energy, window=rolling_window)
    # Use a short smoothing window for gating so isolated spikes do not smear.
    energy_gate = _smooth(energy, window=3)

    start_scan = max(1, int(ignore_initial_s * fps))
    start_scan = min(start_scan, n - 1)

    # Baseline from early clip after ignore period; robust against outliers.
    baseline_end = min(n, start_scan + max(int(fps * 0.8), min_consecutive * 2))
    baseline_patch = energy_baseline[start_scan:baseline_end]
    baseline_vals = baseline_patch[~np.isnan(baseline_patch)]

    if len(baseline_vals) < 4:
        fallback_patch = energy_baseline[max(1, start_scan - min_consecutive):baseline_end]
        baseline_vals = fallback_patch[~np.isnan(fallback_patch)]

    if len(baseline_vals) == 0:
        return None

    baseline = float(np.median(baseline_vals))
    mad = float(np.median(np.abs(baseline_vals - baseline)))
    noise_floor = max(mad, 1e-4)
    threshold = baseline + mad_k * noise_floor

    # If we already start above threshold, the clip likely begins mid-motion.
    early_patch = energy_gate[start_scan:start_scan + min_consecutive]
    early_vals = early_patch[~np.isnan(early_patch)]
    starts_in_motion = (
        len(early_vals) >= max(3, min_consecutive - 1) and
        float(np.median(early_vals)) > threshold
    )

    run_start: Optional[int] = None
    run_len = 0

    for i in range(start_scan, n):
        if not np.isnan(energy_gate[i]) and float(energy_gate[i]) > threshold:
            if run_start is None:
                run_start = i
                run_len = 1
            else:
                run_len += 1
            if run_len >= min_consecutive:
                return run_start
        else:
            run_start = None
            run_len = 0

    if starts_in_motion:
        return _earliest_stable_frame(poses, start_idx=start_scan)

    return None


# ---------------------------------------------------------------------------
# Peak leg lift detector (open-side robust fallback)
# ---------------------------------------------------------------------------

def _detect_peak_leg_lift_open_side(
    poses: List[PoseResult],
    knee_y_raw: np.ndarray,
    hip_y_raw: np.ndarray,
    set_idx: int,
    first_move_idx: Optional[int],
    foot_strike_idx: Optional[int],
    fps: float,
) -> Optional[Phase]:
    """
    Robust PEAK LEG LIFT fallback for open-side clips.

    Searches between delivery start and foot strike (if available),
    smooths lead-knee trajectory, and finds the highest-knee frame
    (minimum image y). If visibility is sparse, still returns a fallback
    frame with low (non-zero) confidence when any knee points exist.
    """
    n = len(poses)
    if n == 0:
        return None

    start_idx = max(0, first_move_idx if first_move_idx is not None else set_idx)
    default_end = min(int(n * 0.75), n - 1)
    if foot_strike_idx is not None and foot_strike_idx > start_idx + 1:
        end_idx = min(n - 1, foot_strike_idx)
    else:
        end_idx = default_end

    if end_idx <= start_idx:
        end_idx = min(n - 1, start_idx + 1)
    if end_idx <= start_idx:
        return None

    patch_raw = knee_y_raw[start_idx:end_idx + 1]
    patch_smooth = _smooth(patch_raw, window=5)
    valid_raw = np.where(~np.isnan(patch_raw))[0]
    coverage = float(len(valid_raw)) / float(max(1, len(patch_raw)))

    local_idx: Optional[int] = None
    valid_smooth = np.where(~np.isnan(patch_smooth))[0]
    if len(valid_smooth) > 0:
        local_idx = int(valid_smooth[int(np.nanargmin(patch_smooth[valid_smooth]))])
    elif len(valid_raw) > 0:
        local_idx = int(valid_raw[int(np.nanargmin(patch_raw[valid_raw]))])
    elif len(patch_raw) > 0:
        # No knee observations in window.
        local_idx = int(round((len(patch_raw) - 1) / 2.0))

    if local_idx is None:
        return None

    peak_idx = start_idx + local_idx
    knee_at_peak = knee_y_raw[peak_idx]
    hip_at_peak = hip_y_raw[peak_idx]
    if np.isnan(knee_at_peak):
        knee_at_peak = float(np.nanmedian(patch_raw)) if np.any(~np.isnan(patch_raw)) else np.nan
    if np.isnan(hip_at_peak):
        hip_at_peak = np.nan

    lift_px = None
    if not np.isnan(knee_at_peak) and not np.isnan(hip_at_peak):
        lift_px = float(hip_at_peak - knee_at_peak)

    if coverage <= 0.0:
        conf = 0.0
        note = "Lead-knee landmarks absent in SET→FS window; midpoint fallback"
    elif coverage < 0.5:
        # Keep non-zero confidence for sparse, partially visible windows.
        conf = float(np.clip(0.20 + 0.20 * coverage, 0.20, 0.30))
        note = f"Sparse knee visibility ({coverage:.0%}) in SET→FS window; low-confidence fallback"
    else:
        lift_quality = 0.0
        if lift_px is not None:
            lift_quality = float(np.clip(lift_px / 80.0, 0.0, 1.0))
        conf = float(np.clip(0.35 + 0.45 * coverage + 0.20 * lift_quality, 0.20, 0.95))
        if lift_px is not None:
            note = f"Lead knee peak in SET→FS window ({lift_px:.0f}px above hip)"
        else:
            note = "Lead knee peak in SET→FS window (hip visibility limited)"

    return Phase(
        name="peak_leg_lift",
        frame_idx=poses[peak_idx].frame_idx,
        time_s=poses[peak_idx].frame_idx / fps,
        confidence=conf,
        note=note,
    )


# ---------------------------------------------------------------------------
# Most loaded detector (V5)
# ---------------------------------------------------------------------------

def _hip_hinge_angle(pose: PoseResult, hand: str, min_vis: float = 0.25) -> Optional[float]:
    """
    Hip hinge angle: shoulder_mid -> hip_mid -> drive_knee.

    Smaller angle = deeper hinge.
    Returns degrees, or None if keypoints are insufficient.
    """
    ls = _pt_norm(pose, "LEFT_SHOULDER", min_vis)
    rs = _pt_norm(pose, "RIGHT_SHOULDER", min_vis)
    lh = _pt_norm(pose, "LEFT_HIP", min_vis)
    rh = _pt_norm(pose, "RIGHT_HIP", min_vis)

    sho_mid = _mid_norm(ls, rs)
    hip_mid = _mid_norm(lh, rh)
    if sho_mid is None or hip_mid is None:
        return None

    # Drive knee (back leg)
    drive_knee_name = "RIGHT_KNEE" if hand == "R" else "LEFT_KNEE"
    dk = _pt_norm(pose, drive_knee_name, min_vis)
    if dk is None:
        return None

    # Vector hip->shoulder and hip->knee
    v_sho = (sho_mid[0] - hip_mid[0], sho_mid[1] - hip_mid[1])
    v_knee = (dk[0] - hip_mid[0], dk[1] - hip_mid[1])

    dot = v_sho[0] * v_knee[0] + v_sho[1] * v_knee[1]
    mag_a = math.sqrt(v_sho[0] ** 2 + v_sho[1] ** 2)
    mag_b = math.sqrt(v_knee[0] ** 2 + v_knee[1] ** 2)
    if mag_a < 1e-6 or mag_b < 1e-6:
        return None
    cos_a = max(-1.0, min(1.0, dot / (mag_a * mag_b)))
    return math.degrees(math.acos(cos_a))


def _detect_most_loaded(
    poses: List[PoseResult],
    hand: str,
    peak_idx: Optional[int],
    foot_strike_idx: Optional[int],
    fps: float,
) -> Optional[Phase]:
    """
    Detect the most loaded / hinged position between PLL and FS.

    Composite score: lead knee at lowest + maximum hip hinge.
    """
    n = len(poses)
    if peak_idx is None:
        return None

    start = peak_idx + 1
    end = foot_strike_idx if foot_strike_idx is not None else min(int(n * 0.85), n - 1)
    if start >= end or end - start < 2:
        return None

    lead_knee = "LEFT_KNEE" if hand == "R" else "RIGHT_KNEE"
    knee_y_raw = _get_y(poses, lead_knee)

    # Collect per-frame scores
    best_score = -1.0
    best_idx: Optional[int] = None
    hinge_values: list[Optional[float]] = []
    knee_values: list[float] = []

    for i in range(start, end + 1):
        hinge = _hip_hinge_angle(poses[i], hand)
        hinge_values.append(hinge)
        ky = knee_y_raw[i]
        knee_values.append(ky if not np.isnan(ky) else 0.0)

    # Normalize: knee_low score (higher y = lower knee in image = more loaded)
    valid_knees = [k for k in knee_values if k > 0]
    if not valid_knees:
        return None

    k_min, k_max = min(valid_knees), max(valid_knees)
    knee_range = max(k_max - k_min, 1.0)

    # Normalize: hinge score (smaller angle = deeper hinge = better)
    valid_hinges = [h for h in hinge_values if h is not None]
    if not valid_hinges:
        # Only use knee if no hinge data
        for i, ky in enumerate(knee_values):
            if ky > 0:
                score = (ky - k_min) / knee_range
                if score > best_score:
                    best_score = score
                    best_idx = start + i
    else:
        h_min, h_max = min(valid_hinges), max(valid_hinges)
        hinge_range = max(h_max - h_min, 1.0)

        for i in range(len(knee_values)):
            knee_score = (knee_values[i] - k_min) / knee_range if knee_values[i] > 0 else 0.0
            hinge = hinge_values[i]
            hinge_score = (h_max - hinge) / hinge_range if hinge is not None else 0.0
            composite = 0.5 * knee_score + 0.5 * hinge_score
            if composite > best_score:
                best_score = composite
                best_idx = start + i

    if best_idx is None:
        return None

    # Confidence
    coverage = len(valid_knees) / max(1, end - start + 1)
    hinge_coverage = len(valid_hinges) / max(1, end - start + 1)
    conf = float(np.clip(0.3 + 0.4 * coverage + 0.3 * hinge_coverage, 0.2, 0.9))

    hinge_at_best = _hip_hinge_angle(poses[best_idx], hand)
    note = f"Most loaded position (composite knee-low + hip-hinge)"
    if hinge_at_best is not None:
        note += f"; hinge={hinge_at_best:.1f}°"

    return Phase(
        name="most_loaded",
        frame_idx=poses[best_idx].frame_idx,
        time_s=poses[best_idx].frame_idx / fps,
        confidence=conf,
        note=note,
    )


# ---------------------------------------------------------------------------
# Full foot plant detector (V5 refined foot strike)
# ---------------------------------------------------------------------------

def _detect_full_foot_plant(
    poses: List[PoseResult],
    hand: str,
    search_start: int,
    search_end: int,
    fps: float,
) -> Optional[Phase]:
    """
    Detect the frame where both heel AND toe of the lead foot are grounded.

    Uses y-velocity of both HEEL and FOOT_INDEX keypoints. Full plant is the
    first frame where both have near-zero vertical velocity simultaneously
    (after a descent period).
    """
    if hand == "R":
        heel_kp, toe_kp = "LEFT_HEEL", "LEFT_FOOT_INDEX"
    else:
        heel_kp, toe_kp = "RIGHT_HEEL", "RIGHT_FOOT_INDEX"

    heel_y = _smooth(_get_y(poses, heel_kp), window=3)
    toe_y = _smooth(_get_y(poses, toe_kp), window=3)
    heel_vel = _velocity(heel_y)
    toe_vel = _velocity(toe_y)
    heel_vel_s = _smooth(heel_vel, window=3)
    toe_vel_s = _smooth(toe_vel, window=3)

    # Also track if we've seen a descent phase (either heel or toe moving down)
    saw_descent = False
    descent_threshold = 1.5  # px/frame to qualify as descending
    plant_threshold = 1.0    # px/frame to qualify as planted

    for i in range(search_start, min(search_end, len(poses) - 1)):
        hv = heel_vel_s[i] if not np.isnan(heel_vel_s[i]) else None
        tv = toe_vel_s[i] if not np.isnan(toe_vel_s[i]) else None

        # Check for descent on either keypoint
        if hv is not None and hv > descent_threshold:
            saw_descent = True
        if tv is not None and tv > descent_threshold:
            saw_descent = True

        if not saw_descent:
            continue

        # Both must be below plant threshold
        heel_planted = hv is not None and hv < plant_threshold
        toe_planted = tv is not None and tv < plant_threshold

        if heel_planted and toe_planted:
            conf = 0.80
            note = "Full foot plant (both heel and toe velocity stable)"
            return Phase(
                name="foot_strike",
                frame_idx=poses[i].frame_idx,
                time_s=poses[i].frame_idx / fps,
                confidence=conf,
                note=note,
            )

    return None


# ---------------------------------------------------------------------------
# Weight bearing detector (V5)
# ---------------------------------------------------------------------------

def _detect_weight_bearing(
    poses: List[PoseResult],
    hand: str,
    foot_strike_idx: int,
    ball_release_idx: Optional[int],
    fps: float,
) -> Optional[Phase]:
    """
    Detect when weight fully transfers to the lead leg after foot strike.

    Heuristic: hip midpoint x-position passes over (or reaches closest to)
    the lead ankle x-position.
    """
    n = len(poses)
    # Search window: foot strike to ball_release (or FS + 0.4s as wider fallback)
    end = ball_release_idx if ball_release_idx is not None else min(foot_strike_idx + int(fps * 0.4), n - 1)
    end = min(end, n - 1)
    # Ensure at least a few frames to search
    if end <= foot_strike_idx:
        end = min(foot_strike_idx + max(int(fps * 0.15), 4), n - 1)

    if foot_strike_idx >= end:
        # Last-resort fallback: FS + 3 frames
        fb_idx = min(foot_strike_idx + 3, n - 1)
        return Phase(
            name="weight_bearing",
            frame_idx=poses[fb_idx].frame_idx,
            time_s=poses[fb_idx].frame_idx / fps,
            confidence=0.35,
            note="Fallback: foot_strike + 3 frames",
            reason="phase_uncertain",
        )

    lead_ankle = "LEFT_ANKLE" if hand == "R" else "RIGHT_ANKLE"
    lead_hip = "LEFT_HIP" if hand == "R" else "RIGHT_HIP"

    best_idx: Optional[int] = None
    best_dist = float("inf")

    for i in range(foot_strike_idx, end + 1):
        lh = _pt_norm(poses[i], "LEFT_HIP")
        rh = _pt_norm(poses[i], "RIGHT_HIP")
        hip_mid = _mid_norm(lh, rh)
        ankle = _pt_norm(poses[i], lead_ankle)

        if hip_mid is None or ankle is None:
            continue

        dist = abs(hip_mid[0] - ankle[0])
        if dist < best_dist:
            best_dist = dist
            best_idx = i

    if best_idx is None:
        # Fallback B: lead hip velocity drops (forward momentum absorbed).
        lead_hip_x = _get_x(poses, lead_hip)
        hip_vel = np.abs(_velocity(lead_hip_x))
        hip_vel_s = _smooth(hip_vel, window=3)
        for i in range(foot_strike_idx + 1, end + 1):
            if np.isnan(hip_vel_s[i]):
                continue
            if hip_vel_s[i] < 0.8:  # hip x-velocity drops below threshold
                best_idx = i
                best_dist = -1.0  # sentinel for velocity method
                break

    if best_idx is None:
        # Fallback C: fixed offset
        fb_idx = min(foot_strike_idx + 3, n - 1)
        return Phase(
            name="weight_bearing",
            frame_idx=poses[fb_idx].frame_idx,
            time_s=poses[fb_idx].frame_idx / fps,
            confidence=0.30,
            note="Fallback: foot_strike + 3 frames (hip/ankle keypoints unavailable)",
            reason="phase_uncertain",
        )

    if best_dist < 0:
        # Velocity-based detection
        conf = 0.55
        note = "Lead hip velocity drop after foot strike"
    else:
        conf = 0.70
        note = f"Hip midpoint closest to lead ankle (Δx={best_dist:.3f} norm)"
    return Phase(
        name="weight_bearing",
        frame_idx=poses[best_idx].frame_idx,
        time_s=poses[best_idx].frame_idx / fps,
        confidence=conf,
        note=note,
    )


# ---------------------------------------------------------------------------
# Arm flip-up detector (V5)
# ---------------------------------------------------------------------------

def _detect_arm_flip_up(
    poses: List[PoseResult],
    hand: str,
    search_start: int,
    search_end: int,
    fps: float,
) -> Optional[Phase]:
    """
    Detect when the throwing arm reaches the cocked position.

    The forearm (elbow -> wrist) transitions from below shoulder to above.
    We detect the first frame where the forearm angle exceeds 45° above
    shoulder height.
    """
    throw_sho = "RIGHT_SHOULDER" if hand == "R" else "LEFT_SHOULDER"
    throw_elb = "RIGHT_ELBOW" if hand == "R" else "LEFT_ELBOW"
    throw_wri = "RIGHT_WRIST" if hand == "R" else "LEFT_WRIST"

    for i in range(search_start, min(search_end, len(poses))):
        sho = _pt_norm(poses[i], throw_sho)
        elb = _pt_norm(poses[i], throw_elb)
        wri = _pt_norm(poses[i], throw_wri)

        if sho is None or elb is None or wri is None:
            continue

        # Forearm vector: elbow -> wrist
        fa_dx = wri[0] - elb[0]
        fa_dy = wri[1] - elb[1]  # image space: +y is down

        # The wrist being ABOVE the elbow means fa_dy < 0 in image space.
        # Angle above horizontal: atan2(-fa_dy, |fa_dx|)
        angle_above_horiz = math.degrees(math.atan2(-fa_dy, abs(fa_dx) + 1e-9))

        # Also check wrist is above shoulder level (wri y < sho y in image)
        wrist_above_shoulder = wri[1] < sho[1]

        if angle_above_horiz >= 45.0 and wrist_above_shoulder:
            # Check visibility confidence
            vis = min(
                poses[i].visibility(throw_sho),
                poses[i].visibility(throw_elb),
                poses[i].visibility(throw_wri),
            )
            conf = float(np.clip(0.4 + 0.5 * vis, 0.3, 0.85))
            return Phase(
                name="arm_flip_up",
                frame_idx=poses[i].frame_idx,
                time_s=poses[i].frame_idx / fps,
                confidence=conf,
                note=f"Forearm at {angle_above_horiz:.1f}° above horizontal (wrist above shoulder)",
            )

    return None


# ---------------------------------------------------------------------------
# Phase detectors
# ---------------------------------------------------------------------------

def _anchor_to_pose_idx(
    poses: List[PoseResult],
    time_s: float,
    fps: float,
) -> int:
    """Convert a timestamp (seconds) to the nearest pose list index."""
    target_frame = round(time_s * fps)
    best_idx = 0
    best_dist = abs(poses[0].frame_idx - target_frame)
    for i, p in enumerate(poses):
        d = abs(p.frame_idx - target_frame)
        if d < best_dist:
            best_dist = d
            best_idx = i
    return best_idx


def detect_phases(
    poses: List[PoseResult],
    fps: float,
    hand: str = "R",
    debug: bool = False,
    phase_anchors: Optional[Dict[str, float]] = None,
) -> PitchPhases:
    """
    Detect pitch phases from a sequence of PoseResults.

    Args:
        poses: One PoseResult per frame, in frame order.
        fps:   Video frame rate.
        hand:  Pitcher throwing hand — "R" (default) or "L".
        debug: Print phase frame indices to stdout.
        phase_anchors: Optional dict of manual phase timestamps in seconds.
            Supported keys: "peak_leg_lift_s", "foot_strike_s", "ball_release_s".
            When provided, the anchor overrides auto-detection for that phase
            (confidence=1.0) and provides correct boundaries to downstream
            phase detectors.

    Returns:
        PitchPhases with best-guess frame indices and timestamps.
        Any undetected phase is None.
    """
    n = len(poses)
    if n < 5:
        return PitchPhases(None, None, None, None, None, None, None, None, fps)

    anchors = phase_anchors or {}

    # Handedness-dependent keypoints.
    # Lead leg = the leg stepping toward home plate.
    if hand == "R":
        lead_knee, lead_ankle = "LEFT_KNEE", "LEFT_ANKLE"
        lead_hip               = "LEFT_HIP"
    else:
        lead_knee, lead_ankle = "RIGHT_KNEE", "RIGHT_ANKLE"
        lead_hip               = "RIGHT_HIP"

    throw_wrist = "RIGHT_WRIST" if hand == "R" else "LEFT_WRIST"

    # Build pixel series
    knee_y_raw   = _get_y(poses, lead_knee)
    ankle_y_raw  = _get_y(poses, lead_ankle)
    hip_y_raw    = _get_y(poses, lead_hip)
    wrist_x_raw  = _get_x(poses, throw_wrist)
    wrist_y_raw  = _get_y(poses, throw_wrist)

    # Smoothed versions for stable velocity estimates
    knee_y  = _smooth(knee_y_raw, window=5)
    ankle_y = _smooth(ankle_y_raw, window=5)
    wrist_x = _smooth(wrist_x_raw, window=3)
    wrist_y = _smooth(wrist_y_raw, window=3)

    # ---- SET ----------------------------------------------------------------
    # Primary: motion-energy delivery-start detector.
    # Fallback: stillest frame in the first third of the clip.
    delivery_start = _detect_delivery_start(poses, fps=fps)

    set_idx = 0  # fallback
    set_phase: Optional[Phase] = None
    if delivery_start is not None:
        set_idx = delivery_start
        # Determine if there is an idle prefix before delivery start.
        # If the clip starts with motion (no idle), confidence is lower.
        idle_frames = set_idx  # frames before delivery start
        idle_ratio = idle_frames / max(1, n)
        if idle_ratio >= 0.10:
            set_conf = 0.85
            set_reason = ""
            set_note = "Delivery start transition (idle -> motion) from robust motion energy"
        else:
            set_conf = 0.60
            set_reason = "low_motion"
            set_note = "Delivery start detected but minimal idle prefix (clip may start mid-motion)"
        set_phase = Phase(
            name="set",
            frame_idx=poses[set_idx].frame_idx,
            time_s=poses[set_idx].frame_idx / fps,
            confidence=set_conf,
            note=set_note,
            reason=set_reason,
        )
    else:
        # Fallback: min ankle motion in first third
        left_ankle_y  = _get_y(poses, "LEFT_ANKLE")
        right_ankle_y = _get_y(poses, "RIGHT_ANKLE")
        ankle_motion = _velocity(left_ankle_y) + _velocity(right_ankle_y)

        set_end = max(5, n // 3)
        set_region = ankle_motion[:set_end]

        if not np.all(np.isnan(set_region)):
            set_idx = int(np.nanargmin(set_region))
            set_phase = Phase(
                name="set",
                frame_idx=poses[set_idx].frame_idx,
                time_s=poses[set_idx].frame_idx / fps,
                confidence=0.30,
                note="Fallback: most-still frame in first third (min ankle motion)",
                reason="low_motion",
            )

    # ---- FIRST MOVEMENT -----------------------------------------------------
    # Primary: use delivery_start directly if available.
    # Fallback: first frame where lead knee moves upward faster than threshold.
    first_move_idx: Optional[int] = None
    first_move_phase: Optional[Phase] = None

    if delivery_start is not None:
        first_move_idx = delivery_start
        first_move_phase = Phase(
            name="first_movement",
            frame_idx=poses[first_move_idx].frame_idx,
            time_s=poses[first_move_idx].frame_idx / fps,
            confidence=0.82,
            note="Matches SET delivery-start transition",
            reason="",
        )
    else:
        # Fallback: knee velocity scan
        knee_vel = np.gradient(np.nan_to_num(knee_y, nan=knee_y[set_idx] if not np.isnan(knee_y[set_idx]) else 0.0))
        for i in range(set_idx + 1, n - 1):
            if knee_vel[i] < -1.5:  # 1.5 px/frame upward
                first_move_idx = i
                break

        if first_move_idx is not None:
            first_move_phase = Phase(
                name="first_movement",
                frame_idx=poses[first_move_idx].frame_idx,
                time_s=poses[first_move_idx].frame_idx / fps,
                confidence=0.65,
                note="Lead knee first moves upward at > 1.5 px/frame",
                reason="phase_uncertain",
            )

    # ---- PEAK LEG LIFT -------------------------------------------------------
    # Initial estimate before foot-strike is known.
    search_start = first_move_idx if first_move_idx is not None else set_idx + 1
    search_end   = min(int(n * 0.75), n - 1)

    peak_idx: Optional[int] = None
    peak_phase: Optional[Phase] = None
    if search_start < search_end:
        knee_patch = knee_y[search_start:search_end]
        if not np.all(np.isnan(knee_patch)):
            local_peak = int(np.nanargmin(knee_patch))
            peak_idx = search_start + local_peak

            knee_y_at_peak = knee_y[peak_idx]
            hip_y_at_peak  = hip_y_raw[peak_idx] if not np.isnan(hip_y_raw[peak_idx]) else knee_y_at_peak + 50
            lift_px = hip_y_at_peak - knee_y_at_peak   # positive = knee above hip
            conf = float(np.clip(lift_px / 80.0, 0.0, 1.0))

            peak_phase = Phase(
                name="peak_leg_lift",
                frame_idx=poses[peak_idx].frame_idx,
                time_s=poses[peak_idx].frame_idx / fps,
                confidence=conf,
                note=f"Lead knee at highest point ({lift_px:.0f}px above hip)",
            )

    # Apply manual PLL anchor if provided.
    if "peak_leg_lift_s" in anchors:
        peak_idx = _anchor_to_pose_idx(poses, anchors["peak_leg_lift_s"], fps)
        peak_phase = Phase(
            name="peak_leg_lift",
            frame_idx=poses[peak_idx].frame_idx,
            time_s=poses[peak_idx].frame_idx / fps,
            confidence=1.0,
            note="Manual anchor",
        )

    # ---- FOOT STRIKE ---------------------------------------------------------
    # V5 primary: full foot plant (both heel and toe grounded).
    # Fallbacks: ankle velocity drop, knee velocity drop, min velocity.
    ankle_vel  = _velocity(ankle_y)
    ankle_vel_s = _smooth(ankle_vel, window=3)

    foot_strike_idx: Optional[int] = None
    foot_strike_phase: Optional[Phase] = None
    fs_search_start = (peak_idx + 1) if peak_idx is not None else (set_idx + n // 4)
    fs_reason = ""

    # Primary (V5): full foot plant — both heel and toe stable.
    full_plant = _detect_full_foot_plant(
        poses, hand=hand,
        search_start=fs_search_start,
        search_end=min(int(n * 0.92), n - 1),
        fps=fps,
    )
    if full_plant is not None:
        foot_strike_phase = full_plant
        # Resolve list index from frame_idx
        for idx_i, p in enumerate(poses):
            if p.frame_idx == full_plant.frame_idx:
                foot_strike_idx = idx_i
                break
        if foot_strike_idx is None:
            foot_strike_idx = min(
                range(len(poses)),
                key=lambda j: abs(poses[j].frame_idx - full_plant.frame_idx),
            )
    else:
        # Fallback 1: ankle velocity drop.
        in_descent = False
        for i in range(fs_search_start, n - 2):
            v = ankle_vel_s[i]
            if np.isnan(v):
                continue
            if v > 2.0:
                in_descent = True
            if in_descent and v < 1.5:
                foot_strike_idx = i
                break

        # Fallback 2: lead knee velocity drop (robustness when ankle is occluded).
        if foot_strike_idx is None:
            knee_vel = _velocity(knee_y)
            knee_vel_s = _smooth(knee_vel, window=3)
            in_descent_knee = False
            for i in range(fs_search_start, n - 2):
                v = knee_vel_s[i]
                if np.isnan(v):
                    continue
                if v > 1.5:
                    in_descent_knee = True
                if in_descent_knee and v < 1.0:
                    foot_strike_idx = i
                    fs_reason = "occluded"
                    break

        # Fallback 3: minimum ankle velocity in the second half.
        if foot_strike_idx is None:
            fb_start = fs_search_start
            fb_end   = min(int(n * 0.88), n - 1)
            if fb_start < fb_end:
                patch = ankle_vel_s[fb_start:fb_end]
                if not np.all(np.isnan(patch)):
                    foot_strike_idx = fb_start + int(np.nanargmin(patch))
                    fs_reason = "phase_uncertain"

        if foot_strike_idx is not None:
            # Compute confidence based on detection method.
            if fs_reason == "":
                fs_conf = 0.70
                fs_note = "Lead ankle velocity drops (foot contacts ground)"
            elif fs_reason == "occluded":
                fs_conf = 0.50
                fs_note = "Lead knee velocity fallback (ankle occluded)"
            else:
                fs_conf = 0.40
                fs_note = "Min ankle velocity fallback (no clean deceleration found)"
            foot_strike_phase = Phase(
                name="foot_strike",
                frame_idx=poses[foot_strike_idx].frame_idx,
                time_s=poses[foot_strike_idx].frame_idx / fps,
                confidence=fs_conf,
                note=fs_note,
                reason=fs_reason,
            )

    # Apply manual FS anchor if provided.
    if "foot_strike_s" in anchors:
        foot_strike_idx = _anchor_to_pose_idx(poses, anchors["foot_strike_s"], fps)
        foot_strike_phase = Phase(
            name="foot_strike",
            frame_idx=poses[foot_strike_idx].frame_idx,
            time_s=poses[foot_strike_idx].frame_idx / fps,
            confidence=1.0,
            note="Manual anchor",
        )

    # Refine PLL for open-side robustness in the final SET→FS window.
    # Confidence remains non-zero for sparse but present knee observations.
    # Skip refinement if PLL was manually anchored.
    if "peak_leg_lift_s" not in anchors:
        robust_peak = _detect_peak_leg_lift_open_side(
            poses=poses,
            knee_y_raw=knee_y_raw,
            hip_y_raw=hip_y_raw,
            set_idx=set_idx,
            first_move_idx=first_move_idx,
            foot_strike_idx=foot_strike_idx,
            fps=fps,
        )
        if robust_peak is not None:
            peak_phase = robust_peak
            if peak_idx is None:
                mapped_idx = None
                for i, p in enumerate(poses):
                    if p.frame_idx == robust_peak.frame_idx:
                        mapped_idx = i
                        break
                if mapped_idx is None:
                    mapped_idx = max(0, min(n - 1, int(robust_peak.frame_idx)))
                peak_idx = mapped_idx

    # ---- BALL RELEASE --------------------------------------------------------
    # Heuristic: peak throwing wrist speed after foot strike.
    # CAVEAT: motion blur during arm acceleration makes this noisy.
    # A ball-tracking model would be much more accurate.
    wrist_spd = np.sqrt(
        np.nan_to_num(_velocity(wrist_x)) ** 2 +
        np.nan_to_num(_velocity(wrist_y)) ** 2
    )
    wrist_spd_s = _smooth(wrist_spd, window=3)

    ball_release_phase: Optional[Phase] = None
    release_idx: Optional[int] = None

    # Apply manual ball release anchor if provided.
    if "ball_release_s" in anchors:
        release_idx = _anchor_to_pose_idx(poses, anchors["ball_release_s"], fps)
        ball_release_phase = Phase(
            name="ball_release",
            frame_idx=poses[release_idx].frame_idx,
            time_s=poses[release_idx].frame_idx / fps,
            confidence=1.0,
            note="Manual anchor",
        )

    # Auto-detect ball release only if not manually anchored.
    if ball_release_phase is None:
        # Enforce minimum offset from foot strike: release must be at least 2 frames after FS
        min_rel_offset = 2
        rel_search_start = foot_strike_idx + min_rel_offset if foot_strike_idx is not None else (
            peak_idx if peak_idx is not None else n // 2
        )
        if rel_search_start < n:
            patch = wrist_spd_s[rel_search_start:]
            if not np.all(np.isnan(patch)) and np.nanmax(patch) > 0:
                local_peak = int(np.nanargmax(patch))
                release_idx = rel_search_start + local_peak
                peak_speed = float(np.nanmax(patch))

                # Assess wrist tracking quality: check visibility at release.
                wrist_vis = poses[release_idx].visibility(throw_wrist) if release_idx < len(poses) else 0.0
                if wrist_vis >= 0.5 and peak_speed > 3.0:
                    rel_conf = 0.60
                    rel_note = "Throwing wrist peak speed with good visibility"
                    rel_reason = ""
                elif wrist_vis >= 0.3:
                    rel_conf = 0.45
                    rel_note = "Throwing wrist peak speed (moderate visibility; motion blur likely)"
                    rel_reason = "occluded"
                else:
                    rel_conf = 0.30
                    rel_note = "Throwing wrist peak speed (low visibility; use ball tracker for accuracy)"
                    rel_reason = "occluded"

                ball_release_phase = Phase(
                    name="ball_release",
                    frame_idx=poses[release_idx].frame_idx,
                    time_s=poses[release_idx].frame_idx / fps,
                    confidence=rel_conf,
                    note=rel_note,
                    reason=rel_reason,
                )

    # ---- MOST LOADED (V5) ----------------------------------------------------
    most_loaded_phase = _detect_most_loaded(
        poses, hand=hand,
        peak_idx=peak_idx,
        foot_strike_idx=foot_strike_idx,
        fps=fps,
    )

    # ---- WEIGHT BEARING (V5) -------------------------------------------------
    weight_bearing_phase: Optional[Phase] = None
    if foot_strike_idx is not None:
        weight_bearing_phase = _detect_weight_bearing(
            poses, hand=hand,
            foot_strike_idx=foot_strike_idx,
            ball_release_idx=release_idx,
            fps=fps,
        )

    # ---- ARM FLIP-UP (V5) ----------------------------------------------------
    # Arm doesn't reach cocked position until well into the stride, so search
    # AFTER peak leg lift (not first_movement). Starting at PLL+1 avoids
    # false positives from windup arm elevation at PLL.
    arm_flip_search_start = (peak_idx + 1) if peak_idx is not None else (
        first_move_idx if first_move_idx is not None else set_idx
    )
    arm_flip_search_end = release_idx if release_idx is not None else (
        foot_strike_idx + int(fps * 0.2) if foot_strike_idx is not None else int(n * 0.85)
    )
    arm_flip_phase = _detect_arm_flip_up(
        poses, hand=hand,
        search_start=arm_flip_search_start,
        search_end=min(arm_flip_search_end, n),
        fps=fps,
    )

    if debug:
        def _fmt(p: Optional[Phase]) -> str:
            if p is None:
                return "NOT DETECTED"
            return f"frame {p.frame_idx:4d}  t={p.time_s:.3f}s  conf={p.confidence:.2f}"

        print(f"  set           : {_fmt(set_phase)}")
        print(f"  first_movement: {_fmt(first_move_phase)}")
        print(f"  peak_leg_lift : {_fmt(peak_phase)}")
        print(f"  most_loaded   : {_fmt(most_loaded_phase)}")
        print(f"  foot_strike   : {_fmt(foot_strike_phase)}")
        print(f"  weight_bearing: {_fmt(weight_bearing_phase)}")
        print(f"  arm_flip_up   : {_fmt(arm_flip_phase)}")
        print(f"  ball_release  : {_fmt(ball_release_phase)}")

    return PitchPhases(
        set_pos=set_phase,
        first_movement=first_move_phase,
        peak_leg_lift=peak_phase,
        most_loaded=most_loaded_phase,
        foot_strike=foot_strike_phase,
        weight_bearing=weight_bearing_phase,
        arm_flip_up=arm_flip_phase,
        ball_release=ball_release_phase,
        fps=fps,
    )
