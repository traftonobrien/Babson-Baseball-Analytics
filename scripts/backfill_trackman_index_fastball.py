"""Add avgFastballVelo to each row in web/public/trackman/index.json from session_summary."""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from trackman.summary import fastball_avg_from_session_summary  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
INDEX_PATH = os.path.join(ROOT, "web", "public", "trackman", "index.json")
PUBLIC = os.path.join(ROOT, "web", "public")


def main() -> None:
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        rows = json.load(f)
    for row in rows:
        sp = row.get("summaryPath")
        if not sp or not isinstance(sp, str):
            continue
        path = os.path.join(PUBLIC, sp.lstrip("/"))
        if not os.path.isfile(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            summary = json.load(f)
        row["avgFastballVelo"] = fastball_avg_from_session_summary(summary)
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
