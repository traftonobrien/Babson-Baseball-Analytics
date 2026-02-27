## ----setup, include=FALSE--------------------------------------------------------------
knitr::opts_chunk$set(echo = TRUE, message = FALSE, warning = FALSE)

# Clear any stale variables that might conflict
rm(list = intersect(ls(), c("INPUT_CSV", "OUTPUT_DIR", "dt")))

suppressPackageStartupMessages({
  library(data.table)
  library(dplyr)
  library(xgboost)
  library(Matrix)
  library(rsample)
})

# Grab arguments passed by the AI in the terminal
args <- commandArgs(trailingOnly = TRUE)

# If no arguments are passed, fall back to the default paths for manual testing
if (length(args) >= 2) {
  INPUT_CSV  <- args[1]
  OUTPUT_DIR <- args[2]
} else {
  INPUT_CSV  <- "/Users/traftonobrien/Desktop/pitch-tracker/output/exports/trackman_outing_pitchtype_averages.csv"
  OUTPUT_DIR <- "/Users/traftonobrien/Desktop/pitch-tracker/output/stuff_plus"
}

# Max velo can stay static since it acts as a reference database
MAX_VELO_CSV <- "/Users/traftonobrien/Desktop/pitch-tracker/data/Max Velos.csv"


dir.create(OUTPUT_DIR, recursive = TRUE, showWarnings = FALSE)


## ----show-config-----------------------------------------------------------------------
print(paste("Input CSV:", INPUT_CSV))
print(paste("Output dir:", OUTPUT_DIR))


## ----utils-----------------------------------------------------------------------------
# Robust Z-score (median / IQR, mirrors sklearn RobustScaler)
robust_z <- function(x) {
  med <- median(x, na.rm = TRUE)
  iqr_val <- IQR(x, na.rm = TRUE)
  if (is.na(iqr_val) || iqr_val == 0) return(rep(0, length(x)))
  (x - med) / iqr_val
}

# Assert columns exist
assert_cols <- function(dt, cols, label = "data") {
  missing <- setdiff(cols, names(dt))
  if (length(missing) > 0) {
    stop(sprintf("[%s] Missing required columns: %s", label, paste(missing, collapse = ", ")))
  }
}

# Safe numeric conversion
safe_numeric <- function(x) suppressWarnings(as.numeric(x))


## ----read-data-------------------------------------------------------------------------
cat("[read_data] Reading:", as.character(INPUT_CSV), "\n")
dt <- fread(as.character(INPUT_CSV), na.strings = c("", "NA", "NULL"))

required_base <- c(
  "player_id", "date", "session_key", "pitch_type", "handedness",
  "avg_velo_mph", "avg_ivb_in", "avg_hb_in",
  "avg_ext_ft", "avg_rel_height_ft", "avg_rel_side_ft"
)
assert_cols(dt, required_base, "pitchtype CSV")

n_total <- nrow(dt)
cat(sprintf("[read_data] Total rows read: %d\n", n_total))

# Convert numerics
num_cols <- c("avg_velo_mph", "avg_ivb_in", "avg_hb_in", "avg_spin_rpm",
              "avg_ext_ft", "avg_rel_height_ft", "avg_rel_side_ft", "n_pitches")
for (col in intersect(num_cols, names(dt))) dt[[col]] <- safe_numeric(dt[[col]])

# Remove OTHER pitch type (case insensitive)
n_before <- nrow(dt)
dt <- dt[!grepl("^other$", pitch_type, ignore.case = TRUE)]
n_other_removed <- n_before - nrow(dt)
cat(sprintf("[read_data] Removed %d OTHER rows. Remaining: %d\n", n_other_removed, nrow(dt)))

# Drop rows missing critical fields
critical <- c("avg_velo_mph", "avg_ivb_in", "avg_hb_in",
               "avg_ext_ft", "avg_rel_height_ft", "avg_rel_side_ft")
dt <- dt[complete.cases(dt[, ..critical])]
cat(sprintf("[read_data] After dropping NA critical rows: %d\n", nrow(dt)))

# Derive throws (R/L) from handedness column
dt[, throws := fifelse(grepl("L", handedness, ignore.case = TRUE), "L", "R")]

