"""Generate a scouting command report from pitch CSV data."""

import argparse
import csv
from collections import defaultdict


def load_pitches(csv_path):
    """Load pitch data from CSV."""
    pitches = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pitches.append(row)
    return pitches


def safe_float(val, default=None):
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def zone_table(pitches_in_group):
    """Build zone breakdown table data.

    Returns list of (zone, count, h_bias, v_bias) tuples.
    """
    by_zone = defaultdict(list)
    for p in pitches_in_group:
        zone = p.get("target_zone", "").strip()
        if not zone:
            zone = "unknown"
        h_s = safe_float(p.get("h_miss_signed"))
        v_s = safe_float(p.get("v_miss_signed"))
        if h_s is not None and v_s is not None:
            by_zone[zone].append((h_s, v_s))

    rows = []
    for zone in ["inside", "middle", "outside", "unknown"]:
        if zone not in by_zone:
            continue
        vals = by_zone[zone]
        n = len(vals)
        h_avg = sum(v[0] for v in vals) / n
        v_avg = sum(v[1] for v in vals) / n
        h_label = "arm" if h_avg < 0 else "glove"
        v_label = "high" if v_avg < 0 else "low"
        rows.append((zone.capitalize(), n,
                      f"{h_avg:+.1f}\" ({h_label})",
                      f"{v_avg:+.1f}\" ({v_label})"))
    return rows


def format_table(rows):
    """Format zone rows as a text table."""
    if not rows:
        return "  No zone data available.\n"

    headers = ("Zone", "Count", "H Bias (signed)", "V Bias (signed)")
    col_widths = [max(len(headers[i]), max(len(str(r[i])) for r in rows))
                  for i in range(4)]

    def sep():
        return "  +" + "+".join("-" * (w + 2) for w in col_widths) + "+"

    def row_str(vals):
        cells = " | ".join(str(v).ljust(w) for v, w in zip(vals, col_widths))
        return f"  | {cells} |"

    lines = [sep(), row_str(headers), sep()]
    for r in rows:
        lines.append(row_str(r))
    lines.append(sep())
    return "\n".join(lines)


