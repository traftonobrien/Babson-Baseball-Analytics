"""
OpenCV-based manual multi-angle clipper UI.

Keyboard shortcuts match the command-style workflow requested for quick
frame-accurate clip marking.
"""
from __future__ import annotations

import dataclasses
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from src.mechanics.video_io import read_video_meta

from .schema import ManualClip, ManualClipsDoc, load_manual_clips, new_manual_doc, write_manual_clips
from .utils import ingest_session_dir


AUTO_ANGLE_BY_ORDER: dict[int, str] = {
    1: "home_plate_front",
    2: "behind",
    3: "open_side",
}
MAX_ANGLES_PER_PITCH = 3
SCRUB_BAR_HEIGHT_PX = 20
SCRUB_BAR_BOTTOM_PAD_PX = 10
SCRUB_BAR_SIDE_PAD_PX = 14


def auto_angle_for_order(order: int) -> Optional[str]:
    return AUTO_ANGLE_BY_ORDER.get(int(order))


def scrub_x_to_frame(
    x: int,
    bar_left: int,
    bar_right: int,
    frame_count: int,
) -> int:
    """
    Map a scrub bar x coordinate into a valid frame index.
    """
    if frame_count <= 1:
        return 0
    if bar_right <= bar_left:
        return 0
    x_clamped = max(bar_left, min(int(x), bar_right))
    ratio = float(x_clamped - bar_left) / float(bar_right - bar_left)
    idx = int(round(ratio * float(frame_count - 1)))
    return max(0, min(idx, frame_count - 1))


@dataclasses.dataclass
class SeekState:
    max_frame: int
    _pending_frame: Optional[int] = None

    def request_seek(self, frame_idx: int) -> None:
        frame = max(0, min(int(frame_idx), int(self.max_frame)))
        self._pending_frame = frame

    def consume_seek(self) -> Optional[int]:
        frame = self._pending_frame
        self._pending_frame = None
        return frame


@dataclasses.dataclass
class ClipperConfig:
    video_path: Path
    player: str
    session: str
    out_root: Path
    window_name: str = "Manual Multi-Angle Clipper"
    start_frame: int = 0