# Ensure session_date is Date
if ("session_date" %in% names(dt)) dt[, session_date := as.Date(session_date, format = "%m/%d/%y")]

## ----max-velo--------------------------------------------------------------------------
# Read max velo data — player_id formats differ so we join on last name
max_velo_dt <- fread(MAX_VELO_CSV, na.strings = c("", "NA", "NULL"))
max_velo_dt[, max_velo := safe_numeric(max_velo)]

# Extract last name from both datasets for joining
# Strip apostrophes and non-alpha characters for clean matching
# Trackman: player_id = "obrien_trafton" → last name = first part
dt[, join_last := tolower(gsub("[^a-z]", "", gsub("_.*", "", player_id)))]

# Max Velos: player_name = "Trafton OBrien" → last name = last word
# Must tolower FIRST, then strip non-alpha (otherwise uppercase gets removed)
max_velo_dt[, join_last := gsub("[^a-z]", "", tolower(gsub(".*\\s+", "", player_name)))]

# Merge — deduplicate max_velo_dt by join_last first (take highest max velo)
mv_deduped <- max_velo_dt[!is.na(max_velo), .(max_fb_velo = max(max_velo)), by = join_last]

cat("[max_velo] Trackman join keys (sample):\n")
print(head(unique(dt$join_last), 10))
cat("[max_velo] Max Velo join keys (sample):\n")
print(head(mv_deduped$join_last, 10))
cat(sprintf("[max_velo] Max Velo rows available: %d\n", nrow(mv_deduped)))

dt <- merge(dt, mv_deduped, by = "join_last", all.x = TRUE)

cat(sprintf("[max_velo] After merge — NA count in max_fb_velo: %d / %d\n",
            sum(is.na(dt$max_fb_velo)), nrow(dt)))

dt[, join_last := NULL]

# Report coverage
n_matched <- sum(!is.na(dt$max_fb_velo))
cat(sprintf("[max_velo] Matched %d / %d rows (%.0f%%)\n",
            n_matched, nrow(dt), 100 * n_matched / nrow(dt)))

# For any unmatched, use their own outing FB velo as fallback (set later after FB baseline)
# For now, flag them
if (any(is.na(dt$max_fb_velo))) {
  cat(sprintf("[max_velo] WARNING: %d rows missing max_fb_velo — will fill after FB baseline\n",
              sum(is.na(dt$max_fb_velo))))
}


## ----derived-features------------------------------------------------------------------
dt[, movement_mag := sqrt(avg_ivb_in^2 + avg_hb_in^2)]
dt[, ivb_abs      := abs(avg_ivb_in)]
dt[, hb_abs       := abs(avg_hb_in)]


## ----z-scores--------------------------------------------------------------------------
# Create z-score grouping: Splitter pools with ChangeUp for larger sample
# Original pitch_type label is preserved for display/export
dt[, zscore_group := pitch_type]
dt[zscore_group == "Splitter", zscore_group := "ChangeUp"]

cat("[features] Z-score groups:\n")
print(dt[, .N, by = zscore_group][order(-N)])

# Within-group robust Z-scores (Splitter now compared against ChangeUp pool)
dt[, velo_z       := robust_z(avg_velo_mph),      by = zscore_group]
dt[, spin_z       := robust_z(avg_spin_rpm),      by = zscore_group]
dt[, ext_z        := robust_z(avg_ext_ft),        by = zscore_group]
dt[, rel_height_z := robust_z(avg_rel_height_ft), by = zscore_group]
dt[, rel_side_z   := robust_z(avg_rel_side_ft),   by = zscore_group]
dt[, movement_z   := robust_z(movement_mag),      by = zscore_group]

# Spin may be missing — handle safely
dt[is.na(spin_z), spin_z := 0]


## ----fb-baseline-----------------------------------------------------------------------
# Pool Fastballs and Sinkers to ensure Sinker-only guys get a baseline
fb_rows <- dt[grepl("fastball|four|sinker", pitch_type, ignore.case = TRUE)]

if (nrow(fb_rows) == 0) stop("[features] FATAL: Cannot identify any fastball-family pitch.")

