#!/usr/bin/env Rscript
# NCAA fetch helpers -- Chromote transport with a single shared browser session.
#
# Key improvement over the old per-team session model: one ChromoteSession is
# created lazily on first fetch and reused for every subsequent team request in
# the same R process. This eliminates the per-team Chrome startup overhead
# (~1-2s per team × hundreds of teams) while keeping all other Phase 12.2
# architectural improvements (structured status, incremental mode, meta.json).

library(chromote)

.NCAA_UA      <- "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
NCAA_BASE_URL <- "https://stats.ncaa.org"

# Module-level session state (one session per R process)
.ncaa_state         <- new.env(parent = emptyenv())
.ncaa_state$session <- NULL

# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------

.ncaa_get_session <- function() {
  ses <- .ncaa_state$session
  alive <- if (is.null(ses)) FALSE else tryCatch({ ses$readyState(); TRUE }, error = function(e) FALSE)

  if (!alive) {
    message("[ncaa] Starting shared browser session")
    ses <- chromote::ChromoteSession$new()
    ses$Network$enable()
    ses$Network$setUserAgentOverride(userAgent = .NCAA_UA)
    .ncaa_state$session <- ses
  }
  ses
}

#' Close the shared session. Call once at the end of the sync run.
ncaa_close_session <- function() {
  if (!is.null(.ncaa_state$session)) {
    try(.ncaa_state$session$close(), silent = TRUE)
    .ncaa_state$session <- NULL
    message("[ncaa] Browser session closed")
  }
}

# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

#' Fetch a URL via the shared Chromote session.
#'
#' Returns list:
#'   status    - "success" | "access_denied" | "parse_failed"
#'   html      - character or NULL
#'   url       - the requested URL
#'   attempts  - number of attempts made
#'   error     - error message or NULL
ncaa_fetch_page <- function(url, max_wait_seconds = 8L, max_retries = 2L) {
  `%||%` <- function(x, y) if (is.null(x)) y else x

  last_result <- NULL

  for (attempt in seq_len(max_retries)) {
    result <- tryCatch({
      ses <- .ncaa_get_session()
      ses$Page$navigate(url = url)

      started <- Sys.time()
      html    <- NULL
      done    <- FALSE

      while (!done &&
             as.numeric(difftime(Sys.time(), started, units = "secs")) < max_wait_seconds) {

        state <- ses$Runtime$evaluate("
          (() => {
            const body = document.body ? document.body.innerText : '';
            return {
              title:          document.title || '',
              ready:          document.readyState || '',
              accessDenied:   /access denied/i.test(body) ||
                              /access denied/i.test(document.title || ''),
              tableCount:     document.querySelectorAll('table').length,
              statGridLinks:  document.querySelectorAll('#stat_grid a').length
            };
          })()
        ")$result$value

        if (isTRUE(state$accessDenied)) {
          return(list(status = "access_denied", html = NULL,
                      url = url, attempts = attempt, error = "Access denied by NCAA"))
        }

        # Two or more tables with at least one stat_grid link = data present
        if ((state$tableCount %||% 0L) >= 2L && (state$statGridLinks %||% 0L) > 0L) {
          doc  <- ses$DOM$getDocument()
          html <- ses$DOM$getOuterHTML(nodeId = doc$root$nodeId)[["outerHTML"]]
          done <- TRUE
          break
        }

        # Page fully loaded but no tables / links -- early-season empty page
        if (isTRUE(state$ready == "complete") &&
            (state$tableCount %||% 0L) < 2L &&
            as.numeric(difftime(Sys.time(), started, units = "secs")) >= 1.5) {
          doc  <- ses$DOM$getDocument()
          html <- ses$DOM$getOuterHTML(nodeId = doc$root$nodeId)[["outerHTML"]]
          done <- TRUE
          break
        }

        Sys.sleep(0.2)
      }

      # Timeout fallback -- grab whatever rendered
      if (is.null(html)) {
        doc  <- ses$DOM$getDocument()
        html <- ses$DOM$getOuterHTML(nodeId = doc$root$nodeId)[["outerHTML"]]
      }

      list(status = "success", html = html, url = url, attempts = attempt, error = NULL)

    }, error = function(e) {
      # Session may have crashed -- clear so next call reinitialises
      .ncaa_state$session <- NULL
      list(status = "parse_failed", html = NULL,
           url = url, attempts = attempt, error = conditionMessage(e))
    })

    last_result <- result
    if (result$status %in% c("success", "access_denied")) break
    if (attempt < max_retries) Sys.sleep(2)
  }

  last_result
}

# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

#' Build the NCAA season-to-date stats URL for a team.
ncaa_stats_url <- function(team_id, year_stat_category_id) {
  sprintf(
    "%s/teams/%s/season_to_date_stats?year_stat_category_id=%s",
    NCAA_BASE_URL,
    as.integer(team_id),
    as.integer(year_stat_category_id)
  )
}
