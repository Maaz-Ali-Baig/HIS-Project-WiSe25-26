#' Data Encoding for Categorical Variables
#'
#' @param input_csv Path to input CSV file
#' @param output_csv Path to output CSV file
#' @param columns Vector of column names to apply encoding to (categorical columns)
#' @param method Encoding method: "label", "onehot", "ordinal", "frequency", "target"
#' @param target_columns Vector of target column names (only for target encoding)
#'
#' @return Data frame with encoded columns and writes to output_csv
#'
#' @examples
#' \dontrun{
#' # Label encoding
#' encode_data_csv("data.csv", "output.csv", c("category", "status"), "label")
#'
#' # One-hot encoding
#' encode_data_csv("data.csv", "output.csv", c("color"), "onehot")
#'
#' # Target encoding
#' encode_data_csv("data.csv", "output.csv", c("category"), "target", target_columns = c("price"))
#' }
encode_data_csv <- function(
    input_csv,
    output_csv,
    columns = NULL,
    method = c("label", "onehot", "ordinal", "frequency", "target"),
    target_columns = NULL
) {
  method <- match.arg(method)

  # Load required libraries
  if (!requireNamespace("dplyr", quietly = TRUE)) {
    stop("Package 'dplyr' is required. Please run install.packages('dplyr')")
  }
  if (!requireNamespace("readr", quietly = TRUE)) {
    stop("Package 'readr' is required. Please run install.packages('readr')")
  }

  library(dplyr)
  library(readr)

  # Read CSV file
  if (!file.exists(input_csv)) {
    stop("Input CSV file does not exist: ", input_csv)
  }

  df <- tryCatch({
    read_csv(input_csv, show_col_types = FALSE)
  }, error = function(e) {
    stop(paste("Failed to read input CSV:", e$message))
  })

  # Detect categorical columns if not specified
  is_cat_col <- function(x) is.character(x) || is.factor(x)

  if (is.null(columns) || length(columns) == 0) {
    # Auto-detect all categorical columns
    cat_cols <- names(df)[sapply(df, is_cat_col)]
  } else {
    # Use specified columns (filter to those that exist)
    cat_cols <- columns[columns %in% names(df)]

    if (length(cat_cols) == 0) {
      stop("No valid columns provided. Available columns: ", paste(names(df), collapse = ", "))
    }
  }

  # Helper functions for encoding (modified to accept cat_cols parameter)

  # Label Encoding
  label_encode <- function(df, cat_cols) {
    for (col in cat_cols) {
      df[[paste0(col, "_label")]] <- as.integer(as.factor(df[[col]]))
    }
    df
  }

  # One-Hot Encoding
  onehot_encode <- function(df, cat_cols) {
    MAX_ONEHOT_LEVELS <- 50  # limit to prevent exploding columns

    for (col in cat_cols) {
      unique_levels <- length(unique(df[[col]]))

      # Skip unsafe columns
      if (unique_levels > MAX_ONEHOT_LEVELS) {
        warning(paste("Skipping", col, "because it has", unique_levels,
                "unique values (> 50). Too large for one-hot encoding."))
        next
      }

      # Safe factor conversion
      df[[col]] <- as.factor(df[[col]])

      # Safe formula (handles spaces / symbols)
      f <- as.formula(paste0("~ `", col, "` - 1"))

      mm <- model.matrix(f, data = df, na.action = na.pass)
      mm_df <- as.data.frame(mm)

      # Safe names
      names(mm_df) <- make.names(names(mm_df), unique = TRUE)

      df <- dplyr::bind_cols(df, mm_df)
    }

    df
  }

  # Ordinal Encoding
  ordinal_encode <- function(df, cat_cols) {
    for (col in cat_cols) {
      levs <- sort(unique(df[[col]]))
      mapping <- setNames(seq_along(levs), levs)
      df[[paste0(col, "_ord")]] <- mapping[as.character(df[[col]])]
    }
    df
  }

  # Frequency Encoding
  frequency_encode <- function(df, cat_cols) {
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

  # Target Encoding
  target_encode_all <- function(df, cat_cols, target_cols) {
    if (is.null(target_cols) || length(target_cols) == 0) {
      stop("Target encoding requested but no target columns provided")
    }

    for (target_col in target_cols) {
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
    }

    df
  }

  # Apply encoding based on method
  encoded_df <- tryCatch({
    if (method == "label") {
      label_encode(df, cat_cols)
    } else if (method == "onehot") {
      onehot_encode(df, cat_cols)
    } else if (method == "ordinal") {
      ordinal_encode(df, cat_cols)
    } else if (method == "frequency") {
      frequency_encode(df, cat_cols)
    } else if (method == "target") {
      target_encode_all(df, cat_cols, target_columns)
    } else {
      stop(paste("Unknown encoding method:", method))
    }
  }, error = function(e) {
    stop(paste("Encoding failed:", e$message))
  })

  # Write output
  tryCatch({
    write_csv(encoded_df, output_csv)
  }, error = function(e) {
    stop(paste("Failed to write output CSV:", e$message))
  })

  # Print summary
  cat("Encoding completed successfully!\n")
  cat("Input file:", input_csv, "\n")
  cat("Output file:", output_csv, "\n")
  cat("Method:", method, "\n")
  cat("Columns encoded:", paste(cat_cols, collapse = ", "), "\n")
  new_cols <- setdiff(names(encoded_df), names(df))
  if (length(new_cols) > 0) {
    cat("New columns created:\n")
    cat(paste("  -", new_cols, collapse = "\n"), "\n")
  }

  invisible(encoded_df)
}
