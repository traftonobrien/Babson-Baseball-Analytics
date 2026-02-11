## Coordinates and Handedness

Canonical reference for the coordinate system, miss direction logic, and handedness conventions. Any code or documentation that contradicts this file is wrong.

### Image Coordinate System

- **Origin:** Top-left corner of the image/frame.
- **+X:** Rightward (toward first base).
- **+Y:** Downward (toward the ground).

All spatial descriptions use the center-field camera perspective.

### Miss Calculation

```
dx = ball_x - target_x    (positive = ball is RIGHT of target = toward 1B)
dy = ball_y - target_y    (positive = ball is BELOW target = lower pitch)
```

- **Target position:** Centroid of SAM 2 glove mask on the target frame.
- **Ball position:** Centroid of SAM 2 ball segmentation on the arrival frame.

### Vertical Direction

| `dy` sign | Image meaning | Pitch meaning |
|---|---|---|
| `dy < 0` | Ball is ABOVE target | Pitch missed **HIGH** |
| `dy > 0` | Ball is BELOW target | Pitch missed **LOW** |

### Horizontal Direction (Arm-Side / Glove-Side)

| Pitcher Hand | dx > 0 (ball right of target) | dx < 0 (ball left of target) |
|---|---|---|
| **RHP** | arm-side | glove-side |
| **LHP** | glove-side | arm-side |

```python
arm_sign = 1 if pitcher_hand == "R" else -1
h_direction = "arm-side" if dx * arm_sign > 0 else "glove-side"
v_direction = "high" if dy < 0 else "low"
```

Files implementing this identically: `batch_process.py`, `calculate_miss.py`, `export_csv.py`, `visualize.py`.

### CSV Signed Convention

Set in `src/export_csv.py:build_row()`:

- `h_miss_signed`: **negative = arm-side**, positive = glove-side
- `v_miss_signed`: **negative = high**, positive = low

### Web App Convention (Arm-Side-Positive)

The web app uses the opposite sign: **positive = arm-side**, negative = glove-side.

Conversion via `toArmSideX(hMissSigned, throwsHand)` in `web/lib/handedness.ts`. Simply negates the value. All web consumers import from `handedness.ts`.

| Function | Purpose |
|---|---|
| `toArmSideX(hMissSigned, throwsHand)` | Convert CSV h_miss_signed to arm-side-positive |
| `laneOf(armSideX)` | Classify into "Arm" / "Middle" / "Glove" |
| `laneDisplayName(lane, throwsHand)` | Human label with base side |
| `hDirectionLabel(armSideX)` | "arm-side" / "glove-side" / "middle" |

### Lane Definitions

Classified using arm-side-positive value (output of `toArmSideX()`):

- **Arm side:** `armSideX >= 4` inches
- **Glove side:** `armSideX <= -4` inches
- **Middle:** `-4 < armSideX < 4` inches

Threshold: `LANE_THRESHOLD = 4` in `web/lib/handedness.ts`.

### Lane Labels

| Pitcher Hand | Arm lane | Glove lane |
|---|---|---|
| **RHP** | Arm (1B) | Glove (3B) |
| **LHP** | Arm (3B) | Glove (1B) |

### Strike Zone Quadrant Codes

9-box grid. Rows: U/M/D (up/middle/down). Columns based on pitcher hand:

| Pitcher Hand | Left column (3B side) | Middle | Right column (1B side) |
|---|---|---|---|
| **RHP** | I (In) | M (Middle) | A (Away) |
| **LHP** | A (Away) | M (Middle) | I (In) |
