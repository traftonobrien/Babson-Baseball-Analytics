"""
Pitch phase detection using heuristic analysis of pose keypoint sequences.

WHAT THIS MODULE DOES:
  Identifies five key moments in a pitch from the keypoint time series.
  Each detector uses a simple rule (min/max value, velocity threshold,
  velocity drop) on one or two keypoints. No ML model is trained here —
  these are all hand-written rules.

PHASES (in order):
  set           - pitcher is still in the set/windup position
  first_movement - first detectable motion (weight shift / leg lift start)
  peak_leg_lift  - lead knee at maximum height above hip
  foot_strike    - lead foot contacts the ground
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
from typing import List, Optional

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
    foot_strike: Optional[Phase]
    ball_release: Optional[Phase]
    fps: float

    def to_dict(self) -> dict:
        return {
            "set": self.set_pos.to_dict() if self.set_pos else None,
            "first_movement": self.first_movement.to_dict() if self.first_movement else None,
            "peak_leg_lift": self.peak_leg_lift.to_dict() if self.peak_leg_lift else None,
            "foot_strike": self.foot_strike.to_dict() if self.foot_strike else None,
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
# Phase detectors
# ---------------------------------------------------------------------------

def detect_phases(
    poses: List[PoseResult],
    fps: float,
    hand: str = "R",
    debug: bool = False,
) -> PitchPhases:
    """
    Detect pitch phases from a sequence of PoseResults.

    Args:
        poses: One PoseResult per frame, in frame order.
        fps:   Video frame rate.
        hand:  Pitcher throwing hand — "R" (default) or "L".
        debug: Print phase frame indices to stdout.

    Returns:
        PitchPhases with best-guess frame indices and timestamps.
        Any undetected phase is None.
    """
    n = len(poses)
    if n < 5:
        return PitchPhases(None, None, None, None, None, fps)

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

    # ---- FOOT STRIKE ---------------------------------------------------------
    # Heuristic: ankle velocity drops below threshold after a descent phase.
    # The lead foot descends fast, then abruptly slows when it hits the ground.
    # Improvement: also use lead knee as fallback when ankle is occluded.
    ankle_vel  = _velocity(ankle_y)
    ankle_vel_s = _smooth(ankle_vel, window=3)

    foot_strike_idx: Optional[int] = None
    foot_strike_phase: Optional[Phase] = None
    fs_search_start = (peak_idx + 1) if peak_idx is not None else (set_idx + n // 4)
    fs_reason = ""

    # Primary: ankle velocity drop.
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

    # Fallback 1: lead knee velocity drop (robustness when ankle is occluded).
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

    # Fallback 2: minimum ankle velocity in the second half.
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

    # Refine PLL for open-side robustness in the final SET→FS window.
    # Confidence remains non-zero for sparse but present knee observations.
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
    rel_search_start = foot_strike_idx if foot_strike_idx is not None else (
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

    if debug:
        def _fmt(p: Optional[Phase]) -> str:
            if p is None:
                return "NOT DETECTED"
            return f"frame {p.frame_idx:4d}  t={p.time_s:.3f}s  conf={p.confidence:.2f}"

        print(f"  set           : {_fmt(set_phase)}")
        print(f"  first_movement: {_fmt(first_move_phase)}")
        print(f"  peak_leg_lift : {_fmt(peak_phase)}")
        print(f"  foot_strike   : {_fmt(foot_strike_phase)}")
        print(f"  ball_release  : {_fmt(ball_release_phase)}")

    return PitchPhases(
        set_pos=set_phase,
        first_movement=first_move_phase,
        peak_leg_lift=peak_phase,
        foot_strike=foot_strike_phase,
        ball_release=ball_release_phase,
        fps=fps,
    )
