"""Generate overlay video with ball position, glove mask, and miss distance."""

import argparse
import os
import cv2
import numpy as np
import yaml


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def load_glove_masks(output_dir):
    """Load glove masks from .npz (preferred) or .npy (legacy)."""
    npz_path = os.path.join(output_dir, "glove_masks.npz")
    npy_path = os.path.join(output_dir, "glove_masks.npy")
    if os.path.exists(npz_path):
        data = np.load(npz_path)
        return {int(k): data[k] for k in data.files}
    return np.load(npy_path, allow_pickle=True).item()


def find_arrival_frame(ball_positions):
    """Find the last frame where the ball is detected before it disappears."""
    if not ball_positions:
        return None
    return sorted(ball_positions.keys())[-1]


def draw_legend(frame, x, y):
    """Draw a color legend in the corner."""
    items = [
        ((0, 255, 0), "Glove mask"),
        ((0, 0, 255), "Ball"),
        ((255, 255, 0), "Total dist"),
        ((255, 200, 0), "H miss"),
        ((0, 200, 255), "V miss"),
        ((0, 165, 255), "Arrival frame"),
        ((255, 0, 255), "Glove target"),
    ]
    for i, (color, label) in enumerate(items):
        ly = y + i * 20
        cv2.rectangle(frame, (x, ly), (x + 12, ly + 12), color, -1)
        cv2.putText(frame, label, (x + 18, ly + 11),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)