def generate_report(pitches, pitcher_name=None, pitcher_hand=None):
    """Generate the full command report string."""
    if not pitches:
        return "No pitch data found.\n"

    # Infer pitcher info from first row if not provided
    if pitcher_name is None:
        pitcher_name = pitches[0].get("pitcher_name", "Unknown")
    if pitcher_hand is None:
        pitcher_hand = pitches[0].get("pitcher_hand", "R")
    hand_label = "RHP" if pitcher_hand == "R" else "LHP"

    lines = []
    lines.append(f"=== COMMAND REPORT: {pitcher_name} ({hand_label}) ===")
    lines.append(f"Pitches: {len(pitches)}")
    lines.append("")

    # Overall stats
    total_misses = [safe_float(p.get("total_miss_inches")) for p in pitches]
    total_misses = [m for m in total_misses if m is not None]
    if total_misses:
        lines.append(f"Overall: {sum(total_misses)/len(total_misses):.1f}\" avg miss "
                      f"(min {min(total_misses):.1f}\", max {max(total_misses):.1f}\")")
        lines.append("")

    # Group by pitch type
    by_type = defaultdict(list)
    for p in pitches:
        pt = p.get("pitch_type", "").strip().upper() or "UNK"
        by_type[pt].append(p)

    tendencies = []

    for pt in sorted(by_type.keys()):
        group = by_type[pt]
        n = len(group)
        misses = [safe_float(p.get("total_miss_inches")) for p in group]
        misses = [m for m in misses if m is not None]

        lines.append(f"{pt} (n={n})")
        if misses:
            lines.append(f"  Overall: {sum(misses)/len(misses):.1f}\" avg miss")

        if n < 3:
            lines.append("  Limited sample - need more data.")
            lines.append("")
            continue

        lines.append("")
        lines.append("  By Zone:")
        rows = zone_table(group)
        lines.append(format_table(rows))

        # Detect tendencies
        h_vals = [safe_float(p.get("h_miss_signed")) for p in group]
        v_vals = [safe_float(p.get("v_miss_signed")) for p in group]
        h_vals = [v for v in h_vals if v is not None]
        v_vals = [v for v in v_vals if v is not None]

        if h_vals:
            h_avg = sum(h_vals) / len(h_vals)
            if abs(h_avg) > 1.5:
                side = "arm-side" if h_avg < 0 else "glove-side"
                tendencies.append(f"  {pt}: Tends {side} ({h_avg:+.1f}\" avg)")
        if v_vals:
            v_avg = sum(v_vals) / len(v_vals)
            if abs(v_avg) > 1.5:
                vert = "high" if v_avg < 0 else "low"
                tendencies.append(f"  {pt}: Tends {vert} ({v_avg:+.1f}\" avg)")

        # Per-zone tendencies
        for zone in ["inside", "outside"]:
            zone_pitches = [p for p in group
                           if p.get("target_zone", "").strip() == zone]
            if len(zone_pitches) >= 2:
                zh = [safe_float(p.get("h_miss_signed")) for p in zone_pitches]
                zh = [v for v in zh if v is not None]
                if zh and abs(sum(zh)/len(zh)) > 2.0:
                    avg = sum(zh) / len(zh)
                    side = "arm-side" if avg < 0 else "glove-side"
                    tendencies.append(
                        f"  {pt} {zone}: {side} leak ({avg:+.1f}\" avg)")

        lines.append("")

    # Recommendations
    if tendencies:
        lines.append("TENDENCIES:")
        lines.extend(tendencies)
        lines.append("")

    # Recommendations based on data
    recs = []
    all_h = [safe_float(p.get("h_miss_signed")) for p in pitches]
    all_v = [safe_float(p.get("v_miss_signed")) for p in pitches]
    all_h = [v for v in all_h if v is not None]
    all_v = [v for v in all_v if v is not None]

    if all_h:
        h_avg = sum(all_h) / len(all_h)
        if h_avg > 2.0:
            recs.append("- Work on staying through pitches (glove-side leak)")
        elif h_avg < -2.0:
            recs.append("- Work on finishing pitches (arm-side leak)")

    if all_v:
        v_avg = sum(all_v) / len(all_v)
        if v_avg > 2.0:
            recs.append("- Work on staying on top of pitches (dropping low)")
        elif v_avg < -2.0:
            recs.append("- Work on driving downhill (missing high)")

    # Check for zone-specific issues
    outside_pitches = [p for p in pitches if p.get("target_zone", "").strip() == "outside"]
    if len(outside_pitches) >= 3:
        oh = [safe_float(p.get("h_miss_signed")) for p in outside_pitches]
        oh = [v for v in oh if v is not None]
        if oh and sum(oh)/len(oh) > 2.5:
            recs.append("- Focus on staying through outside pitches (glove-side leak)")

    inside_pitches = [p for p in pitches if p.get("target_zone", "").strip() == "inside"]
    if len(inside_pitches) >= 3:
        ih = [safe_float(p.get("h_miss_signed")) for p in inside_pitches]
        ih = [v for v in ih if v is not None]
        if ih and sum(ih)/len(ih) < -2.5:
            recs.append("- Missing arm-side on inside pitches - may be pulling off")

    if recs:
        lines.append("RECOMMENDATIONS:")
        lines.extend(recs)
        lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate scouting command report")
    parser.add_argument("--csv", required=True, help="Path to pitch_data.csv")
    parser.add_argument("--pitcher-name", type=str, default=None,
                        help="Override pitcher name")
    parser.add_argument("--pitcher-hand", choices=["R", "L"], default=None,
                        help="Override pitcher hand")
    args = parser.parse_args()

    pitches = load_pitches(args.csv)
    report = generate_report(pitches, args.pitcher_name, args.pitcher_hand)
    print(report)
