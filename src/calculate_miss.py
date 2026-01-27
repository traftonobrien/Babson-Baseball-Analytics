"""Calculate miss distance between ball and glove center."""

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


def calculate_miss(ball_positions, glove_masks):
    """
    Compute per-frame distance between ball center and glove centroid.

    Returns list of dicts with frame, distance_px, ball, glove fields.
    """
    results = []
    common_frames = sorted(set(ball_positions.keys()) & set(glove_masks.keys()))

    for idx in common_frames:
        bp = ball_positions[idx]
        gc = glove_centroid(glove_masks[idx])
        if gc is None:
            continue
        dist = np.hypot(bp["x"] - gc[0], bp["y"] - gc[1])
        results.append({
            "frame": idx,
            "distance_px": float(dist),
            "ball": (bp["x"], bp["y"]),
            "glove": gc,
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


def load_glove_masks(output_dir):
    """Load glove masks from .npz (preferred) or .npy (legacy)."""
    npz_path = os.path.join(output_dir, "glove_masks.npz")
    npy_path = os.path.join(output_dir, "glove_masks.npy")
    if os.path.exists(npz_path):
        data = np.load(npz_path)
        return {int(k): data[k] for k in data.files}
    return np.load(npy_path, allow_pickle=True).item()


if __name__ == "__main__":
    config = load_config()
    output_dir = config["paths"]["output_dir"]
    ppi = config["calibration"].get("pixels_per_inch")

    ball_positions = np.load(
        os.path.join(output_dir, "ball_positions.npy"), allow_pickle=True
    ).item()
    glove_masks = load_glove_masks(output_dir)

    results = calculate_miss(ball_positions, glove_masks)
    arrival_idx = find_arrival_frame(ball_positions)
    closest = find_closest_approach(results)

    # Find arrival frame result
    arrival_result = next((r for r in results if r["frame"] == arrival_idx), None)

    print("=== Pitch Summary ===")
    if arrival_result:
        dist_px = arrival_result["distance_px"]
        print(f"Arrival frame: {arrival_idx}")
        print(f"Miss distance at arrival: {dist_px:.1f} px", end="")
        if ppi:
            print(f" ({dist_px / ppi:.2f} in)")
        else:
            print()

        # Simple catch determination: ball within ~glove radius
        ball_r = ball_positions[arrival_idx].get("radius", 15)
        caught = dist_px < ball_r * 3
        print(f"Result: {'CAUGHT' if caught else 'MISSED'}")
    else:
        print(f"Arrival frame: {arrival_idx} (no glove data at this frame)")

    if closest:
        dist_px = closest["distance_px"]
        print(f"Closest approach: frame {closest['frame']}, {dist_px:.1f} px", end="")
        if ppi:
            print(f" ({dist_px / ppi:.2f} in)")
        else:
            print()

    if not results:
        print("No frames with both ball and glove detected.")

    np.save(os.path.join(output_dir, "miss_results.npy"), results)
