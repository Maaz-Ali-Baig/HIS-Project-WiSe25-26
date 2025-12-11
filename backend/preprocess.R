#!/usr/bin/env Rscript
# backend/preprocess.R

args <- commandArgs(trailingOnly = TRUE)

if (length(args) < 3) {
  stop("Usage: Rscript preprocess.R <input.csv> <output.csv> <encoding> [targetColumns]")
}

input_path   <- args[[1]]
output_path  <- args[[2]]
encoding     <- tolower(args[[3]])
target_cols  <- if (length(args) >= 4) strsplit(args[[4]], ",")[[1]] else NULL

cat("R INPUT  :", input_path, "\n")
cat("R OUTPUT :", output_path, "\n")
cat("R ENCODING:", encoding, "\n")
cat("R TARGET COLS:", paste(target_cols, collapse = ", "), "\n")

library(dplyr)
library(readr)

# Load input CSV safely
df <- tryCatch({
  read_csv(input_path, show_col_types = FALSE)
}, error = function(e) {
  stop(paste("Failed to read input CSV:", e$message))
})

# Detect categorical columns
is_cat_col <- function(x) is.character(x) || is.factor(x)
cat_cols <- names(df)[sapply(df, is_cat_col)]

# === ENCODING IMPLEMENTATIONS ===================================

label_encode <- function(df) {
  for (col in cat_cols) {
    df[[paste0(col, "_label")]] <- as.integer(as.factor(df[[col]]))
  }
  df
}

onehot_encode <- function(df) {
  cat("Running One-Hot Encoding...\n")

  cat_cols <- names(df)[sapply(df, function(x) is.character(x) || is.factor(x))]
  cat("Categorical columns detected:", paste(cat_cols, collapse=", "), "\n")

  MAX_ONEHOT_LEVELS <- 50  # limit to prevent exploding columns

  for (col in cat_cols) {
    unique_levels <- length(unique(df[[col]]))

    cat("Processing column:", col, " | unique values:", unique_levels, "\n")

    # skip unsafe columns
    if (unique_levels > MAX_ONEHOT_LEVELS) {
      cat("⚠️ Skipping", col, "because it has", unique_levels,
          "unique values (> 50). Too large for one-hot encoding.\n")
      next
    }

    # Safe factor conversion
    df[[col]] <- as.factor(df[[col]])

    # Safe formula (handles spaces / symbols)
    f <- as.formula(paste0("~ `", col, "` - 1"))

    mm <- model.matrix(f, data = df, na.action = na.pass)
    mm_df <- as.data.frame(mm)

    # safe names
    names(mm_df) <- make.names(names(mm_df), unique = TRUE)

    df <- dplyr::bind_cols(df, mm_df)
  }

  cat("One-hot encoding completed successfully.\n")
  return(df)
}




ordinal_encode <- function(df) {
  for (col in cat_cols) {
    levs <- sort(unique(df[[col]]))
    mapping <- setNames(seq_along(levs), levs)
    df[[paste0(col, "_ord")]] <- mapping[as.character(df[[col]])]
  }
  df
}

frequency_encode <- function(df) {
  for (col in cat_cols) {
    tbl <- as.data.frame(table(df[[col]]), stringsAsFactors = FALSE)
    names(tbl) <- c("value", "count")
    map <- setNames(tbl$count, tbl$value)

    new_col <- paste0(col, "_freq")
    df[[new_col]] <- map[as.character(df[[col]])]
    df[[new_col]][is.na(df[[new_col]])] <- 0
  }
  df
}

# === TARGET ENCODING ============================================

target_encode_column <- function(df, target_col) {

  if (!(target_col %in% names(df))) {
    stop(paste("Target column", target_col, "not found in dataframe"))
  }

  # Loop over categorical columns
  for (col in cat_cols) {

    means <- df %>%
      group_by(.data[[col]]) %>%
      summarize(mean_target = mean(.data[[target_col]], na.rm = TRUE),
                .groups = "drop")

    lookup <- setNames(means$mean_target, as.character(means[[col]]))

    new_col <- paste0(col, "_target_", target_col)

    df[[new_col]] <- lookup[as.character(df[[col]])]

    # Replace NA values with global target mean
    global_mean <- mean(df[[target_col]], na.rm = TRUE)
    df[[new_col]][is.na(df[[new_col]])] <- global_mean
  }

  df
}

# === SELECT AND EXECUTE ENCODING ================================

encoded_df <- tryCatch({

  if (encoding == "label") {
    label_encode(df)

  } else if (encoding == "onehot") {
    onehot_encode(df)
   

  } else if (encoding == "ordinal") {
    ordinal_encode(df)

  } else if (encoding == "frequency") {
    frequency_encode(df)

  } else if (encoding == "target") {

    if (is.null(target_cols) || length(target_cols) == 0) {
      stop("Target encoding requested but no targetColumns provided")
    }

    for (tcol in target_cols) {
      df <- target_encode_column(df, tcol)
    }

    df

  } else {
    stop(paste("Unknown encoding:", encoding))
  }

}, error = function(e) {
  stop(paste("Encoding failed:", e$message))
})

# === WRITE OUTPUT ===============================================

tryCatch({
  write_csv(encoded_df, output_path)
  cat("Successfully wrote encoded output to:", output_path, "\n")
}, error = function(e) {
  stop(paste("Failed to write output CSV:", e$message))
})
