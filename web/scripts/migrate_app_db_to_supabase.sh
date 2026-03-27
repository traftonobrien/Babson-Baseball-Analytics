#!/usr/bin/env bash

set -euo pipefail

function read_env_value() {
  local key="$1"
  python3 - "$key" <<'PY'
import os
import sys

key = sys.argv[1]
path = ".env.local"

if not os.path.exists(path):
    sys.exit(0)

with open(path, "r", encoding="utf-8") as handle:
    for raw_line in handle:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name != key:
            continue
        value = value.strip().strip('"').strip("'")
        print(value)
        break
PY
}

SOURCE_DATABASE_URL="${SOURCE_DATABASE_URL:-${DATABASE_URL:-$(read_env_value DATABASE_URL)}}"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-${SUPABASE_DATABASE_URL:-${CHARTING_DATABASE_URL:-$(read_env_value SUPABASE_DATABASE_URL)}}}"
APPLY="${APPLY:-0}"

if [[ -z "${SOURCE_DATABASE_URL}" ]]; then
  echo "SOURCE_DATABASE_URL is required. It can also be provided via DATABASE_URL." >&2
  exit 1
fi

if [[ -z "${TARGET_DATABASE_URL}" ]]; then
  echo "TARGET_DATABASE_URL is required. It can also be provided via SUPABASE_DATABASE_URL or CHARTING_DATABASE_URL." >&2
  exit 1
fi

if [[ "${SOURCE_DATABASE_URL}" == "${TARGET_DATABASE_URL}" ]]; then
  echo "Source and target database URLs are identical. Refusing to continue." >&2
  exit 1
fi

copy_order=(
  "login_rate_limits"
  "stuff_plus_arsenal"
  "stuff_plus_outings"
  "charting_games"
  "charting_pitcher_segments"
  "charting_lineup_entries"
  "charting_plate_appearances"
  "charting_pitches"
)

truncate_order=(
  "charting_pitches"
  "charting_plate_appearances"
  "charting_lineup_entries"
  "charting_pitcher_segments"
  "charting_games"
  "stuff_plus_outings"
  "stuff_plus_arsenal"
  "login_rate_limits"
)

function print_counts() {
  local label="$1"
  local url="$2"

  echo
  echo "${label}"
  psql "${url}" -At -F $'\t' -c "
    select 'login_rate_limits' as table_name, count(*)::bigint as row_count from login_rate_limits
    union all
    select 'stuff_plus_arsenal', count(*)::bigint from stuff_plus_arsenal
    union all
    select 'stuff_plus_outings', count(*)::bigint from stuff_plus_outings
    union all
    select 'charting_games', count(*)::bigint from charting_games
    union all
    select 'charting_pitcher_segments', count(*)::bigint from charting_pitcher_segments
    union all
    select 'charting_lineup_entries', count(*)::bigint from charting_lineup_entries
    union all
    select 'charting_plate_appearances', count(*)::bigint from charting_plate_appearances
    union all
    select 'charting_pitches', count(*)::bigint from charting_pitches
    order by table_name;
  "
}

print_counts "Source counts" "${SOURCE_DATABASE_URL}"
print_counts "Target counts before copy" "${TARGET_DATABASE_URL}"

if [[ "${APPLY}" != "1" ]]; then
  echo
  echo "Dry run only. Re-run with APPLY=1 to truncate the target tables and copy the shared app data into Supabase."
  exit 0
fi

truncate_csv="$(IFS=,; echo "${truncate_order[*]}")"

echo
echo "Truncating target tables..."
psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 -c "TRUNCATE TABLE ${truncate_csv} RESTART IDENTITY CASCADE;"

for table_name in "${copy_order[@]}"; do
  echo "Copying ${table_name}..."
  pg_dump \
    --data-only \
    --column-inserts \
    --disable-dollar-quoting \
    --no-owner \
    --no-privileges \
    --table="${table_name}" \
    "${SOURCE_DATABASE_URL}" | psql "${TARGET_DATABASE_URL}" -v ON_ERROR_STOP=1 >/dev/null
done

print_counts "Target counts after copy" "${TARGET_DATABASE_URL}"
