#!/usr/bin/env Rscript
# Parser contract checks using saved HTML fixtures.
# Run with: Rscript -e 'source("tests/fixtures/ncaa-sync/run_parser_checks.R")'
# Or:       Rscript tests/fixtures/ncaa-sync/run_parser_checks.R

suppressWarnings(suppressMessages({
  library(dplyr)
  library(rvest)
  library(stringr)
  library(tibble)
  library(xml2)
}))

# Resolve paths relative to repo root
raw_args    <- commandArgs(trailingOnly = FALSE)
script_arg  <- raw_args[grep("^--file=", raw_args)][1]
if (!is.na(script_arg)) {
  script_path <- normalizePath(sub("^--file=", "", script_arg), mustWork = FALSE)
  fixture_dir <- dirname(script_path)
  lib_dir     <- file.path(dirname(dirname(fixture_dir)), "scripts", "lib")
} else {
  # Called via source() -- use working directory heuristic
  fixture_dir <- "tests/fixtures/ncaa-sync"
  lib_dir     <- "scripts/lib"
}

source(file.path(lib_dir, "ncaa_sync_normalize.R"))

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

read_fixture <- function(filename) {
  path <- file.path(fixture_dir, filename)
  if (!file.exists(path)) stop(sprintf("Fixture not found: %s", path))
  paste(readLines(path, encoding = "UTF-8", warn = FALSE), collapse = "\n")
}

.pass <- 0L
.fail <- 0L

check <- function(label, condition, detail = "") {
  if (isTRUE(condition)) {
    message(sprintf("  PASS  %s", label))
    .pass <<- .pass + 1L
  } else {
    message(sprintf("  FAIL  %s%s", label, if (nzchar(detail)) sprintf(" -- %s", detail) else ""))
    .fail <<- .fail + 1L
  }
}

# Fake team_info for extract_* helpers
fake_team_info <- data.frame(
  team_id       = 30084L,
  team_name     = "Babson",
  conference    = "NEWMAC",
  conference_id = 1L,
  division      = 3L,
  year          = 2026L,
  stringsAsFactors = FALSE
)

# ---------------------------------------------------------------------------
# Test: access_denied fixture
# ---------------------------------------------------------------------------
message("\n[1] access_denied fixture")
html_denied <- read_fixture("access_denied.html")
r <- ncaa_parse_stats_html(html_denied, "pitching")
check("status == access_denied",     r$status == "access_denied",     r$status)
check("df is NULL",                  is.null(r$df))
check("links is NULL",               is.null(r$links))

# ---------------------------------------------------------------------------
# Test: empty_stats fixture (pitching)
# ---------------------------------------------------------------------------
message("\n[2] empty_stats fixture")
html_empty <- read_fixture("empty_stats.html")
r <- ncaa_parse_stats_html(html_empty, "pitching")
check("status == empty_stats",       r$status == "empty_stats",       r$status)
check("df is NULL",                  is.null(r$df))

# ---------------------------------------------------------------------------
# Test: success_pitching fixture -- classification
# ---------------------------------------------------------------------------
message("\n[3] success_pitching fixture -- classification")
html_pitch <- read_fixture("success_pitching.html")
r <- ncaa_parse_stats_html(html_pitch, "pitching")
check("status == success",           r$status == "success",           r$status)
check("df is non-null",              !is.null(r$df))
check("links is non-null",           !is.null(r$links))
check("df has rows",                 is.data.frame(r$df) && nrow(r$df) > 0)

# ---------------------------------------------------------------------------
# Test: success_pitching fixture -- row normalization and contract
# ---------------------------------------------------------------------------
message("\n[4] success_pitching fixture -- row contract")
rows <- extract_pitching_rows(r$df, r$links, fake_team_info)

REQUIRED_PITCHING_KEYS <- c(
  "player_id", "player_name", "team_id", "team_name",
  "ip_float", "era", "bb", "so", "bf", "h", "r", "er",
  "hr_a", "hb", "go", "fo", "w", "l", "sv", "ibb", "pitches"
)

for (key in REQUIRED_PITCHING_KEYS) {
  check(sprintf("key '%s' present", key), key %in% colnames(rows), sprintf("cols: %s", paste(colnames(rows), collapse=",")))
}

check("ip_float is numeric",         is.numeric(rows$ip_float))
check("ip_float > 0",                all(rows$ip_float > 0, na.rm = TRUE))
check("team_name == Babson",         all(rows$team_name == "Babson"))
check("team_id is integer",          is.integer(rows$team_id))
check("player_id links populated",   !all(is.na(rows$player_id)))

# ---------------------------------------------------------------------------
# Test: success_batting fixture -- classification + row contract
# ---------------------------------------------------------------------------
message("\n[5] success_batting fixture -- classification + row contract")
html_bat <- read_fixture("success_batting.html")
r2 <- ncaa_parse_stats_html(html_bat, "batting")
check("status == success",           r2$status == "success",          r2$status)

rows_b <- extract_batting_rows(r2$df, r2$links, fake_team_info)

REQUIRED_BATTING_KEYS <- c(
  "player_id", "player_name", "team_id", "team_name",
  "ab", "h", "doubles", "triples", "tb", "hr", "rbi",
  "bb", "so", "sb", "cs", "r", "gp", "gs"
)
for (key in REQUIRED_BATTING_KEYS) {
  check(sprintf("key '%s' present", key), key %in% colnames(rows_b))
}
check("team_name == Babson",         all(rows_b$team_name == "Babson"))

# ---------------------------------------------------------------------------
# Test: derived metrics preserve contract fields
# ---------------------------------------------------------------------------
message("\n[6] derived metrics contract")
rows_derived <- add_pitching_derived_metrics(rows)
DERIVED_PITCHING_KEYS <- c("whip", "k_pct", "bb_pct", "k_minus_bb_pct", "fip", "xfip", "era_plus", "war")
for (key in DERIVED_PITCHING_KEYS) {
  check(sprintf("derived key '%s' present", key), key %in% colnames(rows_derived))
}
check("k_minus_bb_pct == k_pct - bb_pct",
      all(abs(rows_derived$k_minus_bb_pct - (rows_derived$k_pct - rows_derived$bb_pct)) < 1e-10, na.rm = TRUE))
check("ip_float not clobbered",      "ip_float" %in% colnames(rows_derived))
check("expected_hr removed",         !"expected_hr" %in% colnames(rows_derived))

rows_bat_derived <- add_batting_derived_metrics(rows_b)
DERIVED_BATTING_KEYS <- c("avg", "obp", "slg", "ops", "k_pct", "bb_pct", "wrc_plus", "war", "pa")
for (key in DERIVED_BATTING_KEYS) {
  check(sprintf("derived batting key '%s' present", key), key %in% colnames(rows_bat_derived))
}
check("rc removed",                  !"rc" %in% colnames(rows_bat_derived))

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
total <- .pass + .fail
message(sprintf("\n%d/%d checks passed", .pass, total))
if (.fail > 0) {
  message(sprintf("FAIL: %d check(s) failed", .fail))
  quit(save = "no", status = 1)
} else {
  message("All checks passed.")
}
