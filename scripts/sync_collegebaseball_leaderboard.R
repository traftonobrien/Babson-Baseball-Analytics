#!/usr/bin/env Rscript
# NCAA Division III leaderboard sync -- HTTP-first pipeline.
# Replaces the Chromote/browser-driven fetch with direct HTTP requests.

suppressWarnings(suppressMessages({
  library(baseballr)
  library(collegebaseball)
  library(dplyr)
  library(httr)
  library(jsonlite)
  library(rvest)
  library(stringr)
  library(tibble)
  library(xml2)
}))

# Source lib helpers (relative to script location)
raw_args  <- commandArgs(trailingOnly = FALSE)
.script_arg <- raw_args[grep("^--file=", raw_args)][1]
.script_path <- normalizePath(sub("^--file=", "", .script_arg), winslash = "/", mustWork = FALSE)
.lib_dir <- file.path(dirname(.script_path), "lib")
source(file.path(.lib_dir, "ncaa_sync_http.R"))
source(file.path(.lib_dir, "ncaa_sync_normalize.R"))

# ---------------------------------------------------------------------------
# CLI argument parsing
# ---------------------------------------------------------------------------

parse_args <- function(args) {
  out <- list(
    years      = c(2026L),
    division   = 3L,
    types      = c("pitching", "batting"),
    limit      = NULL,
    team_name  = NULL,
    sync_mode  = "full",       # "incremental" | "full"
    out_dir    = NULL,         # NULL = use default repo path
    watch_list = character(0), # extra teams to always include in incremental
    dry_run    = FALSE
  )

  i <- 1
  while (i <= length(args)) {
    arg <- args[[i]]
    if (arg == "--years") {
      i <- i + 1; years <- c()
      while (i <= length(args) && !startsWith(args[[i]], "--")) { years <- c(years, as.integer(args[[i]])); i <- i + 1 }
      out$years <- years; next
    }
    if (arg == "--division")  { out$division  <- as.integer(args[[i+1]]); i <- i + 2; next }
    if (arg == "--types") {
      i <- i + 1; types <- c()
      while (i <= length(args) && !startsWith(args[[i]], "--")) { types <- c(types, args[[i]]); i <- i + 1 }
      out$types <- types; next
    }
    if (arg == "--limit")      { out$limit     <- as.integer(args[[i+1]]); i <- i + 2; next }
    if (arg == "--team-name")  { out$team_name <- args[[i+1]];             i <- i + 2; next }
    if (arg == "--sync-mode")  { out$sync_mode <- args[[i+1]];             i <- i + 2; next }
    if (arg == "--out-dir")    { out$out_dir   <- args[[i+1]];             i <- i + 2; next }
    if (arg == "--watch-list") {
      # Comma-separated team names, e.g. "MIT,WPI,Tufts"
      out$watch_list <- trimws(strsplit(args[[i+1]], ",", fixed = TRUE)[[1]])
      i <- i + 2; next
    }
    if (arg == "--dry-run") { out$dry_run <- TRUE; i <- i + 1; next }
    # Silently ignore legacy shard/concurrency args so old callers don't hard-error
    if (arg %in% c("--offset", "--shard-out", "--concurrency", "--batch-size", "--max-wait-seconds")) {
      message(sprintf("Warning: legacy flag '%s' is ignored (HTTP sync has no batching)", arg))
      i <- i + 2; next
    }
    if (arg == "--merge-shards") { message("Warning: --merge-shards is ignored"); i <- i + 1; next }
    stop(sprintf("Unknown argument: %s", arg))
  }

  if (!out$sync_mode %in% c("incremental", "full")) {
    stop(sprintf("--sync-mode must be 'incremental' or 'full', got: %s", out$sync_mode))
  }
  out
}

cfg <- parse_args(commandArgs(trailingOnly = TRUE))

# Resolve output directory
default_out_dir <- file.path(dirname(.script_path), "..", "web", "public", "college-stats")
out_dir <- if (!is.null(cfg$out_dir)) cfg$out_dir else normalizePath(default_out_dir, winslash = "/", mustWork = FALSE)
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

# ---------------------------------------------------------------------------
# Season category IDs (used to build NCAA stat page URLs)
# ---------------------------------------------------------------------------

season_ids <- tryCatch(
  baseballr:::rds_from_url("https://raw.githubusercontent.com/robert-frey/college-baseball/main/ncaa_season_ids.rds"),
  error = function(e) stop(sprintf("Failed to load season_ids: %s", conditionMessage(e)))
)

