"""
Tests for src/mechanics/video_io.py.

These tests do NOT require a real video file.
Slow/IO tests use mocked cv2.VideoCapture.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import cv2
from src.mechanics.video_io import VideoMeta, read_video_meta, save_frame


class TestVideoMeta:
    def test_duration_normal(self):
        meta = VideoMeta(path="/t.mp4", fps=30.0, frame_count=150, width=1920, height=1080)
        assert abs(meta.duration_s - 5.0) < 0.001

    def test_duration_zero_fps(self):
        meta = VideoMeta(path="/t.mp4", fps=0.0, frame_count=100, width=640, height=480)
        assert meta.duration_s == 0.0

    def test_duration_non_integer(self):
        meta = VideoMeta(path="/t.mp4", fps=29.97, frame_count=299, width=1280, height=720)
        # 299 / 29.97 ≈ 9.977 s
        assert 9.9 < meta.duration_s < 10.1

    def test_str_contains_fps_and_size(self):
        meta = VideoMeta(path="/t.mp4", fps=60.0, frame_count=60, width=1920, height=1080)
        s = str(meta)
        assert "60.00" in s
        assert "1920" in s
        assert "1080" in s


class TestReadVideoMeta:
    def test_missing_file_raises(self):
        with pytest.raises(FileNotFoundError):
            read_video_meta("/nonexistent/definitely/not/here/file.mp4")

    @patch("cv2.VideoCapture")
    def test_returns_correct_values(self, MockCap):
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        # CAP_PROP_FRAME_WIDTH=3, HEIGHT=4, FPS=5, FRAME_COUNT=7
        prop_map = {
            cv2.CAP_PROP_FRAME_WIDTH:  1920.0,
            cv2.CAP_PROP_FRAME_HEIGHT: 1080.0,
            cv2.CAP_PROP_FPS:          30.0,
            cv2.CAP_PROP_FRAME_COUNT:  300.0,
        }
        mock_cap.get.side_effect = lambda p: prop_map.get(p, 0.0)
        MockCap.return_value = mock_cap

        meta = read_video_meta("/fake/video.mp4")

        assert meta.fps == 30.0
        assert meta.frame_count == 300
        assert meta.width == 1920
        assert meta.height == 1080
        assert abs(meta.duration_s - 10.0) < 0.001

    @patch("cv2.VideoCapture")
    def test_releases_capture_on_success(self, MockCap):
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_cap.get.return_value = 30.0
        MockCap.return_value = mock_cap

        read_video_meta("/fake/video.mp4")
        mock_cap.release.assert_called_once()


class TestSaveFrame:
    def test_creates_parent_dirs(self):
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "subdir" / "nested" / "frame.png"
            save_frame(frame, out)
            assert out.exists()

    def test_saves_png(self):
        frame = np.full((50, 50, 3), 128, dtype=np.uint8)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "frame.png"
            save_frame(frame, out)
            loaded = cv2.imread(str(out))
            assert loaded is not None
            assert loaded.shape == (50, 50, 3)
