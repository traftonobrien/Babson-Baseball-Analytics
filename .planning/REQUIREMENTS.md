# Requirements: Command Tracker v2

**Defined:** 2026-04-17
**Milestone:** v5.0 — Automated Pitch Detection and Glove Tracking
**Core Value:** One operator can process a full game of command data in 15–20 minutes instead of 1–2 hours, with the computer finding and selecting frames and the human only verifying proposals.

---

## v5.0 Requirements

### Calibration

Pre-work phase. Empirical measurements on existing processed footage that set thresholds for all downstream phases. No new user-facing behavior — outputs are documented constants and calibration artifacts.

- [ ] **CALIB-01**: Engineer measures glove mask area timeseries for 20+ ground-truthed pitches from existing outings and documents the open/closed area ratio and drop magnitude per catcher
- [ ] **CALIB-02**: Engineer measures leg lift peak-to-release frame interval for Babson pitchers at current camera FPS and documents the window width to use
- [ ] **CALIB-03**: Engineer validates T-frame precision tolerance by re-processing pitches with T shifted ±3, ±5, ±10 frames and measuring miss vector degradation

### Pitch Detection

Automatic detection of when pitches occur in full inning video. Replaces the scrubbing step in `mark_pitches.py`.

- [ ] **DETECT-01**: System detects pitch onset windows from a full inning video file using MediaPipe Pose on the pitcher ROI
- [ ] **DETECT-02**: System writes `pitch_windows.json` containing frame_start, frame_end, and confidence score for each detected pitch
- [ ] **DETECT-03**: System achieves ≥90% pitch recall and ≤10% false positive rate on a 5-inning validation set (ground-truthed manually)
- [ ] **DETECT-04**: System correctly detects pitches from both windup and stretch mechanics without additional configuration
- [ ] **DETECT-05**: System falls back to optical flow magnitude spike detection when MediaPipe Pose is unreliable (low visibility, occlusion)

### Glove Tracking

Automated glove segmentation and tracking across the full inning. Replaces `interactive_select()` in `track_glove.py` and the manual glove-click step in `batch_process.py`.

- [ ] **TRACK-01**: System initializes glove tracking using SAM3 text prompt ("catcher's glove") without any human click or bounding box input
- [ ] **TRACK-02**: ByteTrack assigns a persistent glove object ID that survives brief occlusions (pitcher body crossing, frame boundary)
- [ ] **TRACK-03**: SAMURAI motion-aware memory stabilizes glove mask during fast-motion reception frames where SAM3 alone degrades
- [ ] **TRACK-04**: System writes per-frame glove centroid (x, y) and mask area to a timeseries artifact covering the full inning

### Automated T/A Detection

State machine that identifies target frame (T) and arrival frame (A) within each pitch window from the glove timeseries. Replaces the human-operated frame-marking step.

- [ ] **AUTO-01**: System automatically selects T frame as the last stable-plateau frame within the pitch window where glove area is large (open/set position)
- [ ] **AUTO-02**: System automatically selects A frame as the first frame within the pitch window where glove area drops sharply below threshold (closure = reception)
- [ ] **AUTO-03**: Auto-detected T is within ±3 frames of human-marked T in ≥85% of pitches on validation set
- [ ] **AUTO-04**: Auto-detected A is within ±3 frames of human-marked A in ≥85% of pitches on validation set
- [ ] **AUTO-05**: Each auto-detected T/A pair includes a confidence score; pitches below threshold are flagged for full-scrubber fallback

### Verification UX

Streamlined human review interface. Replaces the full-inning scrubber in `mark_pitches.py` with a proposal-confirm flow.

- [ ] **VERIFY-01**: Operator sees a strip view of ±3 frames around auto-detected T and ±3 frames around auto-detected A for each pitch
- [ ] **VERIFY-02**: Operator confirms or nudges T/A boundary with a single keypress (arrow keys to shift ±1 frame, Enter to confirm)
- [ ] **VERIFY-03**: Operator selects pitch type from arsenal via number keys 1–9 (same key mapping as current `mark_pitches.py`)
- [ ] **VERIFY-04**: Pitches flagged as low-confidence automatically open the full scrubber view for manual T/A selection
- [ ] **VERIFY-05**: Average operator time per pitch in the verification pass is ≤20 seconds

### Charting Integration

Automatic matching of detected pitch clips to charting game data to pre-fill pitch type and eliminate re-entry.

- [ ] **CHART-01**: System aligns auto-detected pitch windows to charting PA sequence by inning and order when a charting game record exists
- [ ] **CHART-02**: Pitch type is pre-filled from charting data and shown to operator for confirmation when detected pitch count matches charted pitch count
- [ ] **CHART-03**: When detected and charted pitch counts differ, system surfaces an exception UX showing which windows are unmatched for manual resolution
- [ ] **CHART-04**: Full pipeline (detect → track → T/A → verify → output) completes in under 20 minutes for a standard 9-inning game

---

## v6.0 Requirements (Deferred)

### VLM Ambiguity Resolution

- **VLM-01**: System sends low-confidence T/A candidate frames to a VLM (Gemini or Claude) for automated resolution without human input
- **VLM-02**: VLM resolution is correct in ≥80% of ambiguous cases on validation set
- **VLM-03**: API cost per game stays under $0.50 at typical ambiguous-pitch volume
- **VLM-04**: VLM resolver only activates for pitches below a configurable confidence threshold (cost control)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Ball flight tracking | Eliminated — miss metric is glove centroid at T vs. glove centroid at A; ball trajectory not needed |
| Pitch type classification by computer | Human does this in 5 sec from clip; charting integration makes it moot |
| Full automation with zero human verification | Verification step is valuable for data quality; target fast verification, not zero |
| Changing miss calculation or CSV schema | `batch_process.py` outputs are downstream consumers; schema change is a separate breaking milestone |
| Multi-camera or tracking camera support | Single fixed center-field camera only |
| Real-time (live game) processing | Offline post-game processing only in v5.0 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CALIB-01 | Phase 25 | Pending |
| CALIB-02 | Phase 25 | Pending |
| CALIB-03 | Phase 25 | Pending |
| DETECT-01 | Phase 26 | Pending |
| DETECT-02 | Phase 26 | Pending |
| DETECT-03 | Phase 26 | Pending |
| DETECT-04 | Phase 26 | Pending |
| DETECT-05 | Phase 26 | Pending |
| TRACK-01 | Phase 27 | Pending |
| TRACK-02 | Phase 27 | Pending |
| TRACK-03 | Phase 27 | Pending |
| TRACK-04 | Phase 27 | Pending |
| AUTO-01 | Phase 28 | Pending |
| AUTO-02 | Phase 28 | Pending |
| AUTO-03 | Phase 28 | Pending |
| AUTO-04 | Phase 28 | Pending |
| AUTO-05 | Phase 28 | Pending |
| VERIFY-01 | Phase 29 | Pending |
| VERIFY-02 | Phase 29 | Pending |
| VERIFY-03 | Phase 29 | Pending |
| VERIFY-04 | Phase 29 | Pending |
| VERIFY-05 | Phase 29 | Pending |
| CHART-01 | Phase 30 | Pending |
| CHART-02 | Phase 30 | Pending |
| CHART-03 | Phase 30 | Pending |
| CHART-04 | Phase 30 | Pending |

**Coverage:**
- v5.0 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 — initial definition for milestone v5.0*