get_category_id <- function(year, type) {
  year_row <- season_ids[season_ids$season == year, ]
  if (nrow(year_row) == 0) stop(sprintf("No NCAA season ids found for year %s", year))
  if (type == "pitching") year_row$pitching_id[[1]]
  else if (type == "batting") year_row$batting_id[[1]]
  else stop(sprintf("Unknown type: %s", type))
}

# ---------------------------------------------------------------------------
# Incremental team selection
# ---------------------------------------------------------------------------

#' Build the team list for incremental sync.
#' Always includes Babson + teams from published cache + failed teams from
#' prior meta.json + any watch-list entries. Falls back to full list if
#' no prior cache exists.
build_incremental_team_list <- function(all_teams, out_dir, watch_list = character(0)) {
  known_ids <- character(0)

  # 1. Teams present in published batting/pitching JSON
  for (type in c("pitching", "batting")) {
    json_path <- file.path(out_dir, sprintf("%s-2026.json", type))
    if (file.exists(json_path)) {
      tryCatch({
        rows <- jsonlite::fromJSON(json_path, simplifyDataFrame = FALSE)
        ids  <- unique(vapply(rows, function(r) as.character(r$team_id %||% ""), character(1)))
        known_ids <- union(known_ids, ids[nzchar(ids)])
      }, error = function(e) NULL)
    }
  }

  # 2. Teams that failed in the prior run (retry them)
  meta_path <- file.path(out_dir, "meta.json")
  if (file.exists(meta_path)) {
    tryCatch({
      meta <- jsonlite::fromJSON(meta_path, simplifyDataFrame = TRUE)
      for (result_key in names(meta$results)) {
        failures <- meta$results[[result_key]][["failures"]]
        if (is.data.frame(failures) && "team_id" %in% colnames(failures)) {
          fail_ids <- as.character(failures$team_id)
          known_ids <- union(known_ids, fail_ids[!is.na(fail_ids) & nzchar(fail_ids)])
        }
      }
    }, error = function(e) NULL)
  }

  # 3. Always include Babson
  babson <- all_teams[grepl("babson", all_teams$team_name, ignore.case = TRUE), ]
  if (nrow(babson) > 0) known_ids <- union(known_ids, as.character(babson$team_id))

  # 4. Watch-list teams
  if (length(watch_list) > 0) {
    for (wt in watch_list) {
      matched <- all_teams[grepl(wt, all_teams$team_name, ignore.case = TRUE), ]
      if (nrow(matched) > 0) known_ids <- union(known_ids, as.character(matched$team_id))
    }
  }

  if (length(known_ids) == 0) {
    message("[incremental] No prior cache found; running full sweep")
    return(all_teams)
  }

  filtered <- all_teams[as.character(all_teams$team_id) %in% known_ids, ]
  message(sprintf(
    "[incremental] Selected %d/%d teams (cache=%d, watch-list=%d, Babson always-include)",
    nrow(filtered), nrow(all_teams), length(known_ids), length(watch_list)
  ))
  filtered
}

# ---------------------------------------------------------------------------
# Per-team fetch + parse
# ---------------------------------------------------------------------------

#' Fetch and normalize stats for a single team.
#' Returns list:
#'   ok        - TRUE if normalization produced rows
#'   status    - one of: success | empty_stats | access_denied | parse_failed
#'   team_id   - integer
#'   team_name - character
#'   rows      - tibble or NULL
#'   detail    - diagnostic message
fetch_single_team <- function(team_info, year, type) {
  team_id   <- as.integer(team_info$team_id[[1]])
  team_name <- as.character(team_info$team_name[[1]])

  category_id <- tryCatch(
    get_category_id(year, type),
    error = function(e) { stop(conditionMessage(e)) }
  )
  url <- ncaa_stats_url(team_id, category_id)

  fetch_result <- ncaa_fetch_page(url)

  if (fetch_result$status != "success") {
    return(list(
      ok        = FALSE,
      status    = fetch_result$status,
      team_id   = team_id,
      team_name = team_name,
      rows      = NULL,
      detail    = fetch_result$error %||% sprintf("HTTP %s", fetch_result$http_code %||% "?")
    ))
  }

  parsed <- ncaa_parse_stats_html(fetch_result$html, type)

  if (parsed$status != "success") {
    return(list(
      ok        = FALSE,
      status    = parsed$status,
      team_id   = team_id,
      team_name = team_name,
      rows      = NULL,
      detail    = parsed$detail %||% parsed$status
    ))
  }

  team_rows <- tryCatch(
    if (type == "pitching") extract_pitching_rows(parsed$df, parsed$links, team_info)
    else                    extract_batting_rows(parsed$df, parsed$links, team_info),
    error = function(e) NULL
  )

  if (is.null(team_rows) || nrow(team_rows) == 0) {
    return(list(
      ok        = FALSE,
      status    = "parse_failed",
      team_id   = team_id,
      team_name = team_name,
      rows      = NULL,
      detail    = "Row extraction produced empty result"
    ))
  }

  list(
    ok        = TRUE,
    status    = "success",
    team_id   = team_id,
    team_name = team_name,
    rows      = team_rows,
    detail    = NULL
  )
}