fb_baseline <- fb_rows[, .(
  fb_velo     = mean(avg_velo_mph, na.rm = TRUE),
  fb_ivb      = mean(avg_ivb_in, na.rm = TRUE),
  fb_hb       = mean(avg_hb_in, na.rm = TRUE),
  fb_spin     = mean(avg_spin_rpm, na.rm = TRUE),
  fb_movement = mean(movement_mag, na.rm = TRUE)
), by = .(player_id, date)]

dt <- merge(dt, fb_baseline, by = c("player_id", "date"), all.x = TRUE)

# For outings without a fastball, use pitcher's overall FB average
player_fb_avg <- fb_baseline[, .(
  fb_velo_avg     = mean(fb_velo, na.rm = TRUE),
  fb_ivb_avg      = mean(fb_ivb, na.rm = TRUE),
  fb_hb_avg       = mean(fb_hb, na.rm = TRUE),
  fb_spin_avg     = mean(fb_spin, na.rm = TRUE),
  fb_movement_avg = mean(fb_movement, na.rm = TRUE)
), by = player_id]

dt <- merge(dt, player_fb_avg, by = "player_id", all.x = TRUE)

dt[is.na(fb_velo),     fb_velo     := fb_velo_avg]
dt[is.na(fb_ivb),      fb_ivb      := fb_ivb_avg]
dt[is.na(fb_hb),       fb_hb       := fb_hb_avg]
dt[is.na(fb_spin),     fb_spin     := fb_spin_avg]
dt[is.na(fb_movement), fb_movement := fb_movement_avg]

dt[, c("fb_velo_avg", "fb_ivb_avg", "fb_hb_avg", "fb_spin_avg", "fb_movement_avg") := NULL]

# Fill any missing max_fb_velo with the pitcher's own outing FB velo
dt[is.na(max_fb_velo), max_fb_velo := fb_velo]

dt[, fb_velo_pct_max := fb_velo / max_fb_velo]
dt[, velo_pct_max    := avg_velo_mph / max_fb_velo]
dt[, velo_reserve    := max_fb_velo - avg_velo_mph]

cat(sprintf("[features] Max FB velo range: %.1f - %.1f mph\n",
            min(dt$max_fb_velo, na.rm = TRUE), max(dt$max_fb_velo, na.rm = TRUE)))


## --------------------------------------------------------------------------------------



## ----differentials---------------------------------------------------------------------
dt[, velo_diff     := avg_velo_mph - fb_velo]
dt[, ivb_diff      := avg_ivb_in   - fb_ivb]
dt[, hb_diff       := avg_hb_in    - fb_hb]
dt[, spin_diff     := avg_spin_rpm - fb_spin]
dt[, movement_diff := movement_mag - fb_movement]

diff_cols <- c("velo_diff", "ivb_diff", "hb_diff", "spin_diff", "movement_diff")
for (col in diff_cols) dt[is.na(get(col)), (col) := 0]

# Z-scores for differentials (used in synthetic target) — uses zscore_group
dt[, velo_diff_z     := robust_z(velo_diff),     by = zscore_group]
dt[, movement_diff_z := robust_z(movement_diff), by = zscore_group]


## ----encodings-------------------------------------------------------------------------
# One-hot encode pitch_type
pitch_types <- sort(unique(dt$pitch_type))
for (pt in pitch_types) {
  col_name <- paste0("pt_", gsub("[^A-Za-z]", "", pt))
  dt[, (col_name) := as.integer(pitch_type == pt)]
}

# Handedness
dt[, hand_L := as.integer(throws == "L")]

cat(sprintf("[features] Engineering complete. Columns: %d\n", ncol(dt)))


## ----synthetic-target------------------------------------------------------------------
# Additional z-scores for target
dt[, ivb_z     := robust_z(avg_ivb_in), by = zscore_group]
dt[, ivb_abs_z := robust_z(ivb_abs),    by = zscore_group]
dt[, hb_abs_z  := robust_z(hb_abs),     by = zscore_group] # NEW: To reward sweepers!

# Safety fill: any remaining NA in velo pct features → use median
dt[is.na(fb_velo_pct_max), fb_velo_pct_max := median(dt$fb_velo_pct_max, na.rm = TRUE)]
dt[is.na(velo_pct_max),    velo_pct_max    := median(dt$velo_pct_max, na.rm = TRUE)]
dt[is.na(max_fb_velo),     max_fb_velo     := median(dt$max_fb_velo, na.rm = TRUE)]

