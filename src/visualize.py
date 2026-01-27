"""Generate overlay video with ball position, glove mask, and miss distance."""

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
        ((255, 255, 0), "Distance"),
        ((0, 165, 255), "Arrival frame"),
    ]
    for i, (color, label) in enumerate(items):
        ly = y + i * 20
        cv2.rectangle(frame, (x, ly), (x + 12, ly + 12), color, -1)
        cv2.putText(frame, label, (x + 18, ly + 11),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)


def render_overlay_video(config, ball_positions, glove_masks, miss_results):
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
    arrival = find_arrival_frame(ball_positions)

    for i, fname in enumerate(frame_files):
        frame = cv2.imread(os.path.join(frames_dir, fname))

        # Arrival frame border highlight
        if i == arrival:
            cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 165, 255), 4)

        # Draw glove mask overlay
        if i in glove_masks:
            mask = glove_masks[i]
            overlay = frame.copy()
            overlay[mask] = (0, 255, 0)
            frame = cv2.addWeighted(frame, 0.7, overlay, 0.3, 0)

        # Draw ball circle
        if i in ball_positions:
            bp = ball_positions[i]
            center = (int(bp["x"]), int(bp["y"]))
            cv2.circle(frame, center, int(bp["radius"]), (0, 0, 255), 2)

        # Draw miss distance line and text
        if i in miss_lookup:
            r = miss_lookup[i]
            pt1 = (int(r["ball"][0]), int(r["ball"][1]))
            pt2 = (int(r["glove"][0]), int(r["glove"][1]))
            cv2.line(frame, pt1, pt2, (255, 255, 0), 1)
            label = f"{r['distance_px']:.0f}px"
            if ppi:
                label += f" ({r['distance_px'] / ppi:.1f}in)"
            cv2.putText(
                frame, label,
                (pt1[0] + 10, pt1[1] - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1,
            )

        # Frame number + timestamp overlay
        timestamp = i / fps
        cv2.putText(
            frame, f"Frame {i} | {timestamp:.3f}s",
            (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1,
        )

        # Legend
        draw_legend(frame, 10, h - 95)

        writer.write(frame)

    writer.release()
    print(f"Wrote overlay video to {out_path}")


if __name__ == "__main__":
    config = load_config()
    output_dir = config["paths"]["output_dir"]

    ball_positions = np.load(
        os.path.join(output_dir, "ball_positions.npy"), allow_pickle=True
    ).item()
    glove_masks = load_glove_masks(output_dir)
    miss_results = np.load(
        os.path.join(output_dir, "miss_results.npy"), allow_pickle=True
    ).tolist()

    render_overlay_video(config, ball_positions, glove_masks, miss_results)