# ---------------------------------------------------------------------------
# Full type sweep
# ---------------------------------------------------------------------------

fetch_type_for_year <- function(year, division, type, limit = NULL, team_name = NULL,
                                 sync_mode = "full", watch_list = character(0)) {
  all_teams <- collegebaseball::ncaa_teams(years = year, divisions = division)
  all_teams <- dplyr::arrange(all_teams, .data$team_name)

  # If a specific team filter is given, apply it (validation / test mode)
  if (!is.null(team_name) && nzchar(team_name)) {
    pattern   <- stringr::regex(team_name, ignore_case = TRUE)
    all_teams <- dplyr::filter(all_teams, stringr::str_detect(.data$team_name, pattern))
  }

  teams <- if (sync_mode == "incremental" && is.null(team_name)) {
    build_incremental_team_list(all_teams, out_dir, watch_list)
  } else {
    all_teams
  }

  if (!is.null(limit)) teams <- utils::head(teams, limit)

  message(sprintf("[%s %s] %s mode: processing %d team(s)", year, type, sync_mode, nrow(teams)))

  rows     <- list()
  outcome_counts <- list(success = 0L, empty_stats = 0L, access_denied = 0L, parse_failed = 0L)
  failures <- list()

  for (i in seq_len(nrow(teams))) {
    team_info <- teams[i, , drop = FALSE]
    label     <- as.character(teams$team_name[[i]])
    message(sprintf("[%s %s] %d/%d %s", year, type, i, nrow(teams), label))

    result <- tryCatch(
      fetch_single_team(team_info, year, type),
      error = function(e) list(
        ok        = FALSE,
        status    = "parse_failed",
        team_id   = as.integer(team_info$team_id[[1]]),
        team_name = label,
        rows      = NULL,
        detail    = conditionMessage(e)
      )
    )

    status_key <- result$status %||% "parse_failed"
    outcome_counts[[status_key]] <- (outcome_counts[[status_key]] %||% 0L) + 1L

    if (isTRUE(result$ok)) {
      rows[[length(rows) + 1]] <- result$rows
    } else {
      failures[[length(failures) + 1]] <- list(
        team_id   = result$team_id,
        team_name = result$team_name,
        status    = result$status,
        detail    = result$detail
      )
      message(sprintf("  [%s] %s: %s", result$status, label, result$detail %||% ""))
    }

    # Small courtesy delay to avoid hammering the server
    if (i < nrow(teams)) Sys.sleep(0.15)
  }

  combined <- dplyr::bind_rows(rows)
  message(sprintf(
    "[%s %s] done: success=%d empty_stats=%d access_denied=%d parse_failed=%d rows=%d",
    year, type,
    outcome_counts$success   %||% 0L,
    outcome_counts$empty_stats %||% 0L,
    outcome_counts$access_denied %||% 0L,
    outcome_counts$parse_failed %||% 0L,
    nrow(combined)
  ))

  list(
    rows           = combined,
    outcome_counts = outcome_counts,
    failures       = failures,
    team_count     = nrow(teams)
  )
}

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