dt[, fb_velo_pct_max_z := robust_z(fb_velo_pct_max)]  
dt[, velo_pct_max_z    := robust_z(velo_pct_max), by = zscore_group]
dt[, global_velo_z     := robust_z(avg_velo_mph)] 
dt[, max_fb_velo_z     := robust_z(max_fb_velo)]

# 1. CATEGORIZE PITCHES PROPERLY (Cutters are Fastballs!)
is_fb    <- as.integer(grepl("fastball|sinker|four|cutter", dt$pitch_type, ignore.case = TRUE))
is_curve <- as.integer(grepl("curveball", dt$pitch_type, ignore.case = TRUE))
is_slide <- as.integer(grepl("slider|sweeper", dt$pitch_type, ignore.case = TRUE))
is_os    <- as.integer(grepl("changeup|splitter", dt$pitch_type, ignore.case = TRUE))

# 2. Fastball / Cutter Target: Velo + Extension (Your Custom Weights)
fb_score <- (
  0.15 * dt$fb_velo_pct_max_z +  # 15% Intent/Effort
    0.45 * dt$global_velo_z +      # 45% Raw Heat
    0.15 * dt$ext_z +              # 15% Extension (Perceived Velo Boost)
    0.15 * dt$movement_z +         # 15% Shape/Movement
    0.05 * dt$spin_z +             #  5% Spin Efficiency
    0.05 * dt$velo_pct_max_z       #  5% Consistency
)

# 3. Curveball Target: Depth, Spin, and Velo Separation
curve_score <- (
  0.30 * dt$ivb_abs_z +            # Massive reward for huge absolute drop (12-6)
    0.25 * (-1 * dt$velo_diff_z) +   # Reward velocity separation from FB
    0.15 * dt$spin_z +               # Reward tight spin
    0.10 * dt$movement_diff_z +      # Shape separation from FB
    0.10 * dt$movement_z +           # Overall movement magnitude
    0.10 * dt$max_fb_velo_z          # Halo effect for big arms
)

# 4. Slider / Sweeper Target: Velocity, Sweep, and Deception
slide_score <- (
  0.30 * dt$velo_z +               # Reward throwing the slider HARD (within pitch type)
    0.25 * dt$hb_abs_z +             # Reward big horizontal sweep
    0.15 * dt$movement_diff_z +      # Must move differently than the FB
    0.10 * dt$spin_z +               # Spin is good, but less critical than on a curve
    0.10 * dt$movement_z +
    0.10 * dt$max_fb_velo_z          # Halo effect for big arms
)

# 5. Offspeed Target: Kill spin, kill IVB, massive velo drop
os_score <- (
  0.30 * (-1 * dt$velo_diff_z) +   
    0.30 * (-1 * dt$ivb_z) +         
    0.15 * dt$movement_diff_z +      
    0.10 * (-1 * dt$spin_z) +        
    0.05 * dt$fb_velo_pct_max_z +
    0.10 * dt$max_fb_velo_z        
)

# Combine all 4 buckets
dt[, ShapeImpactScore := (is_fb * fb_score) + 
     (is_curve * curve_score) + 
     (is_slide * slide_score) + 
     (is_os * os_score)]

# Safety: replace any remaining NaN/NA in target
dt[is.na(ShapeImpactScore) | is.nan(ShapeImpactScore), ShapeImpactScore := 0]
cat(sprintf("[target] NAs in ShapeImpactScore after safety fill: %d\n", sum(is.na(dt$ShapeImpactScore))))

# Normalize to mean 0, sd 1
sis_mean <- mean(dt$ShapeImpactScore, na.rm = TRUE)
sis_sd   <- sd(dt$ShapeImpactScore, na.rm = TRUE)
if (sis_sd > 0) dt[, ShapeImpactScore := (ShapeImpactScore - sis_mean) / sis_sd]

cat(sprintf("[target] ShapeImpactScore — mean: %.3f  sd: %.3f\n", mean(dt$ShapeImpactScore, na.rm = TRUE), sd(dt$ShapeImpactScore, na.rm = TRUE)))


