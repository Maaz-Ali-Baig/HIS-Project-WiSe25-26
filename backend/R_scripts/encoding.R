#' Data Encoding for Categorical Variables
#'
#' @param input_csv Path to input CSV file
#' @param output_csv Path to output CSV file
#' @param columns Vector of column names to apply encoding to (categorical columns)
#' @param method Encoding method: "label", "onehot", "ordinal", "frequency", "target"
#' @param target_columns Vector of target column names (only for target encoding)
#' @param detect_numeric_categorical If TRUE, auto-detect low-cardinality numeric columns as categorical (default: TRUE)
#' @param max_numeric_categories Maximum unique values for numeric column to be treated as categorical (default: 20)
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

#' Comprehensive missing value detection
#' Detects various representations of missing values
is_missing_value <- function(x) {
  if (is.null(x)) return(TRUE)
  if (length(x) == 0) return(TRUE)
  if (is.na(x)) return(TRUE)
  
  # For character/factor values, check common missing tokens
  if (is.character(x) || is.factor(x)) {
    x_lower <- tolower(trimws(as.character(x)))
    missing_tokens <- c("", "na", "n/a", "nan", "none", "null", "nil", 
                        "#n/a", "#na", "missing", "n.a.", "<na>", "<null>",
                        "undefined", "n.a", "--", ".", "?")
    return(x_lower %in% missing_tokens)
  }
  
  return(FALSE)
}

encode_data_csv <- function(
    input_csv,
    output_csv,
    columns = NULL,
    method = c("label", "onehot", "ordinal", "frequency", "target"),
    target_columns = NULL,
    detect_numeric_categorical = TRUE,
    max_numeric_categories = 20
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
  is_cat_col <- function(x) {
    # Traditional categorical
    if (is.character(x) || is.factor(x)) return(TRUE)
    
    # Low-cardinality numeric (e.g., ratings stored as floats)
    if (detect_numeric_categorical && is.numeric(x)) {
      unique_vals <- unique(x[!is.na(x)])
      if (length(unique_vals) <= max_numeric_categories && length(unique_vals) >= 2) {
        return(TRUE)
      }
    }
    
    return(FALSE)
  }

  if (is.null(columns) || length(columns) == 0) {
    # Auto-detect all categorical columns (including low-cardinality numeric)
    cat_cols <- names(df)[sapply(df, is_cat_col)]
    
    # Warn about numeric columns being treated as categorical
    numeric_cats <- names(df)[sapply(df, function(x) is.numeric(x) && is_cat_col(x))]
    if (length(numeric_cats) > 0) {
      message("Note: Treating low-cardinality numeric columns as categorical: ", 
              paste(numeric_cats, collapse = ", "))
    }
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
      # Convert to character for consistent handling
      col_data <- as.character(df[[col]])
      
      # Mark missing values
      is_missing <- sapply(col_data, is_missing_value)
      
      # Create factor only from non-missing values
      non_missing <- col_data[!is_missing]
      if (length(non_missing) > 0) {
        # Create factor levels from non-missing values
        factor_levels <- sort(unique(non_missing))
        encoded <- as.integer(factor(col_data, levels = factor_levels))
      } else {
        encoded <- rep(NA_integer_, length(col_data))
      }
      
      df[[paste0(col, "_label")]] <- encoded
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

      is_numeric_target <- is.numeric(df[[target_col]])

      # Loop over categorical columns
      for (col in cat_cols) {
        # Convert to character for consistent grouping
        col_char <- as.character(df[[col]])
        
        if (is_numeric_target) {
          # Numeric target: compute mean
          means <- df %>%
            mutate(cat_col = col_char) %>%
            group_by(cat_col) %>%
            summarize(encoded_value = mean(.data[[target_col]], na.rm = TRUE),
                      .groups = "drop")
          
          lookup <- setNames(means$encoded_value, means$cat_col)
          global_fallback <- mean(df[[target_col]], na.rm = TRUE)
        } else {
          # Categorical target: compute mode (most frequent value)
          mode_func <- function(x) {
            x_clean <- x[!is.na(x)]
            if (length(x_clean) == 0) return(NA)
            ux <- unique(x_clean)
            ux[which.max(tabulate(match(x_clean, ux)))]
          }
          
          modes <- df %>%
            mutate(cat_col = col_char) %>%
            group_by(cat_col) %>%
            summarize(encoded_value = mode_func(.data[[target_col]]),
                      .groups = "drop")
          
          lookup <- setNames(modes$encoded_value, modes$cat_col)
          global_fallback <- mode_func(df[[target_col]])
        }

        new_col <- paste0(col, "_target_", target_col)
        df[[new_col]] <- lookup[col_char]

        # Replace NA values with global fallback
        df[[new_col]][is.na(df[[new_col]])] <- global_fallback
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
  cat("\n", rep("=", 60), "\n", sep = "")
  cat("ENCODING COMPLETED SUCCESSFULLY!\n")
  cat(rep("=", 60), "\n")
  cat("Input file:", input_csv, "\n")
  cat("Output file:", output_csv, "\n")
  cat("Method:", method, "\n")
  cat("Columns encoded:", paste(cat_cols, collapse = ", "), "\n")
  
  # Check which were numeric
  numeric_cats <- cat_cols[sapply(df[cat_cols], is.numeric)]
  if (length(numeric_cats) > 0) {
    cat("  (including numeric rating columns:", paste(numeric_cats, collapse = ", "), ")\n")
  }
  
  new_cols <- setdiff(names(encoded_df), names(df))
  if (length(new_cols) > 0) {
    cat("\nNew columns created (originals preserved):\n")
    cat(paste("  -", new_cols, collapse = "\n"), "\n")
  }
  cat("\nOriginal columns retained: YES\n")
  cat(rep("=", 60), "\n\n")

  invisible(encoded_df)
}