validate_result <- function(rows, outcome_counts, team_count, year, type,
                             team_name = NULL, limit = NULL) {
  if (nrow(rows) == 0) {
    stop(sprintf("No %s rows produced for %s", type, year))
  }

  # Team-filtered / test mode: just verify the requested team is present
  if (!is.null(team_name) && nzchar(team_name)) {
    if (!any(stringr::str_detect(rows$team_name, stringr::regex(team_name, ignore_case = TRUE)))) {
      stop(sprintf("Validation failed: '%s' not found in %s %s output", team_name, year, type))
    }
    return(invisible(TRUE))
  }

  # Full / incremental mode: Babson must be present when we expect stats
  teams_present <- length(unique(rows$team_id))
  if (teams_present < 2L && is.null(limit)) {
    stop(sprintf(
      "Validation failed: only %d team(s) in %s %s output (expected multiple)",
      teams_present, year, type
    ))
  }

  if (!any(rows$team_name == "Babson")) {
    # Babson having empty_stats is acceptable; missing entirely is a hard failure
    babson_failed <- any(vapply(list(), function(f) f$team_name == "Babson", logical(1)))
    if (!babson_failed) {
      stop(sprintf("Validation failed: Babson missing from %s %s output", year, type))
    }
    message(sprintf("Warning: Babson has no %s stats for %s (empty_stats; may be early season)", type, year))
  }

  # Warn (don't fail) when many teams are empty -- early season norm
  empty  <- outcome_counts$empty_stats %||% 0L
  denied <- outcome_counts$access_denied %||% 0L
  if (denied > 5L) {
    message(sprintf("Warning: %d access_denied results for %s %s -- NCAA may be rate-limiting", denied, year, type))
  }
  if (empty > max(5L, floor(team_count * 0.5))) {
    message(sprintf("Warning: %d/%d empty_stats for %s %s (early season expected)", empty, team_count, year, type))
  }

  invisible(TRUE)
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

meta <- list(
  synced_at  = format(Sys.time(), tz = "UTC", usetz = TRUE),
  source     = "collegebaseball+http",
  sync_mode  = cfg$sync_mode,
  division   = cfg$division,
  years      = cfg$years,
  types      = cfg$types,
  results    = list()
)

any_hard_failure <- FALSE

for (year in cfg$years) {
  for (type in cfg$types) {
    result <- fetch_type_for_year(
      year       = year,
      division   = cfg$division,
      type       = type,
      limit      = cfg$limit,
      team_name  = cfg$team_name,
      sync_mode  = cfg$sync_mode,
      watch_list = cfg$watch_list
    )
    rows <- result$rows

    # Derive metrics over the full result set
    rows <- if (type == "pitching") add_pitching_derived_metrics(rows) else add_batting_derived_metrics(rows)

    result_key <- paste0(year, "-", type)

    # Build structured outcome entry for meta.json
    babson_present <- if (nrow(rows) > 0) any(rows$team_name == "Babson") else FALSE
    meta$results[[result_key]] <- list(
      row_count      = nrow(rows),
      team_count     = result$team_count,
      babson_present = babson_present,
      outcome_counts = result$outcome_counts,
      failure_count  = length(result$failures),
      failures       = result$failures
    )

    # Validate (warns on degraded; stops on hard failures)
    valid <- tryCatch(
      validate_result(rows, result$outcome_counts, result$team_count, year, type, cfg$team_name, cfg$limit),
      error = function(e) {
        message(sprintf("[VALIDATION FAILED] %s %s: %s", year, type, conditionMessage(e)))
        any_hard_failure <<- TRUE
        meta$results[[result_key]][["validation_error"]] <<- conditionMessage(e)
        FALSE
      }
    )

    if (cfg$dry_run) {
      message(sprintf(
        "[dry-run] %s %s rows=%d failures=%d babson=%s",
        year, type, nrow(rows), length(result$failures), babson_present
      ))
      next
    }

    if (!isTRUE(valid)) {
      # Degraded publish: keep prior file intact, do not overwrite with bad data
      prior_path <- file.path(out_dir, sprintf("%s-%s.json", type, year))
      if (file.exists(prior_path)) {
        message(sprintf("[degraded] Keeping prior %s %s file unchanged", year, type))
        meta$results[[result_key]][["stale"]] <- TRUE
      }
      next
    }

    out_path <- file.path(out_dir, sprintf("%s-%s.json", type, year))
    writeLines(
      jsonlite::toJSON(rows, dataframe = "rows", auto_unbox = TRUE, na = "null", pretty = FALSE),
      out_path, useBytes = TRUE
    )
    message(sprintf("Wrote %s (%d rows)", out_path, nrow(rows)))
  }
}

# Always write meta.json (even on dry-run, to stdout for inspection)
meta_json <- jsonlite::toJSON(meta, auto_unbox = TRUE, pretty = TRUE, na = "null")
if (cfg$dry_run) {
  message("[dry-run] meta.json output:")
  cat(meta_json, "\n")
} else {
  meta_path <- file.path(out_dir, "meta.json")
  writeLines(meta_json, meta_path, useBytes = TRUE)
  message(sprintf("Wrote %s", meta_path))
}

if (any_hard_failure) {
  quit(save = "no", status = 1)
}
