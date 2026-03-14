#!/usr/bin/env Rscript

suppressWarnings(suppressMessages({
  library(baseballr)
  library(chromote)
  library(collegebaseball)
  library(dplyr)
  library(jsonlite)
  library(rvest)
  library(stringr)
  library(tibble)
  library(xml2)
}))

`%||%` <- function(x, y) if (is.null(x)) y else x

args <- commandArgs(trailingOnly = TRUE)

parse_args <- function(args) {
  out <- list(
    years = c(2026L),
    division = 3L,
    types = c("pitching", "batting"),
    limit = NULL,
    team_name = NULL,
    concurrency = 1L,
    batch_size = 24L,
    max_wait_seconds = 7,
    dry_run = FALSE
  )

  i <- 1
  while (i <= length(args)) {
    arg <- args[[i]]
    if (arg == "--years") {
      i <- i + 1
      years <- c()
      while (i <= length(args) && !startsWith(args[[i]], "--")) {
        years <- c(years, as.integer(args[[i]]))
        i <- i + 1
      }
      out$years <- years
      next
    }
    if (arg == "--division") {
      out$division <- as.integer(args[[i + 1]])
      i <- i + 2
      next
    }
    if (arg == "--types") {
      i <- i + 1
      types <- c()
      while (i <= length(args) && !startsWith(args[[i]], "--")) {
        types <- c(types, args[[i]])
        i <- i + 1
      }
      out$types <- types
      next
    }
    if (arg == "--limit") {
      out$limit <- as.integer(args[[i + 1]])
      i <- i + 2
      next
    }
    if (arg == "--team-name") {
      out$team_name <- args[[i + 1]]
      i <- i + 2
      next
    }
    if (arg == "--concurrency") {
      out$concurrency <- as.integer(args[[i + 1]])
      i <- i + 2
      next
    }
    if (arg == "--batch-size") {
      out$batch_size <- as.integer(args[[i + 1]])
      i <- i + 2
      next
    }
    if (arg == "--max-wait-seconds") {
      out$max_wait_seconds <- as.numeric(args[[i + 1]])
      i <- i + 2
      next
    }
    if (arg == "--dry-run") {
      out$dry_run <- TRUE
      i <- i + 1
      next
    }
    stop(sprintf("Unknown argument: %s", arg))
  }

  out
}

cfg <- parse_args(args)

raw_args <- commandArgs(trailingOnly = FALSE)
script_arg <- raw_args[grep("^--file=", raw_args)][1]
script_path <- normalizePath(sub("^--file=", "", script_arg), winslash = "/", mustWork = FALSE)
repo_root <- normalizePath(file.path(dirname(script_path), ".."), winslash = "/", mustWork = FALSE)
out_dir <- file.path(repo_root, "web", "public", "college-stats")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

user_agent <- "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

season_ids <- baseballr:::rds_from_url("https://raw.githubusercontent.com/robert-frey/college-baseball/main/ncaa_season_ids.rds")

safe_numeric <- function(x) {
  out <- suppressWarnings(as.numeric(as.character(x)))
  out[is.na(out)] <- 0
  out
}

normalize_name <- function(x) {
  str_replace_all(tolower(as.character(x)), "[^a-z0-9]", "")
}

to_ip_float <- function(ip) {
  ip_chr <- trimws(as.character(ip))
  out <- rep(NA_real_, length(ip_chr))
  for (idx in seq_along(ip_chr)) {
    value <- ip_chr[[idx]]
    if (is.na(value) || value == "") next
    parts <- strsplit(value, "\\.", fixed = FALSE)[[1]]
    whole <- suppressWarnings(as.numeric(parts[[1]]))
    frac <- if (length(parts) > 1) parts[[2]] else "0"
    frac_digits <- suppressWarnings(as.numeric(frac))
    if (!is.finite(whole)) next
    if (!is.finite(frac_digits)) frac_digits <- 0
    thirds <- dplyr::case_when(
      frac_digits == 0 ~ 0,
      frac_digits == 1 ~ 1 / 3,
      frac_digits == 2 ~ 2 / 3,
      TRUE ~ frac_digits / 10
    )
    out[[idx]] <- whole + thirds
  }
  out
}

