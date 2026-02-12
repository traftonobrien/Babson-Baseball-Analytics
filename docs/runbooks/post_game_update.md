## Post-Game Update Workflow

Use this workflow after a game (or after uploading new pitch-tracker footage) to import boxscore stats, store deterministic JSON, and optionally link game stats to an outing.

### Basic import

```bash
python3 scripts/post_game_update.py \
  --boxscore-url "https://babsonathletics.com/sports/baseball/stats/2025/suffolk/boxscore/14570" \
  --team babson \
  --players "Chase Burrows" "Dillon James"
```

### Link a game to an outing

```bash
python3 scripts/post_game_update.py \
  --boxscore-url "https://babsonathletics.com/sports/baseball/stats/2025/suffolk/boxscore/14570" \
  --team babson \
  --players "Chase Burrows" "Dillon James" \
  --outing-map "CBurrows1=2025_03_26" "DJames1=2025_03_26"
```

This writes/merges:

- `web/public/stats/games/<season>/<gameId>.json`
- `web/public/stats/players/<slug>/<season>/<gameId>.json`
- `web/public/stats/seasons/<season>/games.json`
- `web/public/data/<playerId>/<dateId>/outing_meta.json` (if `--outing-map` provided)
- `web/public/stats/players/index.json` (playerId → slug mapping)

### Fixture (offline) mode

```bash
python3 scripts/post_game_update.py \
  --boxscore-url "https://babsonathletics.com/sports/baseball/stats/2025/suffolk/boxscore/14570" \
  --players "Chase Burrows" \
  --fixture tests/fixtures/sidearm/14570.html \
  --dry-run
```

### Common failures

- **Player not found in boxscore**: name mismatch (try exact display name). The script continues with other players.
- **Outing folder missing**: ensure `web/public/data/<playerId>/<dateId>/` exists before linking.
- **Opponent shows a score**: re-run after updating fixture or confirm the boxscore title is intact.

### Tests

```bash
python3 -m compileall scripts src
pytest -q
npm --prefix web run test
```