## ----define-features-------------------------------------------------------------------
candidate_cols <- c(
  "avg_velo_mph", "global_velo_z", 
  "avg_ivb_in", "avg_hb_in",
  "avg_ext_ft", "avg_rel_height_ft", "avg_rel_side_ft",
  "movement_mag", "ivb_abs", "hb_abs",
  "max_fb_velo", "fb_velo_pct_max", "velo_pct_max", "velo_reserve",
  "velo_diff", "ivb_diff", "hb_diff", "spin_diff", "movement_diff",
  grep("^pt_", names(dt), value = TRUE),
  "hand_L"
)

candidate_cols <- intersect(candidate_cols, names(dt))

# Fill remaining NAs in features with 0
for (col in candidate_cols) dt[is.na(get(col)), (col) := 0]

# Prune highly correlated features (|r| > 0.95) to reduce redundancy
cor_mat <- cor(as.matrix(dt[, ..candidate_cols]), use = "pairwise.complete.obs")
drop_cols <- character(0)
for (i in seq_len(ncol(cor_mat) - 1)) {
  for (j in (i + 1):ncol(cor_mat)) {
    if (!is.na(cor_mat[i, j]) && abs(cor_mat[i, j]) > 0.95) {
      drop_cols <- c(drop_cols, colnames(cor_mat)[j])
    }
  }
}
drop_cols <- unique(drop_cols)

# Force-protect velocity features from being pruned
protected_cols <- c("avg_velo_mph", "global_velo_z", "max_fb_velo", "fb_velo_pct_max", "velo_reserve")

# Ensure protected columns actually make it into the final feature list
feature_cols <- setdiff(union(candidate_cols, protected_cols), setdiff(drop_cols, protected_cols))

if (length(drop_cols) > 0) {
  cat(sprintf("[model] Dropping %d correlated features: %s\n",
              length(drop_cols), paste(drop_cols, collapse = ", ")))
}

cat(sprintf("[model] Using %d features (pruned from %d candidates)\n",
            length(feature_cols), length(candidate_cols)))


## ----cv-tuning-------------------------------------------------------------------------
set.seed(42)

X_all <- as.matrix(dt[, ..feature_cols])
y_all <- dt$ShapeImpactScore
dall  <- xgb.DMatrix(data = X_all, label = y_all)

# Regularized params — tuned for small datasets
params_cv <- list(
  objective        = "reg:squarederror",
  eta              = 0.02,
  max_depth        = 3,           # Increased to capture Velo x Max interactions
  min_child_weight = 5,           # Lowered to let specific high-velo outliers pop
  subsample        = 0.80,
  colsample_bytree = 0.8,
  lambda           = 2.0,         # Lowered to let the "Stuff" peaks stand out
  alpha            = 1.0,
  gamma            = 1.0,
  eval_metric      = "rmse"
)

cv_result <- xgb.cv(
  params  = params_cv,
  data    = dall,
  nrounds = 500,
  nfold   = 5,
  early_stopping_rounds = 30,
  verbose = 0,
  seed    = 42
)

best_nrounds <- cv_result$best_iteration
if (is.null(best_nrounds)) best_nrounds <- nrow(cv_result$evaluation_log)

cv_train_rmse <- cv_result$evaluation_log$train_rmse_mean[best_nrounds]
cv_test_rmse  <- cv_result$evaluation_log$test_rmse_mean[best_nrounds]

cat(sprintf("[cv] Best nrounds: %d\n", best_nrounds))
cat(sprintf("[cv] 5-Fold CV  — Train RMSE: %.4f  |  Test RMSE: %.4f\n",
            cv_train_rmse, cv_test_rmse))
cat(sprintf("[cv] Overfit ratio: %.2fx\n", cv_test_rmse / cv_train_rmse))


## ----train-xgb-------------------------------------------------------------------------
set.seed(42)
split    <- initial_split(dt, prop = 0.80)
train_dt <- training(split)
test_dt  <- testing(split)

cat(sprintf("[model] Train: %d  |  Test: %d\n", nrow(train_dt), nrow(test_dt)))

