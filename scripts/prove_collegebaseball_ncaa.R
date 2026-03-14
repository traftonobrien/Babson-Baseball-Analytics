#!/usr/bin/env Rscript

suppressWarnings(suppressMessages({
  library(jsonlite)
}))

args <- commandArgs(trailingOnly = TRUE)

season <- 2026L
team_name <- "Babson"
team_id <- 615151L
install_pkg <- "--install" %in% args

if (install_pkg && !requireNamespace("collegebaseball", quietly = TRUE)) {
  if (!requireNamespace("remotes", quietly = TRUE)) {
    stop("Missing remotes package; install.packages('remotes') first.")
  }
  message("Installing robert-frey/collegebaseball ...")
  remotes::install_github("robert-frey/collegebaseball", upgrade = "never", quiet = TRUE)
}

if (!requireNamespace("collegebaseball", quietly = TRUE)) {
  stop("collegebaseball package is not installed. Re-run with --install.")
}

suppressWarnings(suppressMessages({
  library(collegebaseball)
  library(baseballr)
  library(dplyr)
}))

result <- list(
  checked_at = format(Sys.time(), tz = "UTC", usetz = TRUE),
  season = season,
  team = team_name,
  team_id = team_id,
  package_installed = TRUE,
  season_lookup_present = FALSE,
  pitching_category_id = NULL,
  stat_url = NULL,
  success = FALSE,
  row_count = 0L,
  team_row_count = 0L,
  columns = character(),
  sample_players = character(),
  error = NULL
)

call_error <- NULL
rows <- NULL

season_ids <- baseballr:::rds_from_url("https://raw.githubusercontent.com/robert-frey/college-baseball/main/ncaa_season_ids.rds")
season_idx <- which(season_ids$season == season)
if (length(season_idx) > 0) {
  pitching_category_id <- as.integer(season_ids$pitching_id[[season_idx[1]]])
  result$season_lookup_present <- TRUE
  result$pitching_category_id <- pitching_category_id
  result$stat_url <- sprintf(
    "https://stats.ncaa.org/teams/%s/season_to_date_stats?year_stat_category_id=%s",
    team_id,
    pitching_category_id
  )
}

tryCatch(
  {
    rows <- collegebaseball::ncaa_stats(
      team_id = team_id,
      year = season,
      type = "pitching",
      situation = "all"
    )
  },
  error = function(e) {
    call_error <<- conditionMessage(e)
  }
)

if (is.null(call_error) && !is.null(rows)) {
  result$row_count <- nrow(rows)
  result$columns <- names(rows)

  normalized_names <- tolower(gsub("[^a-z0-9]", "", names(rows)))

  team_col_idx <- match("team", normalized_names)
  if (is.na(team_col_idx)) {
    team_col_idx <- match("teamname", normalized_names)
  }
  if (is.na(team_col_idx)) {
    team_col_idx <- match("school", normalized_names)
  }

  player_col_idx <- match("player", normalized_names)
  if (is.na(player_col_idx)) {
    player_col_idx <- match("playername", normalized_names)
  }
  if (is.na(player_col_idx)) {
    player_col_idx <- match("name", normalized_names)
  }

  team_rows <- rows
  if (!is.na(team_col_idx)) {
    team_values <- as.character(rows[[team_col_idx]])
    team_rows <- rows[grepl(team_name, team_values, ignore.case = TRUE), , drop = FALSE]
  }

  result$team_row_count <- nrow(team_rows)
  if (nrow(team_rows) > 0 && !is.na(player_col_idx)) {
    result$sample_players <- head(as.character(team_rows[[player_col_idx]]), 10)
  }

  result$success <- nrow(team_rows) > 0
} else {
  result$error <- call_error
}

cat(jsonlite::toJSON(result, auto_unbox = TRUE, pretty = TRUE))
