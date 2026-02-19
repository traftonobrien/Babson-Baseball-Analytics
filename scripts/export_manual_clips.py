#!/usr/bin/env python3
"""
Export clips from manual_clips.json and write ingest index.json.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ingest_manual.export import export_manual_clips

REPO_ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Export manual multi-angle clips using ffmpeg/OpenCV fallback (max 3 ordered angles per pitch)."
    )
    p.add_argument("--manual-clips", required=True, help="Path to manual_clips.json")
    p.add_argument("--outdir", default="output/ingest", help="Output root.")
    p.add_argument("--overwrite", action="store_true", help="Overwrite existing exported clip files.")
    p.add_argument("--keep-audio", action="store_true", help="Keep source audio in exported clips.")
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
    manual_path = _resolve_path(args.manual_clips)
    if not manual_path.exists():
        print(f"ERROR: manual_clips.json not found: {manual_path}", file=sys.stderr)
        raise SystemExit(1)
    index_path = export_manual_clips(
        manual_clips_path=manual_path,
        out_root=_resolve_path(args.outdir),
        overwrite=args.overwrite,
        keep_audio=args.keep_audio,
    )
    print(f"Export index: {index_path}")


if __name__ == "__main__":
    main()