X_train <- as.matrix(train_dt[, ..feature_cols])
y_train <- train_dt$ShapeImpactScore
X_test  <- as.matrix(test_dt[, ..feature_cols])
y_test  <- test_dt$ShapeImpactScore

dtrain <- xgb.DMatrix(data = X_train, label = y_train)
dtest  <- xgb.DMatrix(data = X_test,  label = y_test)

# Use the same regularized params with CV-selected nrounds
model <- xgb.train(
  params    = params_cv,
  data      = dtrain,
  nrounds   = best_nrounds,
  watchlist = list(train = dtrain, test = dtest),
  verbose   = 0
)

best_iter <- best_nrounds

pred_train <- predict(model, dtrain)
pred_test  <- predict(model, dtest)
rmse_train <- sqrt(mean((pred_train - y_train)^2))
rmse_test  <- sqrt(mean((pred_test  - y_test)^2))

cat(sprintf("[model] Holdout — RMSE train: %.4f  |  RMSE test: %.4f\n", rmse_train, rmse_test))
cat(sprintf("[model] Overfit ratio: %.2fx (target < 3x)\n", rmse_test / rmse_train))

# Feature importance
importance <- xgb.importance(feature_names = feature_cols, model = model)

# Save model
model_path <- file.path(OUTPUT_DIR, "stuff_plus_xgb.model")
xgb.save(model, model_path)
cat(sprintf("[model] Saved: %s\n", model_path))


## ----calibration-----------------------------------------------------------------------
X_full <- as.matrix(dt[, ..feature_cols])
dfull  <- xgb.DMatrix(data = X_full)

dt[, StuffRaw := predict(model, dfull)]

mean_pred <- mean(dt$StuffRaw, na.rm = TRUE)
sd_pred   <- sd(dt$StuffRaw, na.rm = TRUE)

if (sd_pred == 0) {
  warning("[calibrate] sd_pred is 0; defaulting StuffPlus to 100")
  dt[, StuffPlus := 100]
  dt[, StuffZ := 0]
} else {
  dt[, StuffPlus := round(100 + 10 * (StuffRaw - mean_pred) / sd_pred, 1)]
  dt[, StuffZ    := round((StuffRaw - mean_pred) / sd_pred, 3)]
}

cat(sprintf("[calibrate] StuffPlus NAs: %d\n", sum(is.na(dt$StuffPlus))))
cat(sprintf("[calibrate] StuffPlus — mean: %.1f  sd: %.1f  min: %.1f  max: %.1f\n",
            mean(dt$StuffPlus), sd(dt$StuffPlus), min(dt$StuffPlus), max(dt$StuffPlus)))


## ----export-outings--------------------------------------------------------------------
export_cols <- c(
  "session_key", "player_id", "player_name", "date", "pitch_type", "throws",
  "StuffPlus", "StuffRaw", "StuffZ",
  "avg_velo_mph", "avg_ivb_in", "avg_hb_in", "avg_spin_rpm",
  "avg_ext_ft", "avg_rel_height_ft", "avg_rel_side_ft",
  "movement_mag", "ivb_abs", "hb_abs",
  "max_fb_velo", "fb_velo_pct_max", "velo_pct_max",
  "fb_velo", "fb_ivb", "fb_hb", "fb_spin",
  "velo_diff", "ivb_diff", "hb_diff", "spin_diff", "movement_diff"
)
export_cols <- intersect(export_cols, names(dt))
out1 <- dt[, ..export_cols]
fwrite(out1, file.path(OUTPUT_DIR, "stuff_plus_pitchtype_outings.csv"))
cat(sprintf("[export] stuff_plus_pitchtype_outings.csv — %d rows\n", nrow(out1)))


## ----export-outing-summary-------------------------------------------------------------
fb_stuff <- dt[grepl("fastball|four", pitch_type, ignore.case = TRUE),
               .(fastball_StuffPlus = round(mean(StuffPlus, na.rm = TRUE), 1)),
               by = .(player_id, date)]

