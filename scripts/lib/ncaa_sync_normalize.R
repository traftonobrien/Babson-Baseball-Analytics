#!/usr/bin/env Rscript
# NCAA HTML parsing, row normalization, and derived metrics.
# Separate from transport (ncaa_sync_http.R) so parser logic is testable with fixtures.

`%||%` <- function(x, y) if (is.null(x)) y else x

safe_numeric <- function(x) {
  out <- suppressWarnings(as.numeric(as.character(x)))
  out[is.na(out)] <- 0
  out
}

normalize_name <- function(x) {
  stringr::str_replace_all(tolower(as.character(x)), "[^a-z0-9]", "")
}

to_ip_float <- function(ip) {
  ip_chr <- trimws(as.character(ip))
  out <- rep(NA_real_, length(ip_chr))
  for (idx in seq_along(ip_chr)) {
    value <- ip_chr[[idx]]
    if (is.na(value) || value == "") next
    parts      <- strsplit(value, "\\.", fixed = FALSE)[[1]]
    whole      <- suppressWarnings(as.numeric(parts[[1]]))
    frac       <- if (length(parts) > 1) parts[[2]] else "0"
    frac_digits <- suppressWarnings(as.numeric(frac))
    if (!is.finite(whole)) next
    if (!is.finite(frac_digits)) frac_digits <- 0
    thirds <- dplyr::case_when(
      frac_digits == 0 ~ 0,
      frac_digits == 1 ~ 1 / 3,
      frac_digits == 2 ~ 2 / 3,
      TRUE             ~ frac_digits / 10
    )
    out[[idx]] <- whole + thirds
  }
  out
}

#' Parse an NCAA stats HTML page.
#'
#' Classification precedence (explicit, deterministic):
#'   1. access_denied  -- response body already classified upstream; this catches
#'                        any denial markers that leaked into "success" HTML.
#'   2. parse_failed   -- page reachable but expected stat table or required
#'                        columns are missing (excluding the empty-page case).
#'   3. empty_stats    -- page reachable, stat table present, but zero player rows
#'                        after removing blanks/subheaders (early-season normal).
#'   4. success        -- normalization yields valid rows.
#'
#' Returns list:
#'   status - "success" | "empty_stats" | "parse_failed" | "access_denied"
#'   df     - raw tibble or NULL
#'   links  - player-link tibble or NULL
#'   detail - diagnostic message for non-success
ncaa_parse_stats_html <- function(html, type) {
  # Late access-denied check (some denials arrive as 200 with HTML body)
  if (grepl("access denied", html, ignore.case = TRUE) ||
      grepl("<title>Access Denied", html, ignore.case = TRUE)) {
    return(list(status = "access_denied", df = NULL, links = NULL,
                detail = "Access denied marker found in response body"))
  }

  doc <- tryCatch(xml2::read_html(html), error = function(e) NULL)
  if (is.null(doc)) {
    return(list(status = "parse_failed", df = NULL, links = NULL,
                detail = "Failed to parse HTML document"))
  }

  tables <- rvest::html_elements(doc, "table")
  if (length(tables) < 2) {
    # Single table with header only = early-season empty page
    return(list(status = "empty_stats", df = NULL, links = NULL,
                detail = sprintf("Only %d table(s) found; stats not yet available", length(tables))))
  }

  stat_table <- tryCatch(
    rvest::html_table(tables[[2]], convert = FALSE),
    error = function(e) NULL
  )
  if (is.null(stat_table) || !is.data.frame(stat_table)) {
    return(list(status = "parse_failed", df = NULL, links = NULL,
                detail = "Failed to read stat table"))
  }

  # Require at minimum the jersey column (#) and the type-specific sentinel column
  required_col <- if (type == "pitching") "ERA" else "AB"
  if (!"#" %in% colnames(stat_table) || !required_col %in% colnames(stat_table)) {
    return(list(status = "parse_failed", df = NULL, links = NULL,
                detail = sprintf("Missing required column '#' or '%s'", required_col)))
  }

  # Player rows have a numeric jersey; subheaders/totals do not
  player_rows <- stat_table[suppressWarnings(!is.na(as.numeric(stat_table[["#"]]))), ]
  if (nrow(player_rows) == 0) {
    return(list(status = "empty_stats", df = NULL, links = NULL,
                detail = "Stat table present but contains no player rows (early season)"))
  }

  # Extract player links from #stat_grid anchors
  link_nodes <- rvest::html_elements(doc, "#stat_grid a")
  links <- tibble::tibble(
    player_name = rvest::html_text(link_nodes, trim = TRUE),
    href        = rvest::html_attr(link_nodes, "href")
  ) |>
    dplyr::mutate(
      player_id  = stringr::str_extract(.data$href, "(?<=/players/)\\d+"),
      player_url = dplyr::if_else(
        is.na(.data$href), NA_character_,
        paste0("https://stats.ncaa.org", .data$href)
      )
    )

  list(
    status = "success",
    df     = tibble::as_tibble(stat_table),
    links  = links,
    detail = NULL
  )
}

