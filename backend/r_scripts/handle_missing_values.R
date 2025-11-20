# Load required libraries
library(readr)
library(dplyr)

missing_value_handler_qual <- function(data, vars, method = c(
  "row_deletion",
  "mode",
  "missing_category",
  "model_based"
)) {
  method <- match.arg(method)
  df <- data
  
  is_missing <- function(x) {
    is.na(x) | x == "" | x == "NA" | x == "NULL"
  }
  
  # 1. Row Deletion
  if (method == "row_deletion") {
    missing_rows <- apply(df[vars], 1, function(row) any(is_missing(row)))
    rows_removed <- sum(missing_rows)
    cat(sprintf("[INFO] Removed %d rows with missing values\n", rows_removed))
    return(df[!missing_rows, ])
  }
  
  # 2. Mode Imputation
  if (method == "mode") {
    for (v in vars) {
      x <- df[[v]]
      mask <- is_missing(x)
      if (sum(mask) > 0) {
        mode_val <- names(which.max(table(x[!mask])))
        df[[v]][mask] <- mode_val
        cat(sprintf("[INFO] Imputed %d missing values in column '%s'\n", sum(mask), v))
      }
    }
    return(df)
  }
  
  # 3. Create Missing Category
  if (method == "missing_category") {
    for (v in vars) {
      x <- as.character(df[[v]])
      mask <- is_missing(x)
      x[mask] <- "Missing"
      df[[v]] <- factor(x)
      cat(sprintf("[INFO] Created 'Missing' category for column '%s' (%d values)\n", v, sum(mask)))
    }
    return(df)
  }
  
  # 4. Model-Based Imputation (MICE)
  if (method == "model_based") {
    if (!requireNamespace("mice", quietly = TRUE)) {
      stop("Package 'mice' required. Install: install.packages('mice')")
    }
    cat("[INFO] Running MICE imputation...\n")
    imputed <- mice::mice(df, m = 1, maxit = 5, method = "polyreg", print = FALSE)
    df <- mice::complete(imputed)
    cat("[INFO] MICE imputation completed\n")
    return(df)
  }
  
  return(df)
}

# ============================================================================
# COMMAND LINE EXECUTION
# ============================================================================

args <- commandArgs(trailingOnly = TRUE)

if (length(args) < 3) {
  cat("Usage: Rscript handle_missing_values.R <input_file> <output_file> <method> [variables]\n")
  quit(status = 1)
}

input_file <- args[1]
output_file <- args[2]
method <- args[3]
variables <- if (length(args) > 3) args[4:length(args)] else NULL

tryCatch({
  cat(sprintf("[START] Processing: %s\n", input_file))
  data <- read_csv(input_file, show_col_types = FALSE)
  cat(sprintf("[INFO] Loaded %d rows, %d columns\n", nrow(data), ncol(data)))
  
  # Use all columns if not specified
  vars <- if (is.null(variables)) names(data) else variables
  
  cleaned_data <- missing_value_handler_qual(data, vars, method = method)
  write_csv(cleaned_data, output_file)
  
  cat(sprintf("[SUCCESS] Output saved: %s (%d rows)\n", output_file, nrow(cleaned_data)))
  
}, error = function(e) {
  cat(sprintf("[ERROR] %s\n", e$message))
  quit(status = 1)
})