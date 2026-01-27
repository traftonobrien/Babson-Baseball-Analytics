"""Track catcher's glove using SAM 2 video predictor."""

import argparse
import os
import numpy as np
import cv2
import yaml
import torch
from sam2.build_sam import build_sam2_video_predictor


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


# Global state for mouse callbacks
_click_points = []
_bbox_points = []
_mode = "point"
_clone = None


def _mouse_callback(event, x, y, flags, param):
    global _clone
    if _mode == "point":
        if event == cv2.EVENT_LBUTTONDOWN:
            _click_points.append((x, y))
            cv2.circle(_clone, (x, y), 5, (0, 255, 0), -1)
            cv2.imshow("Select glove", _clone)
    elif _mode == "bbox":
        if event == cv2.EVENT_LBUTTONDOWN:
            _bbox_points.append((x, y))
        elif event == cv2.EVENT_LBUTTONUP:
            _bbox_points.append((x, y))
            cv2.rectangle(_clone, _bbox_points[0], _bbox_points[1], (0, 255, 0), 2)
            cv2.imshow("Select glove", _clone)


def interactive_select(frame, mode="point"):
    """Open a window for the user to click a point or draw a bounding box on the glove."""
    global _click_points, _bbox_points, _mode, _clone
    _click_points = []
    _bbox_points = []
    _mode = mode
    _clone = frame.copy()

    if mode == "point":
        print("Click on the glove center, then press any key.")
    else:
        print("Click and drag to draw a box around the glove, then press any key.")

    cv2.imshow("Select glove", _clone)
    cv2.setMouseCallback("Select glove", _mouse_callback)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    if mode == "point":
        if not _click_points:
            raise RuntimeError("No point selected")
        return np.array(_click_points, dtype=np.float32), np.ones(len(_click_points), dtype=np.int32)
    else:
        if len(_bbox_points) < 2:
            raise RuntimeError("No bounding box drawn")
        x1, y1 = _bbox_points[0]
        x2, y2 = _bbox_points[1]
        box = np.array([min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)], dtype=np.float32)
        return box, None


def track_glove(config, frame_idx, initial_points=None, initial_labels=None, initial_box=None):
    """
    Track the glove across all frames.

    Provide either (initial_points, initial_labels) or initial_box.
    """
    device = "cuda" if torch.cuda.is_available() else "cpu"
    predictor = build_sam2_video_predictor(
        config["model"]["config"],
        config["model"]["checkpoint"],
        device=device,
    )

    frames_dir = config["paths"]["frames_dir"]
    obj_id = config["tracking"]["glove"]["object_id"]

    with torch.inference_mode():
        state = predictor.init_state(video_path=frames_dir)

        kwargs = dict(inference_state=state, frame_idx=frame_idx, obj_id=obj_id)
        if initial_box is not None:
            kwargs["box"] = initial_box
        else:
            kwargs["points"] = initial_points
            kwargs["labels"] = initial_labels

        predictor.add_new_points_or_box(**kwargs)

        masks = {}
        for fidx, obj_ids, mask_logits in predictor.propagate_in_video(state):
            mask = (mask_logits[0] > 0.0).cpu().numpy().squeeze()
            masks[fidx] = mask

    print(f"Tracked glove across {len(masks)} frames")
    return masks


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Track glove with SAM 2")
    parser.add_argument("--frame", type=int, default=0, help="Frame index for initialization")
    parser.add_argument("--bbox", action="store_true", help="Use bounding box instead of point prompt")
    args = parser.parse_args()

    config = load_config()
    frames_dir = config["paths"]["frames_dir"]
    frame_files = sorted(f for f in os.listdir(frames_dir) if f.endswith(".jpg"))
    frame_img = cv2.imread(os.path.join(frames_dir, frame_files[args.frame]))

    mode = "bbox" if args.bbox else "point"
    prompt, labels = interactive_select(frame_img, mode=mode)

    if args.bbox:
        masks = track_glove(config, args.frame, initial_box=prompt)
    else:
        masks = track_glove(config, args.frame, initial_points=prompt, initial_labels=labels)

    os.makedirs(config["paths"]["output_dir"], exist_ok=True)
    np.savez_compressed(
        os.path.join(config["paths"]["output_dir"], "glove_masks.npz"),
        **{str(k): v for k, v in masks.items()},
    )
    print("Saved glove_masks.npz")
