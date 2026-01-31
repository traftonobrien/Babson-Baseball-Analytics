"""Export pitch miss data to CSV for analysis."""

import argparse
import csv
import os
import numpy as np
import yaml


CSV_COLUMNS = [
    "pitch_number", "pitcher_name", "pitcher_hand", "pitch_type",
    "target_frame", "arrival_frame",
    "target_x", "target_y", "ball_x", "ball_y",
    "total_miss_px", "total_miss_inches",
    "h_miss_px", "h_miss_inches", "h_direction", "h_miss_signed",
    "v_miss_px", "v_miss_inches", "v_direction", "v_miss_signed",
    "target_quadrant", "result_quadrant", "target_zone", "timestamp",
]


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def glove_centroid(mask):
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return float(xs.mean()), float(ys.mean())


def load_glove_masks(output_dir):
    npz_path = os.path.join(output_dir, "glove_masks.npz")
    npy_path = os.path.join(output_dir, "glove_masks.npy")
    if os.path.exists(npz_path):
        data = np.load(npz_path)
        return {int(k): data[k] for k in data.files}
    return np.load(npy_path, allow_pickle=True).item()


def get_zone_bounds(glove_target, ppi, zone_height=23):
    if glove_target is None or ppi is None:
        return None
    zone_w = int(17 * ppi)
    zone_h = int(zone_height * ppi)
    cx, cy = int(glove_target[0]), int(glove_target[1])
    zone_bottom = cy + int(zone_h / 3)
    zone_top = zone_bottom - zone_h
    return (cx - zone_w // 2, zone_top, cx + zone_w // 2, zone_bottom)


def classify_quadrant(px, py, zone_bounds, pitcher_hand="R"):
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

    row_codes = ["U", "M", "D"]
    if pitcher_hand == "R":
        col_codes = ["I", "M", "A"]
    else:
        col_codes = ["A", "M", "I"]

    return row_codes[row] + col_codes[col]


def classify_target_zone(target_x, ppi, plate_center_x, pitcher_hand="R"):
    """Classify horizontal target zone as inside/middle/outside.

    Divides the 17-inch plate into thirds.
    For RHP: left third = inside, right third = outside.
    For LHP: flipped.
    """
    if ppi is None or plate_center_x is None:
        return ""
    half_plate = 8.5 * ppi
    plate_left = plate_center_x - half_plate
    third_width = (2 * half_plate) / 3

    if target_x < plate_left + third_width:
        zone = "inside" if pitcher_hand == "R" else "outside"
    elif target_x < plate_left + 2 * third_width:
        zone = "middle"
    else:
        zone = "outside" if pitcher_hand == "R" else "inside"
    return zone


def next_pitch_number(csv_path):
    """Read existing CSV and return the next pitch number."""
    if not os.path.exists(csv_path):
        return 1
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        nums = [int(row["pitch_number"]) for row in reader if row.get("pitch_number")]
    return max(nums, default=0) + 1


def build_row(pitcher_name, pitcher_hand, pitch_type, target_frame, arrival_frame,
              glove_target, ball_pos, ppi, zone_height=23, fps=30, pitch_number=1,
              plate_center_x=None):
    """Build a single CSV row dict from pitch data."""
    dx = ball_pos["x"] - glove_target[0]
    dy = ball_pos["y"] - glove_target[1]
    dist = np.hypot(dx, dy)

    arm_sign = 1 if pitcher_hand == "R" else -1
    h_direction = "arm-side" if dx * arm_sign > 0 else "glove-side"
    v_direction = "high" if dy < 0 else "low"

    # Signed miss: negative = arm-side / high, positive = glove-side / low
    h_signed_px = -abs(dx) if h_direction == "arm-side" else abs(dx)
    v_signed_px = -abs(dy) if v_direction == "high" else abs(dy)

    zone_bounds = get_zone_bounds(glove_target, ppi, zone_height)
    tq = classify_quadrant(glove_target[0], glove_target[1], zone_bounds, pitcher_hand)
    rq = classify_quadrant(ball_pos["x"], ball_pos["y"], zone_bounds, pitcher_hand)

    target_zone = classify_target_zone(
        glove_target[0], ppi, plate_center_x, pitcher_hand)

    row = {
        "pitch_number": pitch_number,
        "pitcher_name": pitcher_name or "",
        "pitcher_hand": pitcher_hand,
        "pitch_type": pitch_type or "",
        "target_frame": target_frame,
        "arrival_frame": arrival_frame,
        "target_x": f"{glove_target[0]:.1f}",
        "target_y": f"{glove_target[1]:.1f}",
        "ball_x": f"{ball_pos['x']:.1f}",
        "ball_y": f"{ball_pos['y']:.1f}",
        "total_miss_px": f"{dist:.1f}",
        "total_miss_inches": f"{dist / ppi:.2f}" if ppi else "",
        "h_miss_px": f"{abs(dx):.1f}",
        "h_miss_inches": f"{abs(dx) / ppi:.2f}" if ppi else "",
        "h_direction": h_direction,
        "h_miss_signed": f"{h_signed_px / ppi:.2f}" if ppi else f"{h_signed_px:.1f}",
        "v_miss_px": f"{abs(dy):.1f}",
        "v_miss_inches": f"{abs(dy) / ppi:.2f}" if ppi else "",
        "v_direction": v_direction,
        "v_miss_signed": f"{v_signed_px / ppi:.2f}" if ppi else f"{v_signed_px:.1f}",
        "target_quadrant": tq or "",
        "result_quadrant": rq or "",
        "target_zone": target_zone,
        "timestamp": f"{arrival_frame / fps:.3f}",
    }
    return row


def write_row(csv_path, row, append=False):
    """Write a row to CSV. Creates file with headers if needed."""
    file_exists = os.path.exists(csv_path)
    mode = "a" if append and file_exists else "w"
    write_header = not (append and file_exists)

    with open(csv_path, mode, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        if write_header:
            writer.writeheader()
        writer.writerow(row)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export pitch data to CSV")
    parser.add_argument("--pitcher-name", type=str, default=None)
    parser.add_argument("--pitcher-hand", choices=["R", "L"], default="R")
    parser.add_argument("--pitch-type", type=str, default=None)
    parser.add_argument("--target-frame", type=int, default=60)
    parser.add_argument("--arrival-frame", type=int, default=None)
    parser.add_argument("--zone-height", type=float, default=23)
    parser.add_argument("--output", type=str, default="pitch_data.csv")
    parser.add_argument("--append", action="store_true",
                        help="Append to existing CSV instead of overwriting")
    args = parser.parse_args()

    config = load_config()
    output_dir = config["paths"]["output_dir"]
    ppi = config["calibration"].get("pixels_per_inch")
    plate_center_x = config["calibration"].get("plate_center_x")
    fps = config["video"].get("fps", 30)

    ball_positions = np.load(
        os.path.join(output_dir, "ball_positions.npy"), allow_pickle=True
    ).item()
    glove_masks = load_glove_masks(output_dir)

    # Resolve target frame
    target_frame = args.target_frame
    if target_frame not in glove_masks:
        available = sorted(glove_masks.keys())
        target_frame = min(available, key=lambda f: abs(f - args.target_frame))
        print(f"Target frame {args.target_frame} not available, using nearest: {target_frame}")

    glove_target = glove_centroid(glove_masks[target_frame])
    if glove_target is None:
        print(f"No glove detected in target frame {target_frame}")
        exit(1)

    # Resolve arrival frame
    if args.arrival_frame is not None:
        arrival_idx = args.arrival_frame
        if arrival_idx not in ball_positions:
            prior = [f for f in sorted(ball_positions.keys()) if f <= arrival_idx]
            if prior:
                arrival_idx = prior[-1]
            else:
                arrival_idx = sorted(ball_positions.keys())[-1]
    else:
        arrival_idx = sorted(ball_positions.keys())[-1]

    if arrival_idx not in ball_positions:
        print(f"No ball data at arrival frame {arrival_idx}")
        exit(1)

    pitch_number = next_pitch_number(args.output) if args.append else 1

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
        fps=fps,
        pitch_number=pitch_number,
        plate_center_x=plate_center_x,
    )

    write_row(args.output, row, append=args.append)
    print(f"{'Appended' if args.append else 'Wrote'} pitch #{pitch_number} to {args.output}")
