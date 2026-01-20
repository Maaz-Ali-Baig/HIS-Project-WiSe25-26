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
  use_data_table <- requireNamespace("data.table", quietly = TRUE)
  use_readr <- requireNamespace("readr", quietly = TRUE)
  if (!use_data_table && !use_readr) {
    stop("Package 'data.table' (preferred) or 'readr' is required.")
  }

  read_csv_fast <- function(path) {
    if (use_data_table) {
      fread_args <- list(input = path, data.table = TRUE, showProgress = FALSE)
      if ("check.names" %in% names(formals(data.table::fread))) {
        fread_args$check.names <- FALSE
      }
      return(do.call(data.table::fread, fread_args))
    }
    readr::read_csv(path, show_col_types = FALSE)
  }

  write_csv_fast <- function(df, path) {
    if (use_data_table) {
      data.table::fwrite(df, path)
    } else {
      readr::write_csv(df, path)
    }
  }

  # Read CSV file
  if (!file.exists(input_csv)) {
    stop("Input CSV file does not exist: ", input_csv)
  }

  df <- tryCatch({
    read_csv_fast(input_csv)
  }, error = function(e) {
    stop(paste("Failed to read input CSV:", e$message))
  })

  # Detect categorical columns if not specified
  is_cat_col <- function(x) is.character(x) || is.factor(x)

  if (is.null(columns) || length(columns) == 0) {
    # Auto-detect all categorical columns
    cat_cols <- names(df)[vapply(df, is_cat_col, logical(1))]
  } else {
    # Use specified columns (filter to those that exist)
    cat_cols <- columns[columns %in% names(df)]

    if (length(cat_cols) == 0) {
      stop("No valid columns provided. Available columns: ", paste(names(df), collapse = ", "))
    }
  }

  data_obj <- if (use_data_table) data.table::as.data.table(df) else df

  # Helper functions for encoding (modified to accept cat_cols parameter)

  # Label Encoding
  label_encode <- function(df, cat_cols) {
    for (col in cat_cols) {
      new_col <- paste0(col, "_label")
      if (use_data_table) {
        df[, (new_col) := as.integer(factor(get(col)))]
      } else {
        df[[new_col]] <- as.integer(factor(df[[col]]))
      }
    }
    df
  }

  # One-Hot Encoding
  onehot_encode <- function(df, cat_cols) {
    MAX_ONEHOT_LEVELS <- 50  # limit to prevent exploding columns
    mm_list <- list()

    for (col in cat_cols) {
      x <- df[[col]]
      unique_levels <- if (use_data_table) data.table::uniqueN(x) else length(unique(x))

      # Skip unsafe columns
      if (unique_levels > MAX_ONEHOT_LEVELS) {
        warning(paste("Skipping", col, "because it has", unique_levels,
                "unique values (> 50). Too large for one-hot encoding."))
        next
      }

      # Safe factor conversion
      if (use_data_table) {
        data.table::set(df, j = col, value = as.factor(x))
      } else {
        df[[col]] <- as.factor(x)
      }

      # Safe formula (handles spaces / symbols)
      f <- as.formula(paste0("~ `", col, "` - 1"))

      mm <- model.matrix(f, data = df, na.action = na.pass)
      mm_df <- as.data.frame(mm)

      # Safe names
      names(mm_df) <- make.names(names(mm_df), unique = TRUE)

      mm_list[[col]] <- mm_df
    }

    if (length(mm_list) > 0) {
      mm_all <- do.call(cbind, mm_list)
      if (use_data_table) {
        df <- data.table::as.data.table(cbind(df, mm_all))
      } else {
        df <- cbind(df, mm_all)
      }
    }

    df
  }

  # Ordinal Encoding
  ordinal_encode <- function(df, cat_cols) {
    for (col in cat_cols) {
      x_chr <- as.character(df[[col]])
      levs <- sort(unique(x_chr))
      mapping <- setNames(seq_along(levs), levs)
      new_col <- paste0(col, "_ord")
      if (use_data_table) {
        df[, (new_col) := unname(mapping[x_chr])]
      } else {
        df[[new_col]] <- unname(mapping[x_chr])
      }
    }
    df
  }

  # Frequency Encoding
  frequency_encode <- function(df, cat_cols) {
    for (col in cat_cols) {
      x_chr <- as.character(df[[col]])
      if (use_data_table) {
        counts <- data.table::data.table(value = x_chr)[, .N, by = value]
        map <- setNames(counts$N, counts$value)
      } else {
        tbl <- table(x_chr)
        map <- setNames(as.integer(tbl), names(tbl))
      }

      new_col <- paste0(col, "_freq")
      if (use_data_table) {
        df[, (new_col) := unname(map[x_chr])]
        df[is.na(get(new_col)), (new_col) := 0L]
      } else {
        df[[new_col]] <- unname(map[x_chr])
        df[[new_col]][is.na(df[[new_col]])] <- 0L
      }
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

      target_vals <- df[[target_col]]
      global_mean <- mean(target_vals, na.rm = TRUE)

      # Loop over categorical columns
      for (col in cat_cols) {
        x_chr <- as.character(df[[col]])
        if (use_data_table) {
          means <- data.table::data.table(value = x_chr, target = target_vals)[
            , .(mean_target = mean(target, na.rm = TRUE)), by = value
          ]
          lookup <- setNames(means$mean_target, means$value)
        } else {
          lookup <- tapply(target_vals, x_chr, mean, na.rm = TRUE)
        }

        new_col <- paste0(col, "_target_", target_col)

        if (use_data_table) {
          df[, (new_col) := unname(lookup[x_chr])]
        } else {
          df[[new_col]] <- unname(lookup[x_chr])
        }

        # Replace NA values with global target mean
        if (use_data_table) {
          df[is.na(get(new_col)), (new_col) := global_mean]
        } else {
          df[[new_col]][is.na(df[[new_col]])] <- global_mean
        }
      }
    }

    df
  }

  # Apply encoding based on method
  encoded_df <- tryCatch({
    if (method == "label") {
      label_encode(data_obj, cat_cols)
    } else if (method == "onehot") {
      onehot_encode(data_obj, cat_cols)
    } else if (method == "ordinal") {
      ordinal_encode(data_obj, cat_cols)
    } else if (method == "frequency") {
      frequency_encode(data_obj, cat_cols)
    } else if (method == "target") {
      target_encode_all(data_obj, cat_cols, target_columns)
    } else {
      stop(paste("Unknown encoding method:", method))
    }
  }, error = function(e) {
    stop(paste("Encoding failed:", e$message))
  })

  # Write output
  tryCatch({
    write_csv_fast(encoded_df, output_csv)
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
