#' Data Encoding for Categorical Variables (Optimized with data.table)
#'
#' @param input_csv Path to input CSV file
#' @param output_csv Path to output CSV file
#' @param columns Vector of column names to apply encoding to (categorical columns)
#' @param method Encoding method: "label", "onehot", "ordinal", "frequency", "target"
#' @param target_columns Vector of target column names (only for target encoding)
#' @param threads Number of threads for data.table (0 = all available cores, default)
#' @param verbose Print timing and performance information (default: FALSE)
#'
#' @return Data frame with encoded columns and writes to output_csv
#'
#' @examples
#' \dontrun{
#' # Label encoding with all CPU cores
#' encode_data_csv("data.csv", "output.csv", c("category", "status"), "label")
#'
#' # One-hot encoding with 4 threads
#' encode_data_csv("data.csv", "output.csv", c("color"), "onehot", threads = 4)
#'
#' # Target encoding with verbose output
#' encode_data_csv("data.csv", "output.csv", c("category"), "target",
#'                 target_columns = c("price"), verbose = TRUE)
#' }
encode_data_csv <- function(
    input_csv,
    output_csv,
    columns = NULL,
    method = c("label", "onehot", "ordinal", "frequency", "target"),
    target_columns = NULL,
    threads = 0,
    verbose = FALSE
) {
  method <- match.arg(method)

  # Load required libraries
  if (!requireNamespace("data.table", quietly = TRUE)) {
    stop("Package 'data.table' is required. Please run install.packages('data.table')")
  }

  library(data.table)

  # OPTIMIZATION: Configure threading for parallel processing
  old_threads <- getDTthreads()
  on.exit(setDTthreads(old_threads), add = TRUE)
  setDTthreads(threads)

  if (verbose) {
    cat("Using", getDTthreads(), "threads for data.table operations\n")
    start_time <- Sys.time()
  }

  # OPTIMIZATION: Read CSV file with fread (5-10x faster than read_csv)
  if (!file.exists(input_csv)) {
    stop("Input CSV file does not exist: ", input_csv)
  }

  dt <- tryCatch({
    fread(input_csv, data.table = TRUE)
  }, error = function(e) {
    stop(paste("Failed to read input CSV:", e$message))
  })

  if (verbose) {
    cat("File read completed in", round(difftime(Sys.time(), start_time, units = "secs"), 2), "seconds\n")
    cat("Dimensions:", nrow(dt), "rows x", ncol(dt), "columns\n")
  }

  # Detect categorical columns if not specified
  # OPTIMIZATION: Vectorized type checking
  is_cat_col <- function(x) is.character(x) || is.factor(x)

  if (is.null(columns) || length(columns) == 0) {
    # Auto-detect all categorical columns using vectorized sapply
    cat_cols <- names(dt)[sapply(dt, is_cat_col)]
  } else {
    # Use specified columns (filter to those that exist)
    cat_cols <- columns[columns %chin% names(dt)]  # OPTIMIZATION: %chin% for character vectors

    if (length(cat_cols) == 0) {
      stop("No valid columns provided. Available columns: ", paste(names(dt), collapse = ", "))
    }
  }

  # Helper functions for encoding (optimized with data.table)

  # OPTIMIZATION: Label Encoding - vectorized with .SD and lapply
  label_encode <- function(dt, cat_cols) {
    if (verbose) encode_start <- Sys.time()

    # Create new column names
    new_cols <- paste0(cat_cols, "_label")

    # OPTIMIZATION: Use .SD with lapply to process all columns at once
    # In-place modification with := avoids copying
    dt[, (new_cols) := lapply(.SD, function(x) as.integer(factor(x))), .SDcols = cat_cols]

    if (verbose) {
      cat("Label encoding completed in",
          round(difftime(Sys.time(), encode_start, units = "secs"), 2), "seconds\n")
    }

    dt
  }

  # OPTIMIZATION: One-Hot Encoding - vectorized operations
  onehot_encode <- function(dt, cat_cols) {
    if (verbose) encode_start <- Sys.time()

    MAX_ONEHOT_LEVELS <- 50  # limit to prevent exploding columns

    for (col in cat_cols) {
      # OPTIMIZATION: Use uniqueN for fast unique count (GForce optimized)
      unique_levels <- uniqueN(dt[[col]])

      # Skip unsafe columns
      if (unique_levels > MAX_ONEHOT_LEVELS) {
        warning(paste("Skipping", col, "because it has", unique_levels,
                      "unique values (> 50). Too large for one-hot encoding."))
        next
      }

      # OPTIMIZATION: Get unique values efficiently
      levs <- unique(dt[[col]])
      levs <- levs[!is.na(levs)]

      # OPTIMIZATION: Vectorized one-hot encoding with := for in-place modification
      for (lev in levs) {
        safe_name <- make.names(paste0(col, "_", lev))
        # Use fifelse for type-safe, fast conditional (10x faster than ifelse)
        dt[, (safe_name) := fifelse(get(col) == lev, 1L, 0L)]
      }
    }

    if (verbose) {
      cat("One-hot encoding completed in",
          round(difftime(Sys.time(), encode_start, units = "secs"), 2), "seconds\n")
    }

    dt
  }

  # OPTIMIZATION: Ordinal Encoding - eliminated loop with vectorized named vector lookup
  ordinal_encode <- function(dt, cat_cols) {
    if (verbose) encode_start <- Sys.time()

    # Create new column names
    new_cols <- paste0(cat_cols, "_ord")

    # OPTIMIZATION: Vectorized approach using lapply with .SD
    dt[, (new_cols) := lapply(.SD, function(x) {
      levs <- sort(unique(x))
      # OPTIMIZATION: Named vector for O(1) lookup instead of iterative matching
      mapping <- setNames(seq_along(levs), levs)
      mapping[as.character(x)]
    }), .SDcols = cat_cols]

    if (verbose) {
      cat("Ordinal encoding completed in",
          round(difftime(Sys.time(), encode_start, units = "secs"), 2), "seconds\n")
    }

    dt
  }

  # OPTIMIZATION: Frequency Encoding - use data.table's .N for fast counting
  frequency_encode <- function(dt, cat_cols) {
    if (verbose) encode_start <- Sys.time()

    for (col in cat_cols) {
      # OPTIMIZATION: Use data.table's group-by with .N (GForce optimized, much faster than table())
      freq_table <- dt[, .N, by = col]
      setnames(freq_table, c("value", "count"))

      # OPTIMIZATION: Named vector for O(1) lookup
      map <- setNames(freq_table$count, as.character(freq_table$value))

      new_col <- paste0(col, "_freq")
      # OPTIMIZATION: In-place modification with := and fifelse for NA handling
      dt[, (new_col) := map[as.character(get(col))]]
      dt[is.na(get(new_col)), (new_col) := 0L]
    }

    if (verbose) {
      cat("Frequency encoding completed in",
          round(difftime(Sys.time(), encode_start, units = "secs"), 2), "seconds\n")
    }

    dt
  }

  # OPTIMIZATION: Target Encoding - use data.table's group-by aggregation
  target_encode_all <- function(dt, cat_cols, target_cols) {
    if (verbose) encode_start <- Sys.time()

    if (is.null(target_cols) || length(target_cols) == 0) {
      stop("Target encoding requested but no target columns provided")
    }

    for (target_col in target_cols) {
      if (!(target_col %chin% names(dt))) {  # OPTIMIZATION: %chin% for character membership
        stop(paste("Target column", target_col, "not found in dataframe"))
      }

      # OPTIMIZATION: Calculate global mean once (GForce optimized)
      global_mean <- dt[, mean(get(target_col), na.rm = TRUE)]

      # Loop over categorical columns
      for (col in cat_cols) {
        # OPTIMIZATION: Use data.table's group-by with mean() (GForce optimized)
        means <- dt[, .(mean_target = mean(get(target_col), na.rm = TRUE)), by = col]

        # OPTIMIZATION: Named vector for O(1) lookup
        lookup <- setNames(means$mean_target, as.character(means[[col]]))

        new_col <- paste0(col, "_target_", target_col)

        # OPTIMIZATION: In-place modification with := and fcoalesce for NA handling
        dt[, (new_col) := lookup[as.character(get(col))]]
        # Replace NA values with global target mean using fifelse
        dt[, (new_col) := fifelse(is.na(get(new_col)), global_mean, get(new_col))]
      }
    }

    if (verbose) {
      cat("Target encoding completed in",
          round(difftime(Sys.time(), encode_start, units = "secs"), 2), "seconds\n")
    }

    dt
  }

  # Apply encoding based on method
  encoded_dt <- tryCatch({
    if (method == "label") {
      label_encode(dt, cat_cols)
    } else if (method == "onehot") {
      onehot_encode(dt, cat_cols)
    } else if (method == "ordinal") {
      ordinal_encode(dt, cat_cols)
    } else if (method == "frequency") {
      frequency_encode(dt, cat_cols)
    } else if (method == "target") {
      target_encode_all(dt, cat_cols, target_columns)
    } else {
      stop(paste("Unknown encoding method:", method))
    }
  }, error = function(e) {
    stop(paste("Encoding failed:", e$message))
  })

  # OPTIMIZATION: Write output with fwrite (much faster than write_csv)
  if (verbose) write_start <- Sys.time()

  tryCatch({
    fwrite(encoded_dt, output_csv)
  }, error = function(e) {
    stop(paste("Failed to write output CSV:", e$message))
  })

  if (verbose) {
    cat("File write completed in",
        round(difftime(Sys.time(), write_start, units = "secs"), 2), "seconds\n")
  }

  # Print summary
  cat("Encoding completed successfully!\n")
  cat("Input file:", input_csv, "\n")
  cat("Output file:", output_csv, "\n")
  cat("Method:", method, "\n")
  cat("Columns encoded:", paste(cat_cols, collapse = ", "), "\n")

  # Get original column names for comparison
  orig_cols <- names(dt)[names(dt) %chin% names(dt)[1:length(names(dt))]]
  new_cols <- setdiff(names(encoded_dt), orig_cols)

  if (length(new_cols) > 0) {
    cat("New columns created:\n")
    cat(paste("  -", new_cols, collapse = "\n"), "\n")
  }

  if (verbose) {
    total_time <- difftime(Sys.time(), start_time, units = "secs")
    cat("\nTotal execution time:", round(total_time, 2), "seconds\n")
    cat("Throughput:", round(nrow(encoded_dt) / as.numeric(total_time), 0), "rows/second\n")
  }

  invisible(as.data.frame(encoded_dt))
}