outing_summary <- dt[, .(
  player_name    = first(player_name),
  throws         = first(throws),
  n_pitch_types  = .N,
  mean_StuffPlus = round(mean(StuffPlus, na.rm = TRUE), 1),
  max_StuffPlus  = round(max(StuffPlus, na.rm = TRUE), 1),
  arsenal_std    = round(sd(StuffPlus, na.rm = TRUE), 2),
  arsenal_range  = round(max(StuffPlus, na.rm = TRUE) - min(StuffPlus, na.rm = TRUE), 1)
), by = .(player_id, session_key, date)]

outing_summary <- merge(outing_summary, fb_stuff, by = c("player_id", "date"), all.x = TRUE)
outing_summary[, fastball_StuffPlus := round(fastball_StuffPlus, 1)]

fwrite(outing_summary, file.path(OUTPUT_DIR, "stuff_plus_outing_summary.csv"))
cat(sprintf("[export] stuff_plus_outing_summary.csv — %d rows\n", nrow(outing_summary)))


## ----export-arsenal--------------------------------------------------------------------
## 8.3 — Pitcher Arsenal

# Function to drop the worst outing if they have 3+ tracked sessions
opt_mean <- function(x) {
  x <- na.omit(x)
  if (length(x) >= 3) {
    # Sort descending and drop the last (lowest) value
    return(mean(sort(x, decreasing = TRUE)[1:(length(x)-1)]))
  }
  return(mean(x))
}

arsenal <- dt[, .(
  player_name    = first(player_name),
  throws         = first(throws),
  mean_StuffPlus = round(opt_mean(StuffPlus), 1),        # <-- Optimized Mean applied here
  sd_StuffPlus   = round(sd(StuffPlus, na.rm = TRUE), 2),
  avg_velo_mph   = round(mean(avg_velo_mph, na.rm = TRUE), 1),
  max_fb_velo    = round(max(max_fb_velo, na.rm = TRUE), 1),
  avg_ext_ft     = round(mean(avg_ext_ft, na.rm = TRUE), 2),
  n_sessions     = uniqueN(date)
), by = .(player_id, pitch_type)]

# Sort the final file by Player Name, then highest Stuff+
setorder(arsenal, player_name, -mean_StuffPlus)

fwrite(arsenal, file.path(OUTPUT_DIR, "stuff_plus_pitcher_arsenal.csv"))
cat(sprintf("[export] stuff_plus_pitcher_arsenal.csv — %d rows\n", nrow(arsenal)))


## ----export-importance-----------------------------------------------------------------
fwrite(importance, file.path(OUTPUT_DIR, "feature_importance.csv"))
cat(sprintf("[export] feature_importance.csv — %d features\n", nrow(importance)))


## ----validation------------------------------------------------------------------------
cat("═══════════════════════════════════════════════════════════════\n")
cat("  VALIDATION SUMMARY\n")
cat("═══════════════════════════════════════════════════════════════\n")
cat(sprintf("  Total rows read:           %d\n", n_total))
cat(sprintf("  OTHER pitches removed:     %d\n", n_other_removed))
cat(sprintf("  Rows after cleaning:       %d\n", nrow(dt)))
cat(sprintf("  StuffPlus NA count:        %d  (must be 0)\n", sum(is.na(dt$StuffPlus))))
cat(sprintf("  Number of features:        %d\n", length(feature_cols)))
cat("───────────────────────────────────────────────────────────────\n")
cat(sprintf("  5-Fold CV RMSE (train):    %.4f\n", cv_train_rmse))
cat(sprintf("  5-Fold CV RMSE (test):     %.4f\n", cv_test_rmse))
cat(sprintf("  CV-selected nrounds:       %d\n", best_nrounds))
cat("───────────────────────────────────────────────────────────────\n")
cat(sprintf("  Holdout RMSE (train):      %.4f\n", rmse_train))
cat(sprintf("  Holdout RMSE (test):       %.4f\n", rmse_test))
cat(sprintf("  Overfit ratio:             %.2fx\n", rmse_test / rmse_train))
cat("───────────────────────────────────────────────────────────────\n")
cat(sprintf("  Model saved:               %s\n", model_path))
cat(sprintf("  Exports saved:             %s/\n", OUTPUT_DIR))
cat("═══════════════════════════════════════════════════════════════\n")
cat("  Pipeline complete.\n")
cat("═══════════════════════════════════════════════════════════════\n")