def draw_text_box(frame, lines, x, y, font_scale=0.5, thickness=1, padding=10):
    """Draw a semi-transparent text box with multiple lines."""
    font = cv2.FONT_HERSHEY_SIMPLEX
    line_heights = []
    line_widths = []
    for line in lines:
        (tw, th), baseline = cv2.getTextSize(line, font, font_scale, thickness)
        line_heights.append(th + baseline)
        line_widths.append(tw)

    box_w = max(line_widths) + padding * 2
    line_spacing = 6
    box_h = sum(line_heights) + line_spacing * (len(lines) - 1) + padding * 2

    # Clamp x so box stays on screen
    h_frame, w_frame = frame.shape[:2]
    x = min(x, w_frame - box_w - 5)

    # Semi-transparent background
    overlay = frame.copy()
    cv2.rectangle(overlay, (x, y), (x + box_w, y + box_h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, dst=frame)
    cv2.rectangle(frame, (x, y), (x + box_w, y + box_h), (255, 255, 255), 1)

    # Draw each line
    cy = y + padding
    for i, line in enumerate(lines):
        cy += line_heights[i]
        cv2.putText(frame, line, (x + padding, cy), font, font_scale,
                    (255, 255, 255), thickness)
        cy += line_spacing


def draw_ball_trail(frame, ball_positions, current_frame, trail_len=10):
    """Draw a fading trajectory trail for the ball over recent frames."""
    sorted_frames = sorted(f for f in ball_positions.keys() if f <= current_frame)
    trail_frames = sorted_frames[-trail_len:]
    if len(trail_frames) < 2:
        return
    for j in range(1, len(trail_frames)):
        f_prev = trail_frames[j - 1]
        f_curr = trail_frames[j]
        bp_prev = ball_positions[f_prev]
        bp_curr = ball_positions[f_curr]
        pt1 = (int(bp_prev["x"]), int(bp_prev["y"]))
        pt2 = (int(bp_curr["x"]), int(bp_curr["y"]))
        alpha = j / len(trail_frames)
        color = (int(100 * alpha), int(100 * alpha), int(255 * alpha))
        thick = max(1, int(2 * alpha))
        cv2.line(frame, pt1, pt2, color, thick)


def get_zone_bounds(glove_target, ppi, zone_height=23, zone_center_x=None):
    """Compute strike zone pixel bounds. Returns (left, top, right, bottom) or None."""
    if glove_target is None or ppi is None:
        return None
    half_w = int(8.5 * ppi)
    zone_h = int(zone_height * ppi)
    # Horizontal center: use plate_center_x if available, else glove target
    cx = int(zone_center_x) if zone_center_x is not None else glove_target[0]
    # Vertical: glove target at bottom third of zone
    cy = glove_target[1]
    zone_bottom = cy + int(zone_h / 3)
    zone_top = zone_bottom - zone_h
    return (cx - half_w, zone_top, cx + half_w, zone_bottom)


def draw_strike_zone(frame, glove_target, ppi, zone_height=23, zone_center_x=None):
    """Draw strike zone with 9-box grid and shadow zone."""
    bounds = get_zone_bounds(glove_target, ppi, zone_height, zone_center_x)
    if bounds is None:
        return
    left, top, right, bottom = (int(v) for v in bounds)
    zone_w = right - left
    zone_h = bottom - top

    # Shadow zone (~2 inches outside)
    shadow_px = int(2 * ppi)
    s_tl = (left - shadow_px, top - shadow_px)
    s_br = (right + shadow_px, bottom + shadow_px)
    # Dotted line via short dashes
    for edge_start, edge_end in [
        (s_tl, (s_br[0], s_tl[1])),  # top
        ((s_br[0], s_tl[1]), s_br),   # right
        (s_br, (s_tl[0], s_br[1])),   # bottom
        ((s_tl[0], s_br[1]), s_tl),   # left
    ]:
        dx = edge_end[0] - edge_start[0]
        dy = edge_end[1] - edge_start[1]
        length = max(abs(dx), abs(dy))
        if length == 0:
            continue
        dash_len = 8
        num_dashes = length // (dash_len * 2)
        for d in range(max(1, int(num_dashes))):
            t0 = (d * dash_len * 2) / length
            t1 = min((d * dash_len * 2 + dash_len) / length, 1.0)
            p0 = (int(edge_start[0] + dx * t0), int(edge_start[1] + dy * t0))
            p1 = (int(edge_start[0] + dx * t1), int(edge_start[1] + dy * t1))
            cv2.line(frame, p0, p1, (150, 150, 150), 1)

    # Semi-transparent fill for main zone
    overlay = frame.copy()
    cv2.rectangle(overlay, (left, top), (right, bottom), (220, 220, 220), -1)
    cv2.addWeighted(overlay, 0.15, frame, 0.85, 0, dst=frame)

    # Solid border
    cv2.rectangle(frame, (left, top), (right, bottom), (200, 200, 200), 2)

    # 3x3 grid lines
    col_w = zone_w / 3
    row_h = zone_h / 3
    for c in range(1, 3):
        x = int(left + c * col_w)
        cv2.line(frame, (x, top), (x, bottom), (180, 180, 180), 1)
    for r in range(1, 3):
        y = int(top + r * row_h)
        cv2.line(frame, (left, y), (right, y), (180, 180, 180), 1)


def classify_quadrant(px, py, zone_bounds, pitcher_hand="R"):
    """Classify a point into a 9-box zone quadrant.

    Returns a tuple (code, label) e.g. ("DA", "Down-Away") or None if outside zone.
    Away/In are from the batter's perspective opposite the pitcher:
      RHP vs RHB: away = right side of image (toward 1B), in = left (toward 3B)
      We use pitcher_hand to determine: for RHP, away = positive X, in = negative X.
    """
    if zone_bounds is None:
        return None
    left, top, right, bottom = zone_bounds
    zone_w = right - left
    zone_h = bottom - top
    col_w = zone_w / 3
    row_h = zone_h / 3

    # Column: 0=left, 1=middle, 2=right (in image)
    rel_x = px - left
    if rel_x < 0 or rel_x > zone_w:
        return None
    col = min(int(rel_x / col_w), 2)

    # Row: 0=top, 1=middle, 2=bottom (in image)
    rel_y = py - top
    if rel_y < 0 or rel_y > zone_h:
        return None
    row = min(int(rel_y / row_h), 2)

    row_labels = ["Up", "Middle", "Down"]
    row_codes = ["U", "M", "D"]
    # For RHP: left in image = In (toward 3B/batter), right = Away (toward 1B)
    # For LHP: flipped
    if pitcher_hand == "R":
        col_labels = ["In", "Middle", "Away"]
        col_codes = ["I", "M", "A"]
    else:
        col_labels = ["Away", "Middle", "In"]
        col_codes = ["A", "M", "I"]

    code = row_codes[row] + col_codes[col]
    label = f"{row_labels[row]}-{col_labels[col]}"
    return code, label


def classify_miss_direction(dx_px, dy_px, pitcher_hand="R"):
    """Classify the miss direction as a human-readable label like 'Low-Glove'."""
    arm_sign = 1 if pitcher_hand == "R" else -1
    h_label = "Arm" if dx_px * arm_sign > 0 else "Glove"
    v_label = "High" if dy_px < 0 else "Low"
    return f"{v_label}-{h_label}"


def render_overlay_video(config, ball_positions, glove_masks, miss_results,
                         target_frame=None, arrival_frame=None,
                         pitcher_hand="R", pitcher_name=None,
                         pitch_type=None, show_zone=False,
                         zone_height=23, zone_center_x=None,
                         export_frame=False):
    """Write an MP4 with tracking overlays on each frame."""
    frames_dir = config["paths"]["frames_dir"]
    output_dir = config["paths"]["output_dir"]
    os.makedirs(output_dir, exist_ok=True)

    frame_files = sorted(f for f in os.listdir(frames_dir) if f.endswith(".jpg"))
    if not frame_files:
        raise RuntimeError(f"No frames found in {frames_dir}")

    sample = cv2.imread(os.path.join(frames_dir, frame_files[0]))
    h, w = sample.shape[:2]
    fps = config["video"].get("fps", 30)
    ppi = config["calibration"].get("pixels_per_inch")

    out_path = os.path.join(output_dir, "overlay.mp4")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(out_path, fourcc, fps, (w, h))

    miss_lookup = {r["frame"]: r for r in miss_results}
    arrival = arrival_frame if arrival_frame is not None else find_arrival_frame(ball_positions)

    # Compute glove target crosshair from target frame
    glove_target = None
    if target_frame is not None and target_frame in glove_masks:
        mask = glove_masks[target_frame]
        ys, xs = np.where(mask)
        if len(xs) > 0:
            glove_target = (int(xs.mean()), int(ys.mean()))

    # Build pitcher info header
    header_parts = []
    if pitcher_name:
        header_parts.append(pitcher_name)
    if pitch_type:
        header_parts.append(pitch_type)
    header_parts.append(f"{'RHP' if pitcher_hand == 'R' else 'LHP'}")
    header_text = " | ".join(header_parts)

    # Compute zone bounds for quadrant classification
    zone_bounds = get_zone_bounds(glove_target, ppi, zone_height, zone_center_x) if show_zone else None

    # Pre-compute arrival ball position for target/result circles
    arrival_ball = None
    if arrival is not None and arrival in ball_positions:
        bp = ball_positions[arrival]
        arrival_ball = (int(bp["x"]), int(bp["y"]))

    # Pre-compute arrival frame summary for the text box
    arm_sign = 1 if pitcher_hand == "R" else -1
    summary_lines = None
    if arrival is not None and arrival in miss_lookup:
        r = miss_lookup[arrival]
        if "dx_px" in r:
            dx, dy = r["dx_px"], r["dy_px"]
            dist = r["distance_px"]
            h_label = "arm-side" if dx * arm_sign > 0 else "glove-side"
            v_label = "high" if dy < 0 else "low"
            summary_lines = ["MISS DISTANCE"]
            if ppi:
                summary_lines.append(f'Total: {dist / ppi:.1f}"')
                summary_lines.append(f'H: {abs(dx) / ppi:.1f}" {h_label}')
                summary_lines.append(f'V: {abs(dy) / ppi:.1f}" {v_label}')
            else:
                summary_lines.append(f"Total: {dist:.0f}px")
                summary_lines.append(f"H: {abs(dx):.0f}px {h_label}")
                summary_lines.append(f"V: {abs(dy):.0f}px {v_label}")

            # Target quadrant
            if glove_target and zone_bounds:
                tq = classify_quadrant(glove_target[0], glove_target[1],
                                       zone_bounds, pitcher_hand)
                if tq:
                    summary_lines.append(f"Target: {tq[1]} ({tq[0]})")

            # Miss direction
            miss_dir = classify_miss_direction(dx, dy, pitcher_hand)
            summary_lines.append(f"Result: {miss_dir}")

    for i, fname in enumerate(frame_files):
        frame = cv2.imread(os.path.join(frames_dir, fname))

        # Target frame border highlight
        if target_frame is not None and i == target_frame:
            cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (255, 0, 255), 4)

        # Arrival frame border highlight
        if i == arrival:
            cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 165, 255), 4)

        # Strike zone overlay
        if show_zone:
            draw_strike_zone(frame, glove_target, ppi, zone_height, zone_center_x)

        # Draw glove target crosshair
        if glove_target is not None:
            cx, cy = glove_target
            cv2.drawMarker(frame, (cx, cy), (255, 0, 255), cv2.MARKER_CROSS, 20, 2)

        # Target circle: show from target_frame onward
        if ppi and glove_target is not None and target_frame is not None and i >= target_frame:
            circle_r = int(3.5 * ppi)  # ~7 inch diameter
            overlay = frame.copy()
            cv2.circle(overlay, glove_target, circle_r, (0, 200, 0), -1)
            cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, dst=frame)
            cv2.circle(frame, glove_target, circle_r, (0, 200, 0), 2)
            cv2.putText(frame, "TARGET", (glove_target[0] - 30, glove_target[1] + circle_r + 18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 0), 1)

        # Result circle: show from arrival_frame onward
        if ppi and arrival_ball is not None and arrival is not None and i >= arrival:
            circle_r = int(3.5 * ppi)  # ~7 inch diameter
            overlay = frame.copy()
            cv2.circle(overlay, arrival_ball, circle_r, (0, 0, 220), -1)
            cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, dst=frame)
            cv2.circle(frame, arrival_ball, circle_r, (0, 0, 220), 2)
            cv2.putText(frame, "RESULT", (arrival_ball[0] - 30, arrival_ball[1] - circle_r - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 220), 1)

        # Draw glove mask overlay
        if i in glove_masks:
            mask = glove_masks[i]
            overlay = frame.copy()
            overlay[mask] = (0, 255, 0)
            frame = cv2.addWeighted(frame, 0.7, overlay, 0.3, 0)

        # Ball trajectory trail
        if i in ball_positions:
            draw_ball_trail(frame, ball_positions, i)

        # Draw ball circle
        if i in ball_positions:
            bp = ball_positions[i]
            center = (int(bp["x"]), int(bp["y"]))
            cv2.circle(frame, center, int(bp["radius"]), (0, 0, 255), 2)

        # Draw miss distance line and text
        if i in miss_lookup:
            r = miss_lookup[i]
            bx, by = int(r["ball"][0]), int(r["ball"][1])
            gx, gy = int(r["glove"][0]), int(r["glove"][1])

            if i == arrival and "dx_px" in r:
                # Arrival frame: draw H/V component lines as a right angle
                corner = (bx, gy)  # corner of the right angle
                cv2.line(frame, (gx, gy), corner, (255, 200, 0), 2)  # horizontal
                cv2.line(frame, corner, (bx, by), (0, 200, 255), 2)  # vertical
                cv2.line(frame, (bx, by), (gx, gy), (255, 255, 0), 1)  # diagonal

                # H label
                h_px = abs(r["dx_px"])
                h_label = f"H:{h_px:.0f}px"
                if ppi:
                    h_label = f"H:{h_px / ppi:.1f}in"
                mid_h_y = gy - 10
                cv2.putText(frame, h_label, ((gx + bx) // 2 - 20, mid_h_y),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 200, 0), 1)

                # V label
                v_px = abs(r["dy_px"])
                v_label = f"V:{v_px:.0f}px"
                if ppi:
                    v_label = f"V:{v_px / ppi:.1f}in"
                cv2.putText(frame, v_label, (bx + 10, (gy + by) // 2),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 200, 255), 1)

                # Total label
                t_label = f"{r['distance_px']:.0f}px"
                if ppi:
                    t_label = f"{r['distance_px'] / ppi:.1f}in"
                cv2.putText(frame, t_label, (bx + 10, by - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
            else:
                # Non-arrival frames: simple diagonal line
                cv2.line(frame, (bx, by), (gx, gy), (255, 255, 0), 1)
                label = f"{r['distance_px']:.0f}px"
                if ppi:
                    label += f" ({r['distance_px'] / ppi:.1f}in)"
                cv2.putText(frame, label, (bx + 10, by - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)

        # Summary text box on arrival frame
        if i == arrival and summary_lines:
            draw_text_box(frame, summary_lines, w - 260, 50)

        # Pitcher info header
        if header_text:
            cv2.putText(frame, header_text, (10, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

        # Frame number + timestamp overlay
        timestamp = i / fps
        cv2.putText(
            frame, f"Frame {i} | {timestamp:.3f}s",
            (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1,
        )

        # Legend
        draw_legend(frame, 10, h - 155)

        # Export arrival frame as PNG
        if export_frame and i == arrival:
            png_path = os.path.join(output_dir, "arrival_frame.png")
            cv2.imwrite(png_path, frame)
            print(f"Exported arrival frame to {png_path}")

        writer.write(frame)

    writer.release()
    print(f"Wrote overlay video to {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate overlay video")
    parser.add_argument("--target-frame", type=int, default=None,
                        help="Frame where the catcher's glove is set up as the target")
    parser.add_argument("--arrival-frame", type=int, default=None,
                        help="Frame when the ball arrives at the catcher")
    parser.add_argument("--pitcher-hand", choices=["R", "L"], default="R",
                        help="Pitcher handedness (default: R)")
    parser.add_argument("--pitcher-name", type=str, default=None,
                        help="Pitcher name to display on video")
    parser.add_argument("--pitch-type", type=str, default=None,
                        help="Pitch type to display on video")
    parser.add_argument("--show-zone", action="store_true",
                        help="Overlay a rectangular strike zone")
    parser.add_argument("--zone-height", type=float, default=23,
                        help="Strike zone height in inches (default: 23)")
    parser.add_argument("--zone-center-x", type=float, default=None,
                        help="Override zone horizontal center X pixel (default: from config or glove target)")
    parser.add_argument("--export-frame", action="store_true",
                        help="Save the arrival frame as a PNG still image")
    args = parser.parse_args()

    config = load_config()
    output_dir = config["paths"]["output_dir"]

    # Resolve zone center X: CLI flag > config > fallback to glove target
    zone_center_x = args.zone_center_x
    if zone_center_x is None:
        zone_center_x = config["calibration"].get("plate_center_x")

    ball_positions = np.load(
        os.path.join(output_dir, "ball_positions.npy"), allow_pickle=True
    ).item()
    glove_masks = load_glove_masks(output_dir)
    miss_results = np.load(
        os.path.join(output_dir, "miss_results.npy"), allow_pickle=True
    ).tolist()

    render_overlay_video(config, ball_positions, glove_masks, miss_results,
                         target_frame=args.target_frame,
                         arrival_frame=args.arrival_frame,
                         pitcher_hand=args.pitcher_hand,
                         pitcher_name=args.pitcher_name,
                         pitch_type=args.pitch_type,
                         show_zone=args.show_zone,
                         zone_height=args.zone_height,
                         zone_center_x=zone_center_x,
                         export_frame=args.export_frame)
