#!/usr/bin/env bash
set -e

OUTING_ID="$1"

if [ -z "$OUTING_ID" ]; then
  echo "Usage: ./publish_outing.sh yyyy_mm_dd_LASTNAME"
  exit 1
fi

OUTING_DIR="outings/$OUTING_ID"
WEB_DIR="web/public/data/$OUTING_ID"

echo "Publishing outing: $OUTING_ID"

# Create destination folders
mkdir -p "$WEB_DIR/results"
mkdir -p "$WEB_DIR/clips"

# Copy CSV
cp "$OUTING_DIR/pitch_data_overlay_lite.csv" "$WEB_DIR/"

# Copy overlay videos
cp "$OUTING_DIR/results/"pitch_*_overlay.mp4 "$WEB_DIR/results/"

# Copy clips (optional fallback videos)
cp "$OUTING_DIR/clips/"pitch_*.mp4 "$WEB_DIR/clips/" || true

echo "Files copied."

# Git add
git add "$WEB_DIR" web/lib/dataIndex.ts

# Commit
git commit -m "Add outing $OUTING_ID"

# Push
git push

echo ""
echo "✅ Outing published!"
echo "Vercel will redeploy automatically."
echo "Check: /data/$OUTING_ID/pitch_data_overlay_lite.csv"
