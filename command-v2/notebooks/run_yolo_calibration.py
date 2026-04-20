#!/usr/bin/env python3
"""Phase 25-01: YOLO glove-area calibration on existing pitch clips.

Reads ground-truth T/A from outing pitch logs, runs YOLO per frame, and writes:
- per-pitch area plots
- per-pitch summary CSV
- aggregate metrics JSON for ct2 calibration constants
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import cv2
import matplotlib.pyplot as plt
import numpy as np
from ultralytics import YOLO, YOLOWorld


@dataclass
class PitchMeasurement:
    outing: str
    pitch: int
    t_frame: int
    a_frame: int
    open_area_px: float
    closed_area_px: float
    drop_magnitude_px: float
    drop_start_frame: int
    frames_to_close: int
    valid_area_fraction: float
    median_confidence: float
    area_series_path: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run YOLO calibration for glove-area timeseries")
    parser.add_argument("--outing", required=True, nargs="+", help="Outing IDs like CBurrows1/2026_03_01")
    parser.add_argument("--output", required=True, help="Output folder for plots")
    parser.add_argument(
        "--model",
        default="",
        help="Path to YOLO checkpoint with glove class (recommended primary path)",
    )
    parser.add_argument(
        "--class-id",
        type=int,
        default=None,
        help="Class id for glove in checkpoint model (if omitted, all classes are considered)",
    )
    parser.add_argument("--conf", type=float, default=0.15, help="YOLO confidence threshold")
    parser.add_argument("--iou", type=float, default=0.5, help="YOLO NMS IoU threshold")
    parser.add_argument(
        "--pitches-per-outing",
        type=int,
        default=12,
        help="Max pitches sampled per outing (default 12 so 2 outings >= 20 pitches)",
    )
    parser.add_argument(
        "--use-yolo-world",
        action="store_true",
        help="Fallback open-vocab mode (YOLOWorld) using --world-prompt",
    )
    parser.add_argument("--world-model", default="yolov8s-world.pt", help="YOLOWorld checkpoint")
    parser.add_argument("--world-prompt", default="baseball glove", help="YOLOWorld class prompt")
    parser.add_argument("--save-crops", action="store_true", help="Save T/A full-frame crops")
    return parser.parse_args()


def load_pitch_log(path: Path) -> list[dict]:
    data = json.loads(path.read_text())
    if isinstance(data, dict):
        pitches = data.get("pitches", [])
    elif isinstance(data, list):
        pitches = data
    else:
        raise ValueError(f"Unexpected pitch log format: {path}")
    return pitches


def clip_path_for_pitch(outing_dir: Path, pitch_entry: dict) -> Path:
    clips_dir = outing_dir / "clips"
    clip_name = pitch_entry.get("clip")
    if clip_name:
        candidate = clips_dir / clip_name
        if candidate.exists():
            return candidate
    pitch_num = int(pitch_entry.get("pitch", 0))
    fallback = clips_dir / f"pitch_{pitch_num:03d}.mp4"
    return fallback


def _choose_detection(
    boxes_xyxy: np.ndarray,
    areas: np.ndarray,
    prev_center: tuple[float, float] | None,
) -> int:
    if len(areas) == 1:
        return 0
    if prev_center is None:
        return int(np.argmax(areas))
    centers = np.column_stack(((boxes_xyxy[:, 0] + boxes_xyxy[:, 2]) / 2.0, (boxes_xyxy[:, 1] + boxes_xyxy[:, 3]) / 2.0))
    dists = np.sqrt(np.sum((centers - np.array(prev_center)) ** 2, axis=1))
    # Prefer track continuity, but still reward larger area.
    score = dists + (0.25 * np.max(areas) - 0.25 * areas)
    return int(np.argmin(score))


def _median_window(values: np.ndarray, center: int, radius: int = 2) -> float:
    lo = max(0, center - radius)
    hi = min(len(values), center + radius + 1)
    window = values[lo:hi]
    nz = window[window > 0]
    if len(nz) == 0:
        return float("nan")
    return float(np.median(nz))


def _drop_start_frame(areas: np.ndarray, t_frame: int, a_frame: int) -> int:
    if a_frame <= t_frame + 1:
        return t_frame
    lo = max(0, t_frame)
    hi = min(len(areas) - 1, a_frame)
    segment = areas[lo : hi + 1]
    if len(segment) < 3:
        return lo
    diff = np.diff(segment)
    if len(diff) == 0:
        return lo
    # Largest negative slope between T and A.
    local_idx = int(np.argmin(diff))
    return lo + local_idx + 1


def run_frame_inference(
    model: YOLO | YOLOWorld,
    frame: np.ndarray,
    class_id: int | None,
    conf: float,
    iou: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    kwargs = dict(conf=conf, iou=iou, verbose=False, imgsz=960)
    if class_id is not None:
        kwargs["classes"] = [class_id]
    result = model.predict(frame, **kwargs)[0]
    if result.boxes is None or len(result.boxes) == 0:
        return np.zeros((0, 4), dtype=float), np.zeros((0,), dtype=float), np.zeros((0,), dtype=float)
    boxes = result.boxes.xyxy.cpu().numpy()
    confs = result.boxes.conf.cpu().numpy()
    if result.masks is not None and result.masks.data is not None and len(result.masks.data) == len(boxes):
        masks = result.masks.data.cpu().numpy()
        areas = masks.reshape((masks.shape[0], -1)).sum(axis=1).astype(float)
    else:
        areas = ((boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])).astype(float)
    return boxes, confs, areas


def iter_sampled_pitches(pitches: list[dict], limit: int) -> Iterable[dict]:
    valid = [p for p in pitches if p.get("pitch") is not None and p.get("arrival_frame") is not None]
    valid.sort(key=lambda p: int(p.get("pitch")))
    return valid[:limit]


def measure_pitch(
    model: YOLO | YOLOWorld,
    outing_id: str,
    clip_path: Path,
    pitch_num: int,
    t_frame: int,
    a_frame: int,
    out_plot_dir: Path,
    class_id: int | None,
    conf: float,
    iou: float,
    save_crops: bool,
    crop_open_dir: Path,
    crop_closed_dir: Path,
) -> PitchMeasurement | None:
    cap = cv2.VideoCapture(str(clip_path))
    if not cap.isOpened():
        print(f"[WARN] Unable to open clip: {clip_path}")
        return None

    frame_areas: list[float] = []
    frame_confs: list[float] = []
    prev_center: tuple[float, float] | None = None
    frame_idx = 0
    t_img = None
    a_img = None

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        boxes, confs, areas = run_frame_inference(model, frame, class_id, conf, iou)
        if len(areas) == 0:
            frame_areas.append(0.0)
            frame_confs.append(0.0)
        else:
            pick = _choose_detection(boxes, areas, prev_center)
            b = boxes[pick]
            prev_center = ((float(b[0]) + float(b[2])) / 2.0, (float(b[1]) + float(b[3])) / 2.0)
            frame_areas.append(float(areas[pick]))
            frame_confs.append(float(confs[pick]))
        if frame_idx == t_frame:
            t_img = frame.copy()
        if frame_idx == a_frame:
            a_img = frame.copy()
        frame_idx += 1
    cap.release()

    if len(frame_areas) == 0:
        return None

    area_arr = np.array(frame_areas, dtype=float)
    conf_arr = np.array(frame_confs, dtype=float)
    t_frame = int(np.clip(t_frame, 0, len(area_arr) - 1))
    a_frame = int(np.clip(a_frame, 0, len(area_arr) - 1))

    open_area = _median_window(area_arr, t_frame)
    closed_area = _median_window(area_arr, a_frame)
    if math.isnan(open_area):
        open_area = 0.0
    if math.isnan(closed_area):
        closed_area = 0.0
    drop_mag = max(0.0, open_area - closed_area)
    drop_start = _drop_start_frame(area_arr, t_frame, a_frame)
    frames_to_close = max(0, a_frame - drop_start)

    valid_fraction = float(np.mean(area_arr > 0))
    valid_confs = conf_arr[conf_arr > 0]
    median_conf = float(np.median(valid_confs)) if len(valid_confs) else 0.0

    x = np.arange(len(area_arr))
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(x, area_arr, color="#1f77b4", linewidth=1.5, label="YOLO glove area")
    ax.axvline(t_frame, color="#2ca02c", linestyle="--", linewidth=1.5, label=f"T={t_frame}")
    ax.axvline(a_frame, color="#d62728", linestyle="--", linewidth=1.5, label=f"A={a_frame}")
    ax.axvline(drop_start, color="#9467bd", linestyle=":", linewidth=1.5, label=f"drop_start={drop_start}")
    ax.set_title(f"{outing_id} pitch {pitch_num:03d}  open={open_area:.1f}  closed={closed_area:.1f}")
    ax.set_xlabel("Clip frame")
    ax.set_ylabel("Area (px^2)")
    ax.legend(loc="upper right")
    ax.grid(alpha=0.2)
    plot_path = out_plot_dir / f"{outing_id.replace('/', '_')}_pitch{pitch_num:03d}.png"
    fig.tight_layout()
    fig.savefig(plot_path, dpi=120)
    plt.close(fig)

    if save_crops and t_img is not None and a_img is not None:
        cv2.imwrite(str(crop_open_dir / f"{outing_id.replace('/', '_')}_pitch{pitch_num:03d}_T.png"), t_img)
        cv2.imwrite(str(crop_closed_dir / f"{outing_id.replace('/', '_')}_pitch{pitch_num:03d}_A.png"), a_img)

    return PitchMeasurement(
        outing=outing_id,
        pitch=pitch_num,
        t_frame=t_frame,
        a_frame=a_frame,
        open_area_px=float(open_area),
        closed_area_px=float(closed_area),
        drop_magnitude_px=float(drop_mag),
        drop_start_frame=int(drop_start),
        frames_to_close=int(frames_to_close),
        valid_area_fraction=valid_fraction,
        median_confidence=median_conf,
        area_series_path=str(plot_path),
    )


def main() -> None:
    args = parse_args()
    out_plot_dir = Path(args.output)
    out_plot_dir.mkdir(parents=True, exist_ok=True)

    base_dir = Path(__file__).resolve().parents[2]
    crop_open_dir = base_dir / "command-v2" / "reference" / "glove-open"
    crop_closed_dir = base_dir / "command-v2" / "reference" / "glove-closed"
    if args.save_crops:
        crop_open_dir.mkdir(parents=True, exist_ok=True)
        crop_closed_dir.mkdir(parents=True, exist_ok=True)

    if args.use_yolo_world:
        model = YOLOWorld(args.world_model)
        model.set_classes([args.world_prompt])
        class_id = None
        model_desc = f"YOLOWorld({args.world_model}) prompt='{args.world_prompt}'"
    else:
        if not args.model:
            raise SystemExit("ERROR: --model is required unless --use-yolo-world is enabled.")
        model = YOLO(args.model)
        class_id = args.class_id
        model_desc = f"YOLO({args.model}) class_id={args.class_id}"

    print(f"[INFO] Using model: {model_desc}")

    measurements: list[PitchMeasurement] = []
    for outing_id in args.outing:
        outing_dir = base_dir / "outings" / outing_id
        pitch_log_path = outing_dir / "pitch_log.json"
        if not pitch_log_path.exists():
            print(f"[WARN] Missing pitch log: {pitch_log_path}")
            continue
        pitches = load_pitch_log(pitch_log_path)
        selected = list(iter_sampled_pitches(pitches, args.pitches_per_outing))
        if not selected:
            print(f"[WARN] No pitches selected for outing: {outing_id}")
            continue
        print(f"[INFO] Outing {outing_id}: evaluating {len(selected)} pitches")

        for p in selected:
            pitch_num = int(p.get("pitch"))
            t_frame = int(p.get("target_frame", 10))
            a_frame = int(p.get("arrival_frame", t_frame))
            clip_path = clip_path_for_pitch(outing_dir, p)
            if not clip_path.exists():
                print(f"[WARN] Missing clip for pitch {pitch_num}: {clip_path}")
                continue
            m = measure_pitch(
                model=model,
                outing_id=outing_id,
                clip_path=clip_path,
                pitch_num=pitch_num,
                t_frame=t_frame,
                a_frame=a_frame,
                out_plot_dir=out_plot_dir,
                class_id=class_id,
                conf=args.conf,
                iou=args.iou,
                save_crops=args.save_crops,
                crop_open_dir=crop_open_dir,
                crop_closed_dir=crop_closed_dir,
            )
            if m is not None:
                measurements.append(m)

    if not measurements:
        raise SystemExit("ERROR: no pitch measurements produced")

    rows_path = out_plot_dir / "yolo_pitch_measurements.csv"
    with rows_path.open("w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "outing",
                "pitch",
                "t_frame",
                "a_frame",
                "open_area_px",
                "closed_area_px",
                "drop_magnitude_px",
                "drop_start_frame",
                "frames_to_close",
                "valid_area_fraction",
                "median_confidence",
                "area_series_path",
            ],
        )
        writer.writeheader()
        for m in measurements:
            writer.writerow(m.__dict__)

    open_vals = np.array([m.open_area_px for m in measurements], dtype=float)
    closed_vals = np.array([m.closed_area_px for m in measurements], dtype=float)
    frames_close_vals = np.array([m.frames_to_close for m in measurements], dtype=float)
    valid_frac_vals = np.array([m.valid_area_fraction for m in measurements], dtype=float)
    conf_vals = np.array([m.median_confidence for m in measurements], dtype=float)

    open_med = float(np.median(open_vals))
    closed_med = float(np.median(closed_vals))
    drop_ratio = float(closed_med / open_med) if open_med > 0 else 0.0
    summary = {
        "model": model_desc,
        "total_pitches": len(measurements),
        "open_area_px_median": open_med,
        "closed_area_px_median": closed_med,
        "drop_threshold_ratio": drop_ratio,
        "drop_frames_median": float(np.median(frames_close_vals)),
        "open_area_std_dev_px": float(np.std(open_vals)),
        "valid_area_fraction_median": float(np.median(valid_frac_vals)),
        "median_confidence_median": float(np.median(conf_vals)),
        "rows_csv": str(rows_path),
    }

    summary_path = out_plot_dir / "yolo_calibration_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2))

    print("[DONE] YOLO calibration complete")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