new_browser_session <- function() {
  ses <- chromote::ChromoteSession$new()
  ses$Network$enable()
  ses$Network$setUserAgentOverride(userAgent = user_agent)
  ses
}

fetch_html_with_browser <- function(session, url, max_wait_seconds = cfg$max_wait_seconds) {
  session$Page$navigate(url = url)

  started <- Sys.time()
  while (as.numeric(difftime(Sys.time(), started, units = "secs")) < max_wait_seconds) {
    state <- session$Runtime$evaluate("
      (() => {
        const body = document.body ? document.body.innerText : '';
        return {
          title: document.title || '',
          ready: document.readyState || '',
          accessDenied: /access denied/i.test(body) || /access denied/i.test(document.title || ''),
          tableCount: document.querySelectorAll('table').length,
          statGridLinks: document.querySelectorAll('#stat_grid a').length
        };
      })()
    ")$result$value

    if (isTRUE(state$accessDenied)) {
      stop("Access denied by NCAA")
    }

    if ((state$tableCount %||% 0) >= 2 && (state$statGridLinks %||% 0) > 0) {
      doc <- session$DOM$getDocument()
      return(session$DOM$getOuterHTML(nodeId = doc$root$nodeId)[["outerHTML"]])
    }

    Sys.sleep(0.2)
  }

  doc <- session$DOM$getDocument()
  session$DOM$getOuterHTML(nodeId = doc$root$nodeId)[["outerHTML"]]
}

fetch_team_stats_page <- function(session, team_id, year, type) {
  year_row <- season_ids[season_ids$season == year, ]
  if (nrow(year_row) == 0) {
    stop(sprintf("No NCAA season ids found for %s", year))
  }

  category_id <- if (type == "pitching") {
    year_row$pitching_id[[1]]
  } else if (type == "batting") {
    year_row$batting_id[[1]]
  } else {
    year_row$pitching_id[[1]] + 1
  }

  url <- sprintf(
    "https://stats.ncaa.org/teams/%s/season_to_date_stats?year_stat_category_id=%s",
    team_id,
    category_id
  )

  html <- fetch_html_with_browser(session, url)
  payload <- xml2::read_html(html)
  tables <- rvest::html_elements(payload, "table")
  if (length(tables) < 2) {
    stop(sprintf("Expected stat table for %s %s", team_id, type))
  }

  df <- tibble::as_tibble(rvest::html_table(tables[[2]], convert = FALSE))
  links <- tibble::tibble(
    player_name = rvest::html_text(rvest::html_elements(payload, "#stat_grid a"), trim = TRUE),
    href = rvest::html_attr(rvest::html_elements(payload, "#stat_grid a"), "href")
  ) |>
    dplyr::mutate(
      player_id = stringr::str_extract(.data$href, "(?<=/players/)\\d+"),
      player_url = ifelse(is.na(.data$href), NA_character_, paste0("https://stats.ncaa.org", .data$href))
    )

  list(df = df, links = links, url = url)
}

fetch_single_team <- function(team_info, year, type) {
  team_id <- as.integer(team_info$team_id[[1]])
  team_name <- as.character(team_info$team_name[[1]])
  session <- new_browser_session()
  on.exit(try(session$close(), silent = TRUE), add = TRUE)

  result <- tryCatch(
    fetch_team_stats_page(session, team_id, year, type),
    error = function(e) e
  )

  if (inherits(result, "error")) {
    return(list(
      ok = FALSE,
      team_id = team_id,
      team_name = team_name,
      error = conditionMessage(result),
      rows = NULL
    ))
  }

  team_rows <- if (type == "pitching") {
    extract_pitching_rows(result$df, result$links, team_info)
  } else {
    extract_batting_rows(result$df, result$links, team_info)
  }

  list(
    ok = TRUE,
    team_id = team_id,
    team_name = team_name,
    error = NULL,
    rows = team_rows
  )
}

run_parallel <- function(items, worker, mc.cores) {
  if (length(items) == 0) return(list())
  if (mc.cores > 1) {
    message("Chromote team-level parallelism is disabled for stability; running sequentially within each batch.")
  }
  lapply(items, worker)
}

extract_pitching_rows <- function(raw_df, links, team_info) {
  df <- raw_df |>
    dplyr::mutate(`#` = suppressWarnings(as.numeric(`#`))) |>
    dplyr::filter(!is.na(`#`)) |>
    dplyr::mutate(
      App = safe_numeric(.data$App),
      GS = safe_numeric(.data$GS),
      ERA = safe_numeric(.data$ERA),
      H = safe_numeric(.data$H),
      R = safe_numeric(.data$R),
      ER = safe_numeric(.data$ER),
      BB = safe_numeric(.data$BB),
      SO = safe_numeric(.data$SO),
      BF = safe_numeric(.data$BF),
      `HR-A` = safe_numeric(.data$`HR-A`),
      HB = safe_numeric(.data$HB),
      Pitches = safe_numeric(.data$Pitches),
      GO = safe_numeric(.data$GO),
      FO = safe_numeric(.data$FO),
      W = safe_numeric(.data$W),
      L = safe_numeric(.data$L),
      SV = safe_numeric(.data$SV),
      IBB = safe_numeric(.data$IBB),
      ip_text = as.character(.data$IP),
      ip_float = to_ip_float(.data$IP)
    ) |>
    dplyr::rename(
      player_name = "Player",
      jersey = "#",
      hr_a = "HR-A",
      hb = "HB",
      bb = "BB",
      so = "SO",
      bf = "BF",
      h = "H",
      r = "R",
      er = "ER",
      app = "App",
      gs = "GS",
      era = "ERA",
      pitches = "Pitches",
      go = "GO",
      fo = "FO",
      w = "W",
      l = "L",
      sv = "SV",
      ibb = "IBB"
    ) |>
    dplyr::left_join(links, by = c("player_name")) |>
    dplyr::transmute(
      player_id = .data$player_id,
      player_url = .data$player_url,
      player_name = .data$player_name,
      team_id = as.integer(team_info$team_id[[1]]),
      team_name = as.character(team_info$team_name[[1]]),
      conference = as.character(team_info$conference[[1]]),
      conference_id = as.integer(team_info$conference_id[[1]]),
      division = as.integer(team_info$division[[1]]),
      year = as.integer(team_info$year[[1]]),
      jersey = as.integer(.data$jersey),
      yr = as.character(.data$Yr),
      pos = as.character(.data$Pos),
      ht = as.character(.data$Ht),
      bats = stringr::str_sub(as.character(.data$`B/T`), 1, 1),
      throws = stringr::str_sub(as.character(.data$`B/T`), -1, -1),
      app = .data$app,
      gs = .data$gs,
      era = .data$era,
      ip = .data$ip_text,
      ip_float = .data$ip_float,
      h = .data$h,
      r = .data$r,
      er = .data$er,
      bb = .data$bb,
      so = .data$so,
      bf = .data$bf,
      hr_a = .data$hr_a,
      hb = .data$hb,
      pitches = .data$pitches,
      go = .data$go,
      fo = .data$fo,
      w = .data$w,
      l = .data$l,
      sv = .data$sv,
      ibb = .data$ibb
    )

  df
}

extract_batting_rows <- function(raw_df, links, team_info) {
  df <- raw_df |>
    dplyr::mutate(`#` = suppressWarnings(as.numeric(`#`))) |>
    dplyr::filter(!is.na(`#`)) |>
    dplyr::mutate(
      AB = safe_numeric(.data$AB),
      H = safe_numeric(.data$H),
      `2B` = safe_numeric(.data$`2B`),
      `3B` = safe_numeric(.data$`3B`),
      TB = safe_numeric(.data$TB),
      HR = safe_numeric(.data$HR),
      RBI = safe_numeric(.data$RBI),
      BB = safe_numeric(.data$BB),
      HBP = safe_numeric(.data$HBP),
      SF = safe_numeric(.data$SF),
      SH = safe_numeric(.data$SH),
      K = safe_numeric(.data$K),
      SB = safe_numeric(.data$SB),
      CS = safe_numeric(.data$CS),
      R = safe_numeric(.data$R),
      GP = safe_numeric(.data$GP),
      GS = safe_numeric(.data$GS)
    ) |>
    dplyr::rename(
      player_name = "Player",
      jersey = "#",
      ab = "AB",
      h = "H",
      doubles = "2B",
      triples = "3B",
      tb = "TB",
      hr = "HR",
      rbi = "RBI",
      bb = "BB",
      hbp = "HBP",
      sf = "SF",
      sh = "SH",
      so = "K",
      sb = "SB",
      cs = "CS",
      r = "R",
      gp = "GP",
      gs = "GS"
    ) |>
    dplyr::left_join(links, by = c("player_name")) |>
    dplyr::transmute(
      player_id = .data$player_id,
      player_url = .data$player_url,
      player_name = .data$player_name,
      team_id = as.integer(team_info$team_id[[1]]),
      team_name = as.character(team_info$team_name[[1]]),
      conference = as.character(team_info$conference[[1]]),
      conference_id = as.integer(team_info$conference_id[[1]]),
      division = as.integer(team_info$division[[1]]),
      year = as.integer(team_info$year[[1]]),
      jersey = as.integer(.data$jersey),
      yr = as.character(.data$Yr),
      pos = as.character(.data$Pos),
      ht = as.character(.data$Ht),
      bats = stringr::str_sub(as.character(.data$`B/T`), 1, 1),
      throws = stringr::str_sub(as.character(.data$`B/T`), -1, -1),
      gp = .data$gp,
      gs = .data$gs,
      ab = .data$ab,
      h = .data$h,
      doubles = .data$doubles,
      triples = .data$triples,
      tb = .data$tb,
      hr = .data$hr,
      rbi = .data$rbi,
      bb = .data$bb,
      hbp = .data$hbp,
      sf = .data$sf,
      sh = .data$sh,
      so = .data$so,
      sb = .data$sb,
      cs = .data$cs,
      r = .data$r
    )

  df
}

add_pitching_derived_metrics <- function(df) {
  if (nrow(df) == 0) return(df)

  total_ip <- sum(df$ip_float, na.rm = TRUE)
  total_er <- sum(df$er, na.rm = TRUE)
  total_hr <- sum(df$hr_a, na.rm = TRUE)
  total_bb_hb <- sum(df$bb + df$hb, na.rm = TRUE)
  total_so <- sum(df$so, na.rm = TRUE)
  total_fb <- sum(df$fo + df$hr_a, na.rm = TRUE)
  lg_era <- if (total_ip > 0) (total_er * 9) / total_ip else 0
  fip_constant <- if (total_ip > 0) lg_era - ((13 * total_hr + 3 * total_bb_hb - 2 * total_so) / total_ip) else 0
  lg_hr_fb <- if (total_fb > 0) total_hr / total_fb else 0.1

  df <- df |>
    dplyr::mutate(
      whip = dplyr::if_else(.data$ip_float > 0, (.data$h + .data$bb) / .data$ip_float, NA_real_),
      k_pct = dplyr::if_else(.data$bf > 0, (.data$so / .data$bf) * 100, NA_real_),
      bb_pct = dplyr::if_else(.data$bf > 0, (.data$bb / .data$bf) * 100, NA_real_),
      k_minus_bb_pct = .data$k_pct - .data$bb_pct,
      fip = dplyr::if_else(
        .data$ip_float > 0,
        ((13 * .data$hr_a + 3 * (.data$bb + .data$hb) - 2 * .data$so) / .data$ip_float) + fip_constant,
        NA_real_
      ),
      expected_hr = (.data$fo + .data$hr_a) * lg_hr_fb,
      xfip = dplyr::if_else(
        .data$ip_float > 0,
        ((13 * .data$expected_hr + 3 * (.data$bb + .data$hb) - 2 * .data$so) / .data$ip_float) + fip_constant,
        NA_real_
      )
    )

  lg_fip <- weighted.mean(df$fip, w = pmax(df$ip_float, 0), na.rm = TRUE)
  replacement_fip <- lg_fip + 1
  runs_per_win <- 10

  df |>
    dplyr::mutate(
      era_plus = dplyr::if_else(
        .data$era > 0,
        100 * (lg_era / .data$era),
        dplyr::if_else(.data$ip_float > 0 & .data$er == 0, 999, NA_real_)
      ),
      war = dplyr::if_else(
        .data$ip_float > 0,
        ((replacement_fip - .data$fip) * .data$ip_float / 9) / runs_per_win,
        NA_real_
      )
    ) |>
    dplyr::select(-"expected_hr")
}

add_batting_derived_metrics <- function(df) {
  if (nrow(df) == 0) return(df)

  df <- df |>
    dplyr::mutate(
      pa = .data$ab + .data$bb + .data$hbp + .data$sf + .data$sh,
      avg = dplyr::if_else(.data$ab > 0, .data$h / .data$ab, NA_real_),
      obp = dplyr::if_else((.data$ab + .data$bb + .data$hbp + .data$sf) > 0, (.data$h + .data$bb + .data$hbp) / (.data$ab + .data$bb + .data$hbp + .data$sf), NA_real_),
      slg = dplyr::if_else(.data$ab > 0, .data$tb / .data$ab, NA_real_),
      ops = .data$obp + .data$slg,
      k_pct = dplyr::if_else(.data$pa > 0, (.data$so / .data$pa) * 100, NA_real_),
      bb_pct = dplyr::if_else(.data$pa > 0, (.data$bb / .data$pa) * 100, NA_real_),
      rc = ((.data$h + .data$bb + .data$hbp) * .data$tb) / pmax(1, (.data$ab + .data$bb + .data$hbp + .data$sf + .data$sh))
    )

  lg_rc_pa <- sum(df$rc, na.rm = TRUE) / max(1, sum(df$pa, na.rm = TRUE))

  df |>
    dplyr::mutate(
      wrc_plus = dplyr::if_else(.data$pa > 0 & lg_rc_pa > 0, ((.data$rc / .data$pa) / lg_rc_pa) * 100, NA_real_),
      war = dplyr::if_else(.data$pa > 0, (((.data$rc / pmax(.data$pa, 1)) - lg_rc_pa) * .data$pa) / 10, NA_real_)
    ) |>
    dplyr::select(-"rc")
}

fetch_type_for_year <- function(year, division, type, limit = NULL, team_name = NULL) {
  teams <- collegebaseball::ncaa_teams(years = year, divisions = division)
  teams <- dplyr::arrange(teams, .data$team_name)
  if (!is.null(team_name) && team_name != "") {
    pattern <- stringr::regex(team_name, ignore_case = TRUE)
    teams <- dplyr::filter(teams, stringr::str_detect(.data$team_name, pattern))
  }
  if (!is.null(limit)) {
    teams <- utils::head(teams, limit)
  }

  rows <- list()
  failures <- list()
  batch_size <- max(1L, cfg$batch_size)
  concurrency <- max(1L, cfg$concurrency)
  index_batches <- split(seq_len(nrow(teams)), ceiling(seq_len(nrow(teams)) / batch_size))

  for (batch_idx in seq_along(index_batches)) {
    indices <- index_batches[[batch_idx]]
    batch_teams <- lapply(indices, function(i) teams[i, , drop = FALSE])
    for (i in indices) {
      message(sprintf("[%s %s] queued %s (%s/%s)", year, type, as.character(teams$team_name[[i]]), i, nrow(teams)))
    }

    batch_results <- run_parallel(
      batch_teams,
      function(team_info) fetch_single_team(team_info, year, type),
      mc.cores = min(concurrency, length(batch_teams))
    )

    for (result in batch_results) {
      if (isTRUE(result$ok)) {
        rows[[length(rows) + 1]] <- result$rows
      } else {
        failures[[length(failures) + 1]] <- list(
          team_id = result$team_id,
          team_name = result$team_name,
          error = result$error
        )
      }
    }

    message(sprintf(
      "[%s %s] batch %s/%s complete: successes=%s failures=%s",
      year,
      type,
      batch_idx,
      length(index_batches),
      length(rows),
      length(failures)
    ))
  }

  combined <- dplyr::bind_rows(rows)
  combined <- if (type == "pitching") add_pitching_derived_metrics(combined) else add_batting_derived_metrics(combined)

  list(rows = combined, failures = failures, team_count = nrow(teams))
}

validate_result <- function(rows, failures, team_count, year, type, team_name = NULL, limit = NULL) {
  if (nrow(rows) == 0) {
    stop(sprintf("No %s rows produced for %s", type, year))
  }

  if (!is.null(team_name) && team_name != "") {
    if (!any(stringr::str_detect(rows$team_name, stringr::regex(team_name, ignore_case = TRUE)))) {
      stop(sprintf("Validation failed: %s not present in %s %s output", team_name, year, type))
    }
    return(invisible(TRUE))
  }

  if (is.null(limit)) {
    team_rows <- length(unique(rows$team_id))
    if (team_rows < max(50, floor(team_count * 0.9))) {
      stop(sprintf(
        "Validation failed: only %s/%s teams present in %s %s output",
        team_rows,
        team_count,
        year,
        type
      ))
    }
    if (!any(rows$team_name == "Babson")) {
      stop(sprintf("Validation failed: Babson missing from %s %s output", year, type))
    }
    if (length(failures) > max(10, floor(team_count * 0.05))) {
      stop(sprintf("Validation failed: too many failed teams for %s %s (%s)", year, type, length(failures)))
    }
  }

  invisible(TRUE)
}

meta <- list(
  synced_at = format(Sys.time(), tz = "UTC", usetz = TRUE),
  source = "collegebaseball+chromote",
  division = cfg$division,
  years = cfg$years,
  types = cfg$types,
  results = list()
)

for (year in cfg$years) {
  for (type in cfg$types) {
    result <- fetch_type_for_year(year, cfg$division, type, cfg$limit, cfg$team_name)
    rows <- result$rows
    failures <- result$failures
    validate_result(rows, failures, result$team_count, year, type, cfg$team_name, cfg$limit)

    meta$results[[paste0(year, "-", type)]] <- list(
      row_count = nrow(rows),
      team_count = result$team_count,
      failure_count = length(failures),
      failures = failures
    )

    if (cfg$dry_run) {
      message(sprintf("[dry-run] %s %s rows=%s failures=%s", year, type, nrow(rows), length(failures)))
      next
    }

    out_path <- file.path(out_dir, sprintf("%s-%s.json", type, year))
    writeLines(jsonlite::toJSON(rows, dataframe = "rows", auto_unbox = TRUE, na = "null", pretty = FALSE), out_path, useBytes = TRUE)
    message(sprintf("Wrote %s (%s rows)", out_path, nrow(rows)))
  }
}

if (!cfg$dry_run) {
  meta_path <- file.path(out_dir, "meta.json")
  writeLines(jsonlite::toJSON(meta, auto_unbox = TRUE, pretty = TRUE, na = "null"), meta_path, useBytes = TRUE)
  message(sprintf("Wrote %s", meta_path))
}
