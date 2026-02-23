#!/usr/bin/env python3
"""
Sync D3 pitching leaderboard data from the D3 Dashboard API.

Fetches 2025 and 2026 Division III pitching leaderboards and writes them to
web/public/d3/ so the app can serve cached data. Intended to run daily via
GitHub Actions so player profiles always have current game stats.

Usage:
    D3_DASHBOARD_API_KEY=xxx python3 scripts/sync_d3_leaderboard.py
    D3_DASHBOARD_API_KEY=xxx python3 scripts/sync_d3_leaderboard.py --years 2025 2026

Environment:
    D3_DASHBOARD_API_KEY  Required. API key for d3-dashboard.com.
"""

import argparse
import json
import os
import sys
from pathlib import Path

import requests

D3_BASE = "https://d3-dashboard.com/api"


def fetch_leaderboard(api_key: str, year: str, division: int = 3) -> dict:
    """Fetch pitching leaderboard from D3 API."""
    url = f"{D3_BASE}/pitching"
    params = {"years": year, "division": str(division)}
    headers = {"X-API-Key": api_key, "Accept": "application/json"}

    resp = requests.get(url, params=params, headers=headers, timeout=30)

    if resp.status_code >= 300 and resp.status_code < 400:
        raise RuntimeError(
            f"D3 API redirected ({resp.status_code}) — likely auth issue. "
            f"Location: {resp.headers.get('location', '')}"
        )
    if not resp.ok:
        raise RuntimeError(
            f"D3 API error {resp.status_code}: {resp.text[:300]}"
        )

    return resp.json()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sync D3 pitching leaderboard to web/public/d3/"
    )
    parser.add_argument(
        "--years",
        nargs="+",
        default=["2025"],
        help="Years to fetch (default: 2025). Add 2026 when D3 API supports it.",
    )
    parser.add_argument(
        "--division",
        type=int,
        default=3,
        help="Division (default: 3)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch but do not write files",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    api_key = os.environ.get("D3_DASHBOARD_API_KEY")
    if not api_key:
        # Try loading from web/.env.local (for local runs)
        env_path = repo_root / "web" / ".env.local"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("D3_DASHBOARD_API_KEY=") and "=" in line:
                    api_key = line.split("=", 1)[1].strip().strip("'\"")
                    break
    if not api_key:
        print("Error: D3_DASHBOARD_API_KEY required (env var or web/.env.local)", file=sys.stderr)
        return 1

    out_dir = repo_root / "web" / "public" / "d3"
    out_dir.mkdir(parents=True, exist_ok=True)

    for year in args.years:
        try:
            data = fetch_leaderboard(api_key, year, args.division)
        except Exception as e:
            print(f"Error fetching {year}: {e}", file=sys.stderr)
            print(f"Skipping {year}. (D3 API may not support this year yet.)", file=sys.stderr)
            continue

        out_path = out_dir / f"{year}.json"
        if args.dry_run:
            print(f"[dry-run] Would write {len(json.dumps(data))} bytes to {out_path}")
            continue

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=0, separators=(",", ":"))

        print(f"Wrote {out_path} ({len(json.dumps(data))} bytes)")

    # Write metadata for freshness
    if not args.dry_run:
        from datetime import datetime, timezone
        meta_path = out_dir / "meta.json"
        meta = {}
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        meta["synced_at"] = datetime.now(timezone.utc).isoformat()
        meta["years"] = args.years
        meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        print(f"Wrote {meta_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
