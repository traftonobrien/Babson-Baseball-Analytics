"""Extract frames from input video for SAM 2 processing."""

import argparse
import glob
import os
import cv2
import yaml


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def extract_frames(config, video_override=None):
    video_path = video_override or config["paths"]["input_video"]
    output_dir = config["paths"]["frames_dir"]
    os.makedirs(output_dir, exist_ok=True)
    # Remove old frames to avoid size mismatches across runs
    for old in glob.glob(os.path.join(output_dir, "*.jpg")):
        os.remove(old)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Video: {video_path} | {width}x{height} | {fps:.1f} FPS | {frame_count} frames")

    idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        out_path = os.path.join(output_dir, f"{idx:05d}.jpg")
        cv2.imwrite(out_path, frame)
        idx += 1

    cap.release()
    print(f"Extracted {idx} frames to {output_dir}")
    return idx


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract frames from video")
    parser.add_argument("--video", help="Path to video file (overrides config)")
    args = parser.parse_args()

    config = load_config()
    extract_frames(config, video_override=args.video)