extract_pitching_rows <- function(raw_df, links, team_info) {
  raw_df |>
    dplyr::mutate(`#` = suppressWarnings(as.numeric(`#`))) |>
    dplyr::filter(!is.na(`#`)) |>
    dplyr::mutate(
      App     = safe_numeric(.data$App),
      GS      = safe_numeric(.data$GS),
      ERA     = safe_numeric(.data$ERA),
      H       = safe_numeric(.data$H),
      R       = safe_numeric(.data$R),
      ER      = safe_numeric(.data$ER),
      BB      = safe_numeric(.data$BB),
      SO      = safe_numeric(.data$SO),
      BF      = safe_numeric(.data$BF),
      `HR-A`  = safe_numeric(.data$`HR-A`),
      HB      = safe_numeric(.data$HB),
      Pitches = safe_numeric(.data$Pitches),
      GO      = safe_numeric(.data$GO),
      FO      = safe_numeric(.data$FO),
      W       = safe_numeric(.data$W),
      L       = safe_numeric(.data$L),
      SV      = safe_numeric(.data$SV),
      IBB     = safe_numeric(.data$IBB),
      ip_text = as.character(.data$IP),
      ip_float = to_ip_float(.data$IP)
    ) |>
    dplyr::rename(
      player_name = "Player",
      jersey = "#",
      hr_a = "HR-A", hb = "HB", bb = "BB", so = "SO", bf = "BF",
      h = "H", r = "R", er = "ER", app = "App", gs = "GS", era = "ERA",
      pitches = "Pitches", go = "GO", fo = "FO",
      w = "W", l = "L", sv = "SV", ibb = "IBB"
    ) |>
    dplyr::left_join(links, by = "player_name") |>
    dplyr::transmute(
      player_id    = as.character(.data$player_id),
      player_url   = as.character(.data$player_url),
      player_name  = .data$player_name,
      team_id      = as.integer(team_info$team_id[[1]]),
      team_name    = as.character(team_info$team_name[[1]]),
      conference   = as.character(team_info$conference[[1]]),
      conference_id = as.integer(team_info$conference_id[[1]]),
      division     = as.integer(team_info$division[[1]]),
      year         = as.integer(team_info$year[[1]]),
      jersey       = as.integer(.data$jersey),
      yr           = as.character(.data$Yr),
      pos          = as.character(.data$Pos),
      ht           = as.character(.data$Ht),
      bats         = stringr::str_sub(as.character(.data$`B/T`), 1, 1),
      throws       = stringr::str_sub(as.character(.data$`B/T`), -1, -1),
      app          = .data$app,
      gs           = .data$gs,
      era          = .data$era,
      ip           = .data$ip_text,
      ip_float     = .data$ip_float,
      h = .data$h, r = .data$r, er = .data$er, bb = .data$bb, so = .data$so,
      bf = .data$bf, hr_a = .data$hr_a, hb = .data$hb, pitches = .data$pitches,
      go = .data$go, fo = .data$fo, w = .data$w, l = .data$l, sv = .data$sv,
      ibb = .data$ibb
    )
}

