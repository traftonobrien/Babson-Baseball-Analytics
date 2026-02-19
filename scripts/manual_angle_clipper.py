#!/usr/bin/env python3
"""
Interactive manual multi-angle clipper.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ingest_manual.clipper_ui import run_clipper
from src.mechanics.video_io import read_video_meta

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VIDEO = REPO_ROOT / "Mechanics Analysis" / "Trafton OBrien" / "All Angles Test.mov"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Manual multi-angle clipper (OpenCV UI).")
    p.add_argument(
        "--video",
        default=str(DEFAULT_VIDEO),
        help="Path to source video (.mov/.mp4).",
    )
    p.add_argument("--player", default=None, help="Player name (default: parent folder name).")
    p.add_argument("--session", default=None, help="Session name (default: video stem).")
    p.add_argument("--outdir", default="output/ingest", help="Output root.")
    p.add_argument("--start-frame", type=int, default=0, help="Initial frame index.")
    return p.parse_args()


def _resolve_path(path_arg: str) -> Path:
    raw = Path(path_arg).expanduser()
    if raw.is_absolute():
        return raw
    cwd = (Path.cwd() / raw).resolve()
    if cwd.exists():
        return cwd
    return (REPO_ROOT / raw).resolve()


def main() -> None:
    args = parse_args()
    video_path = _resolve_path(args.video)
    if not video_path.exists():
        print(f"ERROR: video not found: {video_path}", file=sys.stderr)
        raise SystemExit(1)

    meta = read_video_meta(video_path)
    player = args.player or video_path.parent.name
    session = args.session or video_path.stem

    print(f"Video: {video_path}")
    print(f"Meta : {meta.fps:.2f} fps | {meta.frame_count} frames | {meta.width}x{meta.height}")
    print(
        "Hotkeys: Space play/pause | s/e markers | c commit | u undo | n/p pitch | "
        ",/. +/-10 frames | [ ] +/-0.25s | w save | q quit | mouse drag scrub"
    )

    manual_path = run_clipper(
        video_path=video_path,
        player=player,
        session=session,
        out_root=_resolve_path(args.outdir),
        start_frame=args.start_frame,
    )
    print(f"manual_clips.json: {manual_path}")


if __name__ == "__main__":
    main()
