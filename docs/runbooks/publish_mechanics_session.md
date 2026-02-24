## Publish a Mechanics Session to the Web App

Step-by-step runbook for publishing mechanics coach-pack results to the Mechanics Hub.

### Prerequisites

A mechanics session has been processed. These files exist in `output/mechanics/<player_slug>/<session_slug>/coach_pack/`:

```
notes.json
set.png
peak_leg_lift.png
foot_strike.png
release.png
slowmo_review.mp4
strip.png                    (optional — not currently served by web)
hold_review.mp4              (optional — not currently served by web)
set_to_fs.mp4                (optional)
fs_to_release.mp4            (optional)
release.mp4                  (optional)
```

### Step 1: Run the mechanics coach pack (if not already done)

```bash
.venv/bin/python scripts/mechanics_coach_pack.py \
  --video "<path_to_clip>" \
  --hand R \
  --view open_side \
  --slowmo \
  --hold-review
```

Output lands in `output/mechanics/<player_slug>/<session_slug>/coach_pack/`.

### Step 2: Copy assets to web/public

```bash
PLAYER=<player_slug>
SESSION=<session_slug>

mkdir -p web/public/mechanics/${PLAYER}/${SESSION}

cp output/mechanics/${PLAYER}/${SESSION}/coach_pack/notes.json \
   web/public/mechanics/${PLAYER}/${SESSION}/

cp output/mechanics/${PLAYER}/${SESSION}/coach_pack/set.png \
   output/mechanics/${PLAYER}/${SESSION}/coach_pack/peak_leg_lift.png \
   output/mechanics/${PLAYER}/${SESSION}/coach_pack/foot_strike.png \
   output/mechanics/${PLAYER}/${SESSION}/coach_pack/release.png \
   web/public/mechanics/${PLAYER}/${SESSION}/

cp output/mechanics/${PLAYER}/${SESSION}/coach_pack/slowmo_review.mp4 \
   web/public/mechanics/${PLAYER}/${SESSION}/
```

### Step 3: Update web/public/mechanics/index.json

Open `web/public/mechanics/index.json`. This is the hub index that drives the Mechanics Hub page.

**If the player already exists**, update their session entry or add a new session to the `sessions` array.

**If the player is new**, add a new player object:

```json
{
  "slug": "<player_slug>",
  "profile_slug": "<profile_slug_for_player_page>",
  "player_id": "<PlayerId>",
  "name": "First Last",
  "sessions": [
    {
      "slug": "<session_slug>",
      "date": "YYYY-MM-DD",
      "label": "Mon DD — Open Side",
      "efficiency_score": <from notes.json>,
      "efficiency_low_confidence": <from notes.json>,
      "hand": "R",
      "view_mode": "open_side",
      "pass_count": <count metrics with pass_fail=true>,
      "fail_count": <count metrics with pass_fail=false>,
      "avg_confidence": <mean of all metric confidences>,
      "low_confidence_count": <count metrics with low_confidence=true>
    }
  ]
}
```

Calculate the summary fields from `notes.json`:

```python
import json, statistics
notes = json.load(open("output/mechanics/.../coach_pack/notes.json"))
metrics = notes["metrics"]
pass_count = sum(1 for m in metrics.values() if m["pass_fail"] is True)
fail_count = sum(1 for m in metrics.values() if m["pass_fail"] is False)
avg_confidence = round(statistics.mean(m["confidence"] for m in metrics.values()), 2)
low_confidence_count = sum(1 for m in metrics.values() if m["low_confidence"])
```

### Step 4: Verify

```bash
# TypeScript compiles
cd web && npx tsc --noEmit

# Local dev check (optional)
npm run dev
# Visit http://localhost:3000/mechanics — confirm session card appears
# Visit http://localhost:3000/mechanics/session/<player_slug>/<session_slug> — confirm data loads
```

### Step 5: Commit and push

```bash
git add web/public/mechanics/
git commit -m "publish mechanics session: <player_slug>/<session_slug>"
git push
```

Vercel redeploys automatically on push to main.

---

### Web architecture reference

The mechanics web app loads data from static files under `web/public/mechanics/`:

```
web/public/mechanics/
  index.json                              ← hub index (all players + sessions)
  <player_slug>/
    <session_slug>/
      notes.json                          ← full session data (metrics, phases, confidence)
      set.png                             ← phase key-frame images
      peak_leg_lift.png
      foot_strike.png
      release.png
      slowmo_review.mp4                   ← slow-motion review video
```

**Route mapping:**

| URL | Data source |
|---|---|
| `/mechanics` | `web/public/mechanics/index.json` → `MechanicsHubView.tsx` |
| `/mechanics/session/<player>/<session>` | `web/public/mechanics/<player>/<session>/notes.json` → `MechanicsSessionView.tsx` |
| `/mechanics/player/<slug>` | Filtered from `index.json` → `MechanicsPlayerView.tsx` |

**Key components:**

| Component | What it does |
|---|---|
| `MechanicsHubView` | Hub page — player cards with latest efficiency score |
| `MechanicsSessionView` | Session detail — hero, top issues, film room, phase breakdown, all metrics, context |
| `MechanicsHero` | Sticky header with score + session label |
| `MechanicsTopInsights` | Top 3 priority issues |
| `MechanicsFilmRoom` | Phase images + slowmo video |
| `PhaseInsightPanels` | Per-phase metric breakdown |
| `MetricQuickScanGrid` | All metrics grid |
| `MechanicsConfidencePanel` | Camera view, pose backend, angle validation, not measurable, low confidence |
| `MetricDetailModal` | Drill-down modal for individual metric |

**Type definitions:** `web/lib/mechanics/types.ts` — `NotesJson`, `MetricResult`, `PhaseFrame`

**notes.json fields (v4 engine):**

Top-level fields include `efficiency_score`, `hand`, `view_mode`, `model_version`, `pose_backend` (mediapipe/vitpose), `angle_validated` (bool, optional), `angle_confidence` (float, optional).

Per-metric fields include `score`, `score_raw`, `score_eff`, `confidence`, `low_confidence`, `metric_reliability` (high/medium/low), `reasons`, `coaching_cues`.

### Naming conventions

- `player_slug`: lowercase, underscored (e.g. `trafton_obrien`)
- `session_slug`: lowercase, underscored (e.g. `trafton_mechanics_test`, `feb_21_bullpen`)
- `player_id`: CamelCase with number suffix (e.g. `TOBrien1`) — used in command outings (`web/public/data/`)
- `profile_slug`: matches the `/players/[slug]` route (e.g. `obrien_trafton`)
