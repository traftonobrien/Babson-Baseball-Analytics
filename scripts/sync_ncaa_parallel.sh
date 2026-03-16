#!/usr/bin/env bash
# Parallel NCAA stats sync — splits teams into N shards per type, runs all in parallel, merges.
# Usage: ./scripts/sync_ncaa_parallel.sh [--shards 4] [--years 2026] [--total-teams 381]
#
# Runs SHARDS*2 Rscript processes simultaneously (e.g. 4 pitching + 4 batting = 8 parallel).
# Each shard writes raw rows to a temp file; a final merge step computes derived metrics.
# ~4x faster than sequential sync for 4 shards.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
R_SCRIPT="$SCRIPT_DIR/sync_collegebaseball_leaderboard.R"
OUT_DIR="$REPO_ROOT/web/public/college-stats"
LOG_DIR="/tmp/ncaa-sync-$$"

SHARDS=4
YEARS=2026
TOTAL_TEAMS=381
MAX_WAIT_PITCH=8
MAX_WAIT_BAT=10

while [[ $# -gt 0 ]]; do
  case "$1" in
    --shards)       SHARDS="$2";       shift 2 ;;
    --years)        YEARS="$2";        shift 2 ;;
    --total-teams)  TOTAL_TEAMS="$2";  shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

mkdir -p "$LOG_DIR"
shard_size=$(( (TOTAL_TEAMS + SHARDS - 1) / SHARDS ))
pids=()
shard_logs=()

launch_shard() {
  local type=$1
  local idx=$2
  local max_wait=$3
  local offset=$(( idx * shard_size ))
  local shard_file="$OUT_DIR/${type}-${YEARS}-shard-${idx}.json"
  local log_file="$LOG_DIR/${type}-${idx}.log"

  shard_logs+=("$log_file")
  echo "[parallel] ${type} shard ${idx}: teams $((offset+1))–$((offset+shard_size)) → $(basename "$shard_file")"

  Rscript "$R_SCRIPT" \
    --years "$YEARS" \
    --types "$type" \
    --offset "$offset" \
    --limit "$shard_size" \
    --shard-out "$shard_file" \
    --max-wait-seconds "$max_wait" \
    >"$log_file" 2>&1 &

  pids+=($!)
}

echo "=== Launching ${SHARDS} pitching shards ==="
for i in $(seq 0 $((SHARDS - 1))); do
  launch_shard pitching "$i" "$MAX_WAIT_PITCH"
done

echo "=== Launching ${SHARDS} batting shards ==="
for i in $(seq 0 $((SHARDS - 1))); do
  launch_shard batting "$i" "$MAX_WAIT_BAT"
done

echo "=== ${#pids[@]} shard processes running. Logs in $LOG_DIR ==="

# Poll progress every 15s while waiting
while true; do
  sleep 15
  all_done=true
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      all_done=false
      break
    fi
  done
  # Print latest tail from each log
  echo "--- progress $(date +%H:%M:%S) ---"
  for log in "${shard_logs[@]}"; do
    [[ -f "$log" ]] && tail -1 "$log"
  done
  [[ "$all_done" == "true" ]] && break
done

# Collect exit codes
failed=0
for pid in "${pids[@]}"; do
  if ! wait "$pid" 2>/dev/null; then
    failed=$((failed + 1))
  fi
done

if [[ "$failed" -gt 0 ]]; then
  echo "ERROR: $failed shard(s) failed. Logs in $LOG_DIR"
  for log in "${shard_logs[@]}"; do
    echo "=== $log ===" && tail -20 "$log"
  done
  exit 1
fi

echo "=== All shards complete. Merging and computing derived metrics... ==="
Rscript "$R_SCRIPT" \
  --years "$YEARS" \
  --types pitching batting \
  --merge-shards

rm -rf "$LOG_DIR"
echo "=== Done. Run: npm --prefix web run build ==="
