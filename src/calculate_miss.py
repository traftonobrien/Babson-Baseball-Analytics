"""Calculate miss distance between ball and glove target position."""

import argparse
import os
import numpy as np
import yaml


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def glove_centroid(mask):
    """Compute the centroid (x, y) of a binary mask."""
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return float(xs.mean()), float(ys.mean())


def calculate_miss(ball_positions, glove_target):
    """
    Compute per-frame distance between ball center and a fixed glove target position.

    Args:
        ball_positions: dict {frame_idx: {"x", "y", "radius"}}
        glove_target: (x, y) fixed target position

    Returns:
        list of dicts with frame, distance_px, ball, glove fields.
    """
    results = []
    for idx in sorted(ball_positions.keys()):
        bp = ball_positions[idx]
        dx = bp["x"] - glove_target[0]
        dy = bp["y"] - glove_target[1]
        dist = np.hypot(dx, dy)
        results.append({
            "frame": idx,
            "distance_px": float(dist),
            "dx_px": float(dx),
            "dy_px": float(dy),
            "ball": (bp["x"], bp["y"]),
            "glove": glove_target,
        })
    return results


def find_arrival_frame(ball_positions):
    """Find the last frame where the ball is detected before it disappears."""
    if not ball_positions:
        return None
    frames = sorted(ball_positions.keys())
    return frames[-1]


def find_closest_approach(results):
    """Return the frame with minimum ball-to-glove distance."""
    if not results:
        return None
    return min(results, key=lambda r: r["distance_px"])