class ManualClipperUI:
    def __init__(self, config: ClipperConfig):
        self.config = config
        self.meta = read_video_meta(config.video_path)
        self.cap = cv2.VideoCapture(str(config.video_path))
        if not self.cap.isOpened():
            raise FileNotFoundError(f"Cannot open video: {config.video_path}")

        self.session_dir = ingest_session_dir(config.out_root, config.player, config.session)
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.manual_path = self.session_dir / "manual_clips.json"

        self.doc = self._load_or_init_doc()
        self.current_frame = max(0, min(config.start_frame, self.meta.frame_count - 1))
        self.playing = False
        self.start_marker: Optional[int] = None
        self.end_marker: Optional[int] = None
        self.current_pitch_idx = max([c.pitch_idx for c in self.doc.clips], default=0) + 1
        self.pitch_clip_counts = self._build_pitch_clip_counts()
        self.dirty = False
        self.quit_armed = False
        self.last_message = "Ready."
        self.seek_state = SeekState(max_frame=max(0, self.meta.frame_count - 1))
        self.dragging_scrub = False
        self.scrub_bar_rect = (0, 0, 0, 0)

    def _load_or_init_doc(self) -> ManualClipsDoc:
        if self.manual_path.exists():
            try:
                doc = load_manual_clips(self.manual_path)
                return doc
            except Exception as exc:
                print(f"[warn] Failed to load existing manual JSON ({exc}); starting new file.")
        return new_manual_doc(
            source_video=str(self.config.video_path.resolve()),
            player=self.config.player,
            session=self.config.session,
            fps=self.meta.fps,
            width=self.meta.width,
            height=self.meta.height,
        )

    def _build_pitch_clip_counts(self) -> dict[int, int]:
        counts: dict[int, int] = {}
        for clip in self.doc.clips:
            counts[int(clip.pitch_idx)] = counts.get(int(clip.pitch_idx), 0) + 1
        return counts

    def _count_for_current_pitch(self) -> int:
        return int(self.pitch_clip_counts.get(int(self.current_pitch_idx), 0))

    def _next_auto_angle(self) -> tuple[Optional[str], int]:
        order = self._count_for_current_pitch() + 1
        return auto_angle_for_order(order), order

    def _safe_write(self) -> None:
        write_manual_clips(self.doc, self.manual_path)
        self.dirty = False
        self.quit_armed = False
        self.last_message = f"Saved: {self.manual_path}"

    def _read_frame(self, frame_idx: int) -> np.ndarray:
        idx = max(0, min(frame_idx, self.meta.frame_count - 1))
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = self.cap.read()
        if not ok or frame is None:
            return np.zeros((self.meta.height, self.meta.width, 3), dtype=np.uint8)
        return frame

    def _draw_scrub_bar(self, out: np.ndarray) -> tuple[int, int, int, int]:
        h, w = out.shape[:2]
        x0 = SCRUB_BAR_SIDE_PAD_PX
        x1 = max(x0 + 1, w - SCRUB_BAR_SIDE_PAD_PX)
        y1 = max(SCRUB_BAR_HEIGHT_PX + 1, h - SCRUB_BAR_BOTTOM_PAD_PX)
        y0 = y1 - SCRUB_BAR_HEIGHT_PX
        cv2.rectangle(out, (x0, y0), (x1, y1), (45, 45, 45), -1)
        cv2.rectangle(out, (x0, y0), (x1, y1), (95, 95, 95), 1)

        total = max(1, self.meta.frame_count - 1)
        ratio = float(self.current_frame) / float(total)
        fill_x = x0 + int(round(ratio * float(x1 - x0)))
        cv2.rectangle(out, (x0, y0), (fill_x, y1), (84, 172, 255), -1)
        cv2.circle(out, (fill_x, y0 + SCRUB_BAR_HEIGHT_PX // 2), 6, (245, 245, 245), -1)

        frame_label = f"{self.current_frame}/{total}"
        text_x = max(x0, min(fill_x - 30, x1 - 80))
        cv2.putText(
            out,
            frame_label,
            (text_x, y0 - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (220, 220, 220),
            1,
            cv2.LINE_AA,
        )
        return (x0, y0, x1, y1)

    def _point_in_scrub_bar(self, x: int, y: int) -> bool:
        x0, y0, x1, y1 = self.scrub_bar_rect
        return x0 <= int(x) <= x1 and y0 <= int(y) <= y1

    def _request_seek_from_scrub(self, mouse_x: int) -> None:
        x0, _, x1, _ = self.scrub_bar_rect
        target = scrub_x_to_frame(mouse_x, x0, x1, self.meta.frame_count)
        self.seek_state.request_seek(target)

    def _on_mouse(self, event: int, x: int, y: int, _flags: int, _param: object) -> None:
        if event == cv2.EVENT_LBUTTONDOWN and self._point_in_scrub_bar(x, y):
            self.dragging_scrub = True
            self.playing = False
            self._request_seek_from_scrub(x)
            self.last_message = "Scrubbing timeline..."
        elif event == cv2.EVENT_MOUSEMOVE and self.dragging_scrub:
            self._request_seek_from_scrub(x)
        elif event == cv2.EVENT_LBUTTONUP and self.dragging_scrub:
            self._request_seek_from_scrub(x)
            self.dragging_scrub = False
            self.last_message = "Scrub complete."

    def _draw_overlay(self, frame: np.ndarray) -> np.ndarray:
        out = frame.copy()
        h = out.shape[0]
        pad = 8
        auto_angle, auto_order = self._next_auto_angle()
        if auto_angle is None:
            auto_label = f"limit reached ({MAX_ANGLES_PER_PITCH}/{MAX_ANGLES_PER_PITCH})"
        else:
            auto_label = f"{auto_angle} ({auto_order}/{MAX_ANGLES_PER_PITCH})"
        mode = "SCRUB" if self.dragging_scrub else ("PLAY" if self.playing else "PAUSE")
        lines: list[str] = [
            f"frame: {self.current_frame}/{max(0, self.meta.frame_count - 1)}",
            f"time: {self.current_frame / max(self.meta.fps, 1e-6):.3f}s",
            f"pitch_idx: {self.current_pitch_idx}",
            f"auto_angle: {auto_label}",
            f"start: {self.start_marker if self.start_marker is not None else '-'}",
            f"end: {self.end_marker if self.end_marker is not None else '-'}",
            f"pitch clips: {self._count_for_current_pitch()}/{MAX_ANGLES_PER_PITCH}",
            f"committed clips: {len(self.doc.clips)}",
            f"status: {mode}",
            f"msg: {self.last_message}",
        ]

        if self._clip_ready():
            lines.append("CLIP READY")

        font = cv2.FONT_HERSHEY_SIMPLEX
        scale = 0.55
        thickness = 1
        y = 22
        max_w = 0
        for line in lines:
            (tw, th), _ = cv2.getTextSize(line, font, scale, thickness)
            max_w = max(max_w, tw)
        box_h = 28 + len(lines) * 20
        cv2.rectangle(out, (pad, pad), (pad + max_w + 16, pad + box_h), (0, 0, 0), -1)
        cv2.rectangle(out, (pad, pad), (pad + max_w + 16, pad + box_h), (110, 110, 110), 1)
        for line in lines:
            color = (180, 180, 180)
            if line == "CLIP READY":
                color = (0, 220, 120)
            cv2.putText(out, line, (pad + 8, y), font, scale, color, thickness, cv2.LINE_AA)
            y += 20

        help_text = (
            "Space play/pause | s start | e end | c commit | u undo | n/p pitch | "
            ",/. +/-10f | [ ] +/-0.25s | w save | q quit | mouse drag scrub"
        )
        help_y = h - (SCRUB_BAR_HEIGHT_PX + SCRUB_BAR_BOTTOM_PAD_PX + 14)
        cv2.rectangle(out, (pad, help_y - 16), (out.shape[1] - pad, help_y + 4), (0, 0, 0), -1)
        cv2.putText(out, help_text, (pad + 6, help_y), font, 0.45, (170, 170, 170), 1, cv2.LINE_AA)

        self.scrub_bar_rect = self._draw_scrub_bar(out)
        return out

    def _clip_ready(self) -> bool:
        auto_angle, _ = self._next_auto_angle()
        return (
            self.start_marker is not None
            and self.end_marker is not None
            and self.end_marker > self.start_marker
            and auto_angle is not None
        )

    def _commit_clip(self) -> None:
        if self.start_marker is None or self.end_marker is None or self.end_marker <= self.start_marker:
            self.last_message = "Commit blocked: set start/end and ensure end > start."
            return

        auto_angle, auto_order = self._next_auto_angle()
        if auto_angle is None:
            self.last_message = "Commit blocked: only 3 angles allowed (front/behind/open-side)."
            return

        clip = ManualClip(
            pitch_idx=self.current_pitch_idx,
            angle=auto_angle,
            start_frame=int(self.start_marker),
            end_frame=int(self.end_marker),
            order=int(auto_order),
            notes="",
        )
        self.doc.clips.append(clip)
        self.pitch_clip_counts[self.current_pitch_idx] = self._count_for_current_pitch() + 1
        self.dirty = True
        commit_msg = f"Committed: pitch {clip.pitch_idx}, angle {clip.angle} ({auto_order}/{MAX_ANGLES_PER_PITCH})"
        self.start_marker = None
        self.end_marker = None
        # Safe incremental write so manual work is not lost.
        self._safe_write()
        self.last_message = commit_msg

    def _undo_last(self) -> None:
        if not self.doc.clips:
            self.last_message = "Undo ignored: no clips."
            return
        removed = self.doc.clips.pop()
        self.current_pitch_idx = max(1, removed.pitch_idx)
        count = max(0, self.pitch_clip_counts.get(removed.pitch_idx, 1) - 1)
        if count == 0:
            self.pitch_clip_counts.pop(removed.pitch_idx, None)
        else:
            self.pitch_clip_counts[removed.pitch_idx] = count
        self.dirty = True
        undo_msg = f"Undo: removed pitch {removed.pitch_idx} {removed.angle}"
        self._safe_write()
        self.last_message = undo_msg

    def _step(self, delta: int) -> None:
        self.current_frame = max(0, min(self.current_frame + int(delta), self.meta.frame_count - 1))

    def _jump_seconds(self, seconds: float) -> None:
        delta = int(round(seconds * self.meta.fps))
        self._step(delta)

    def run(self) -> Path:
        cv2.namedWindow(self.config.window_name, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(self.config.window_name, 1280, 720)
        cv2.setMouseCallback(self.config.window_name, self._on_mouse)
        try:
            while True:
                seek_frame = self.seek_state.consume_seek()
                if seek_frame is not None:
                    self.current_frame = seek_frame

                frame = self._read_frame(self.current_frame)
                display = self._draw_overlay(frame)
                cv2.imshow(self.config.window_name, display)

                delay = 16 if self.playing and not self.dragging_scrub else 30
                key = cv2.waitKey(delay) & 0xFF
                if self.playing:
                    if self.current_frame < self.meta.frame_count - 1:
                        self.current_frame += 1
                    else:
                        self.playing = False

                if key == 255:
                    continue
                self.quit_armed = False if key not in (ord("q"), ord("w")) else self.quit_armed

                if key == ord(" "):
                    self.playing = not self.playing
                    self.last_message = "Play" if self.playing else "Pause"
                elif key == ord(","):
                    self.playing = False
                    self._step(-10)
                elif key == ord("."):
                    self.playing = False
                    self._step(+10)
                elif key == ord("["):
                    self.playing = False
                    self._jump_seconds(-0.25)
                elif key == ord("]"):
                    self.playing = False
                    self._jump_seconds(+0.25)
                elif key == ord("s"):
                    self.start_marker = self.current_frame
                    self.last_message = f"Start set at frame {self.start_marker}"
                elif key == ord("e"):
                    self.end_marker = self.current_frame
                    self.last_message = f"End set at frame {self.end_marker}"
                elif key == ord("c"):
                    self._commit_clip()
                elif key == ord("u"):
                    self._undo_last()
                elif key == ord("n"):
                    self.current_pitch_idx += 1
                    self.last_message = f"pitch_idx -> {self.current_pitch_idx}"
                elif key == ord("p"):
                    self.current_pitch_idx = max(1, self.current_pitch_idx - 1)
                    self.last_message = f"pitch_idx -> {self.current_pitch_idx}"
                elif key == ord("w"):
                    self._safe_write()
                elif key == ord("q"):
                    if self.dirty and not self.quit_armed:
                        self.quit_armed = True
                        self.last_message = "Unsaved changes. Press w to save, or q again to quit."
                    else:
                        break
        finally:
            self.cap.release()
            cv2.destroyWindow(self.config.window_name)

        if self.dirty:
            self._safe_write()
        return self.manual_path


def run_clipper(
    video_path: Path,
    player: str,
    session: str,
    out_root: Path,
    start_frame: int = 0,
) -> Path:
    ui = ManualClipperUI(
        ClipperConfig(
            video_path=video_path,
            player=player,
            session=session,
            out_root=out_root,
            start_frame=start_frame,
        )
    )
    return ui.run()