extract_batting_rows <- function(raw_df, links, team_info) {
  raw_df |>
    dplyr::mutate(`#` = suppressWarnings(as.numeric(`#`))) |>
    dplyr::filter(!is.na(`#`)) |>
    dplyr::mutate(
      AB  = safe_numeric(.data$AB),
      H   = safe_numeric(.data$H),
      `2B` = safe_numeric(.data$`2B`),
      `3B` = safe_numeric(.data$`3B`),
      TB  = safe_numeric(.data$TB),
      HR  = safe_numeric(.data$HR),
      RBI = safe_numeric(.data$RBI),
      BB  = safe_numeric(.data$BB),
      HBP = safe_numeric(.data$HBP),
      SF  = safe_numeric(.data$SF),
      SH  = safe_numeric(.data$SH),
      K   = safe_numeric(.data$K),
      SB  = safe_numeric(.data$SB),
      CS  = safe_numeric(.data$CS),
      R   = safe_numeric(.data$R),
      GP  = safe_numeric(.data$GP),
      GS  = safe_numeric(.data$GS)
    ) |>
    dplyr::rename(
      player_name = "Player", jersey = "#",
      ab = "AB", h = "H", doubles = "2B", triples = "3B", tb = "TB",
      hr = "HR", rbi = "RBI", bb = "BB", hbp = "HBP", sf = "SF", sh = "SH",
      so = "K", sb = "SB", cs = "CS", r = "R", gp = "GP", gs = "GS"
    ) |>
    dplyr::left_join(links, by = "player_name") |>
    dplyr::transmute(
      player_id    = as.character(.data$player_id),
      player_url   = as.character(.data$player_url),
      player_name  = .data$player_name,
      team_id      = as.integer(team_info$team_id[[1]]),
      team_name    = as.character(team_info$team_name[[1]]),
      conference   = as.character(team_info$conference[[1]]),
      conference_id = as.integer(team_info$conference_id[[1]]),
      division     = as.integer(team_info$division[[1]]),
      year         = as.integer(team_info$year[[1]]),
      jersey       = as.integer(.data$jersey),
      yr           = as.character(.data$Yr),
      pos          = as.character(.data$Pos),
      ht           = as.character(.data$Ht),
      bats         = stringr::str_sub(as.character(.data$`B/T`), 1, 1),
      throws       = stringr::str_sub(as.character(.data$`B/T`), -1, -1),
      gp = .data$gp, gs = .data$gs, ab = .data$ab, h = .data$h,
      doubles = .data$doubles, triples = .data$triples, tb = .data$tb,
      hr = .data$hr, rbi = .data$rbi, bb = .data$bb, hbp = .data$hbp,
      sf = .data$sf, sh = .data$sh, so = .data$so,
      sb = .data$sb, cs = .data$cs, r = .data$r
    )
}

add_pitching_derived_metrics <- function(df) {
  if (nrow(df) == 0) return(df)

  total_ip     <- sum(df$ip_float, na.rm = TRUE)
  total_er     <- sum(df$er, na.rm = TRUE)
  total_hr     <- sum(df$hr_a, na.rm = TRUE)
  total_bb_hb  <- sum(df$bb + df$hb, na.rm = TRUE)
  total_so     <- sum(df$so, na.rm = TRUE)
  total_fb     <- sum(df$fo + df$hr_a, na.rm = TRUE)
  lg_era       <- if (total_ip > 0) (total_er * 9) / total_ip else 0
  fip_constant <- if (total_ip > 0) lg_era - ((13 * total_hr + 3 * total_bb_hb - 2 * total_so) / total_ip) else 0
  lg_hr_fb     <- if (total_fb > 0) total_hr / total_fb else 0.1

  df <- df |>
    dplyr::mutate(
      whip          = dplyr::if_else(.data$ip_float > 0, (.data$h + .data$bb) / .data$ip_float, NA_real_),
      k_pct         = dplyr::if_else(.data$bf > 0, (.data$so / .data$bf) * 100, NA_real_),
      bb_pct        = dplyr::if_else(.data$bf > 0, (.data$bb / .data$bf) * 100, NA_real_),
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

  lg_fip          <- weighted.mean(df$fip, w = pmax(df$ip_float, 0), na.rm = TRUE)
  replacement_fip <- lg_fip + 1
  runs_per_win    <- 10

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
      pa  = .data$ab + .data$bb + .data$hbp + .data$sf + .data$sh,
      avg = dplyr::if_else(.data$ab > 0, .data$h / .data$ab, NA_real_),
      obp = dplyr::if_else(
        (.data$ab + .data$bb + .data$hbp + .data$sf) > 0,
        (.data$h + .data$bb + .data$hbp) / (.data$ab + .data$bb + .data$hbp + .data$sf),
        NA_real_
      ),
      slg   = dplyr::if_else(.data$ab > 0, .data$tb / .data$ab, NA_real_),
      ops   = .data$obp + .data$slg,
      k_pct = dplyr::if_else(.data$pa > 0, (.data$so / .data$pa) * 100, NA_real_),
      bb_pct = dplyr::if_else(.data$pa > 0, (.data$bb / .data$pa) * 100, NA_real_),
      rc = ((.data$h + .data$bb + .data$hbp) * .data$tb) /
            pmax(1, (.data$ab + .data$bb + .data$hbp + .data$sf + .data$sh))
    )

  lg_rc_pa <- sum(df$rc, na.rm = TRUE) / max(1, sum(df$pa, na.rm = TRUE))

  df |>
    dplyr::mutate(
      wrc_plus = dplyr::if_else(
        .data$pa > 0 & lg_rc_pa > 0,
        ((.data$rc / .data$pa) / lg_rc_pa) * 100,
        NA_real_
      ),
      war = dplyr::if_else(
        .data$pa > 0,
        (((.data$rc / pmax(.data$pa, 1)) - lg_rc_pa) * .data$pa) / 10,
        NA_real_
      )
    ) |>
    dplyr::select(-"rc")
}