def get_zone_bounds(glove_target, ppi, zone_height=23):
    """Compute strike zone pixel bounds. Returns (left, top, right, bottom) or None."""
    if glove_target is None or ppi is None:
        return None
    zone_w = int(17 * ppi)
    zone_h = int(zone_height * ppi)
    cx, cy = int(glove_target[0]), int(glove_target[1])
    zone_bottom = cy + int(zone_h / 3)
    zone_top = zone_bottom - zone_h
    return (cx - zone_w // 2, zone_top, cx + zone_w // 2, zone_bottom)


def classify_quadrant(px, py, zone_bounds, pitcher_hand="R"):
    """Classify a point into a 9-box zone quadrant."""
    if zone_bounds is None:
        return None
    left, top, right, bottom = zone_bounds
    zone_w = right - left
    zone_h = bottom - top
    col_w = zone_w / 3
    row_h = zone_h / 3

    rel_x = px - left
    if rel_x < 0 or rel_x > zone_w:
        return None
    col = min(int(rel_x / col_w), 2)

    rel_y = py - top
    if rel_y < 0 or rel_y > zone_h:
        return None
    row = min(int(rel_y / row_h), 2)

    row_labels = ["Up", "Middle", "Down"]
    row_codes = ["U", "M", "D"]
    if pitcher_hand == "R":
        col_labels = ["In", "Middle", "Away"]
        col_codes = ["I", "M", "A"]
    else:
        col_labels = ["Away", "Middle", "In"]
        col_codes = ["A", "M", "I"]

    code = row_codes[row] + col_codes[col]
    label = f"{row_labels[row]}-{col_labels[col]}"
    return code, label


def load_glove_masks(output_dir):
    """Load glove masks from .npz (preferred) or .npy (legacy)."""
    npz_path = os.path.join(output_dir, "glove_masks.npz")
    npy_path = os.path.join(output_dir, "glove_masks.npy")
    if os.path.exists(npz_path):
        data = np.load(npz_path)
        return {int(k): data[k] for k in data.files}
    return np.load(npy_path, allow_pickle=True).item()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calculate miss distance")
    parser.add_argument("--target-frame", type=int, default=60,
                        help="Frame where the catcher's glove is set up as the target (default: 60)")
    parser.add_argument("--arrival-frame", type=int, default=None,
                        help="Override the ball arrival frame (default: auto-detect as last ball detection)")
    parser.add_argument("--pitcher-hand", choices=["R", "L"], default="R",
                        help="Pitcher handedness for arm-side/glove-side labels (default: R)")
    parser.add_argument("--zone-height", type=float, default=23,
                        help="Strike zone height in inches for quadrant classification (default: 23)")
    parser.add_argument("--pitcher-name", type=str, default=None,
                        help="Pitcher name (for CSV export)")
    parser.add_argument("--pitch-type", type=str, default=None,
                        help="Pitch type (for CSV export)")
    parser.add_argument("--export-csv", type=str, default=None,
                        help="Append results to this CSV file")
    args = parser.parse_args()

    config = load_config()
    output_dir = config["paths"]["output_dir"]
    ppi = config["calibration"].get("pixels_per_inch")

    ball_positions = np.load(
        os.path.join(output_dir, "ball_positions.npy"), allow_pickle=True
    ).item()
    glove_masks = load_glove_masks(output_dir)

    # Lock glove target from the specified setup frame
    target_frame = args.target_frame
    if target_frame not in glove_masks:
        # Find nearest available frame
        available = sorted(glove_masks.keys())
        target_frame = min(available, key=lambda f: abs(f - args.target_frame))
        print(f"Target frame {args.target_frame} not available, using nearest: {target_frame}")

    glove_target = glove_centroid(glove_masks[target_frame])
    if glove_target is None:
        print(f"No glove detected in target frame {target_frame}")
        exit(1)

    print(f"Glove target locked from frame {target_frame}: ({glove_target[0]:.0f}, {glove_target[1]:.0f})")

    results = calculate_miss(ball_positions, glove_target)
    closest = find_closest_approach(results)

    # Determine arrival frame
    if args.arrival_frame is not None:
        arrival_idx = args.arrival_frame
        # Use exact frame if ball detected there, otherwise nearest prior detection
        if arrival_idx not in ball_positions:
            prior = [f for f in sorted(ball_positions.keys()) if f <= arrival_idx]
            if prior:
                arrival_idx = prior[-1]
                print(f"Arrival frame {args.arrival_frame} has no ball detection, using nearest prior: {arrival_idx}")
            else:
                arrival_idx = find_arrival_frame(ball_positions)
                print(f"No ball detection at or before frame {args.arrival_frame}, falling back to auto: {arrival_idx}")
    else:
        arrival_idx = find_arrival_frame(ball_positions)

    arrival_result = next((r for r in results if r["frame"] == arrival_idx), None)

    # For RHP: positive dx (ball right of target in image) = arm-side
    # For LHP: flip the sign
    # Center field camera: left in image = toward 3B, right = toward 1B
    # RHP: dx > 0 (right/1B) = arm-side, dx < 0 (left/3B) = glove-side
    # LHP: flipped
    arm_sign = 1 if args.pitcher_hand == "R" else -1

    print("=== Pitch Summary ===")
    if arrival_result:
        dist_px = arrival_result["distance_px"]
        dx = arrival_result["dx_px"]
        dy = arrival_result["dy_px"]
        print(f"Arrival frame: {arrival_idx}")

        # Total miss
        if ppi:
            print(f"Total miss: {dist_px / ppi:.1f} inches")
        else:
            print(f"Total miss: {dist_px:.1f} px")

        # Horizontal breakdown
        h_label = "arm-side" if dx * arm_sign > 0 else "glove-side"
        if ppi:
            print(f"Horizontal: {abs(dx) / ppi:.1f} inches ({h_label})")
        else:
            print(f"Horizontal: {abs(dx):.1f} px ({h_label})")

        # Vertical breakdown (positive dy = lower in image = low pitch)
        v_label = "high" if dy < 0 else "low"
        if ppi:
            print(f"Vertical: {abs(dy) / ppi:.1f} inches ({v_label})")
        else:
            print(f"Vertical: {abs(dy):.1f} px ({v_label})")

        # Target quadrant
        zone_bounds = get_zone_bounds(glove_target, ppi, args.zone_height)
        tq = classify_quadrant(glove_target[0], glove_target[1],
                               zone_bounds, args.pitcher_hand)
        if tq:
            print(f"Target: {tq[1]} ({tq[0]})")

        # Miss direction
        miss_dir_h = "Arm" if dx * arm_sign > 0 else "Glove"
        miss_dir_v = "High" if dy < 0 else "Low"
        print(f"Result: {miss_dir_v}-{miss_dir_h} (missed {v_label} and {h_label})")
    else:
        print(f"Arrival frame: {arrival_idx} (no ball data at this frame)")

    if closest:
        dist_px = closest["distance_px"]
        print(f"Closest approach: frame {closest['frame']}, {dist_px:.1f} px", end="")
        if ppi:
            print(f" ({dist_px / ppi:.1f} in)")
        else:
            print()

    if not results:
        print("No ball detections found.")

    np.save(os.path.join(output_dir, "miss_results.npy"), results)

    # CSV export
    if args.export_csv and arrival_result:
        from export_csv import build_row, write_row, next_pitch_number
        pitch_number = next_pitch_number(args.export_csv)
        row = build_row(
            pitcher_name=args.pitcher_name,
            pitcher_hand=args.pitcher_hand,
            pitch_type=args.pitch_type,
            target_frame=target_frame,
            arrival_frame=arrival_idx,
            glove_target=glove_target,
            ball_pos=ball_positions[arrival_idx],
            ppi=ppi,
            zone_height=args.zone_height,
            fps=config["video"].get("fps", 30),
            pitch_number=pitch_number,
        )
        write_row(args.export_csv, row, append=True)
        print(f"Appended pitch #{pitch_number} to {args.export_csv}")
