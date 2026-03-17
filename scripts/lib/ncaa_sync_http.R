#!/usr/bin/env Rscript
# NCAA HTTP fetch helpers -- transport layer only.
# Returns structured fetch results without NCAA-specific HTML knowledge.

if (!requireNamespace("httr", quietly = TRUE)) {
  stop("httr is required for ncaa_sync_http.R")
}

NCAA_BASE_URL <- "https://stats.ncaa.org"

.NCAA_HEADERS <- c(
  `User-Agent`      = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  `Accept`          = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  `Accept-Language` = "en-US,en;q=0.5",
  `Connection`      = "keep-alive"
)

# Classify raw HTTP response into structured status.
# Returns one of: "success", "access_denied", "parse_failed".
.classify_http_outcome <- function(http_code, body) {
  if (http_code %in% c(403, 429, 503)) return("access_denied")
  if (http_code >= 400) return("access_denied")
  if (!is.character(body) || nchar(body) == 0) return("parse_failed")
  if (grepl("access denied", body, ignore.case = TRUE) ||
      grepl("Access Denied", body, fixed = TRUE)) {
    return("access_denied")
  }
  "success"
}

#' Fetch a URL with retry/backoff.
#'
#' Returns list:
#'   status    - "success" | "access_denied" | "parse_failed"
#'   html      - character or NULL
#'   url       - the requested URL
#'   http_code - integer or NA
#'   attempts  - number of attempts made
#'   error     - error message or NULL
ncaa_fetch_page <- function(url, max_retries = 3L, timeout = 25L, backoff_base = 2) {
  last_result <- NULL
  for (attempt in seq_len(max_retries)) {
    result <- tryCatch({
      resp   <- httr::GET(url, httr::add_headers(.NCAA_HEADERS), httr::timeout(timeout))
      code   <- httr::status_code(resp)
      body   <- httr::content(resp, as = "text", encoding = "UTF-8")
      status <- .classify_http_outcome(code, body)
      list(
        status    = status,
        html      = if (status == "success") body else NULL,
        url       = url,
        http_code = code,
        attempts  = attempt,
        error     = NULL
      )
    }, error = function(e) {
      list(
        status    = "parse_failed",
        html      = NULL,
        url       = url,
        http_code = NA_integer_,
        attempts  = attempt,
        error     = conditionMessage(e)
      )
    })
    last_result <- result
    # Don't retry access_denied or success -- only transient network errors
    if (result$status %in% c("success", "access_denied")) break
    if (attempt < max_retries) Sys.sleep(backoff_base ^ attempt)
  }
  last_result
}

#' Build the NCAA season-to-date stats URL for a team.
ncaa_stats_url <- function(team_id, year_stat_category_id) {
  sprintf(
    "%s/teams/%s/season_to_date_stats?year_stat_category_id=%s",
    NCAA_BASE_URL,
    as.integer(team_id),
    as.integer(year_stat_category_id)
  )
}
