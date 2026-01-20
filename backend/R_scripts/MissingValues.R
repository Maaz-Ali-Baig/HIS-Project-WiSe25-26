handle_missing_values_csv <- function(
    input_csv,
    output_csv,
    columns,
    method = c("row_deletion", "mode", "median", "missing_category", "model_based"),
    k = 5
) {
  method <- match.arg(method)

  use_data_table <- requireNamespace("data.table", quietly = TRUE)

  read_csv_fast <- function(path) {
    if (use_data_table) {
      fread_args <- list(input = path, data.table = FALSE, na.strings = character(0), showProgress = FALSE)
      if ("check.names" %in% names(formals(data.table::fread))) {
        fread_args$check.names <- FALSE
      }
      return(do.call(data.table::fread, fread_args))
    }
    read.csv(path, stringsAsFactors = FALSE, na.strings = character(0), check.names = FALSE)
  }

  write_csv_fast <- function(df, path, na = "NA") {
    if (use_data_table) {
      data.table::fwrite(df, path, na = na)
    } else {
      write.csv(df, path, row.names = FALSE, na = na)
    }
  }

  fast_mode <- function(x, missing_mask = NULL) {
    if (!is.null(missing_mask)) {
      x <- x[!missing_mask]
    }
    if (length(x) == 0) {
      return(NA_character_)
    }
    if (use_data_table) {
      dt <- data.table::data.table(val = x)
      mode_val <- dt[, .N, by = val][order(-N)][1L, val]
      return(as.character(mode_val))
    }
    tab <- table(x)
    names(tab)[which.max(tab)]
  }

  # model_based = KNN, so we need VIM
  if (method == "model_based") {
    if (!requireNamespace("VIM", quietly = TRUE)) {
      stop("Package 'VIM' is required for model-based (KNN) imputation. Please run install.packages('VIM')")
    }
  }

  # Use Base R to read CSV
  # Use check.names = FALSE to preserve original column names exactly
  df <- read_csv_fast(input_csv)

  is_missing <- function(x) {
    is.na(x) | x == "" | x == "NA" | x == "NULL"
  }

  # Filter columns
  columns <- columns[columns %in% names(df)]
  if (length(columns) == 0) {
    available_cols <- paste(names(df), collapse = ", ")
    requested_cols <- paste(columns, collapse = ", ")
    stop(paste0("No valid columns provided. Available columns: [", available_cols,
                "]. Requested columns: [", requested_cols, "]"))
  }

  # 1. Row Deletion
  if (method == "row_deletion") {
    missing_mat <- vapply(df[columns], is_missing, logical(nrow(df)))
    missing_rows <- rowSums(missing_mat) > 0
    result <- df[!missing_rows, ]
    write_csv_fast(result, output_csv)
    return(result)
  }

  # 2. Mode Imputation
  if (method == "mode") {
    for (v in columns) {
      x <- df[[v]]
      mask <- is_missing(x)
      if (any(mask)) {
        mode_val <- fast_mode(x, mask)
        x[mask] <- mode_val
        df[[v]] <- x
      }
    }
    write_csv_fast(df, output_csv)
    return(df)
  }

  # 3. Median Imputation (with automatic mode fallback for categorical)
  if (method == "median") {
    for (v in columns) {
      x <- df[[v]]
      mask <- is_missing(x)

      if (!any(mask)) {
        next  # No missing values, skip this column
      }

      # Try to convert to numeric (handles string columns with numeric values)
      x_non_missing <- x[!mask]

      # Check if values can be converted to numeric
      x_numeric <- suppressWarnings(as.numeric(x_non_missing))

      if (any(!is.na(x_numeric))) {
        # Column has numeric values, apply median imputation
        x_all_numeric <- suppressWarnings(as.numeric(x))
        med <- median(x_all_numeric, na.rm = TRUE)
        x_all_numeric[mask] <- med
        df[[v]] <- x_all_numeric
        message(paste0("Column '", v, "': Applied MEDIAN imputation (median = ", round(med, 2), ")"))
      } else {
        # Column is categorical, fallback to mode imputation
        mode_val <- fast_mode(x_non_missing)
        x[mask] <- mode_val
        df[[v]] <- x
        message(paste0("Column '", v, "': Applied MODE imputation (categorical column, mode = '", mode_val, "')"))
      }
    }
    write_csv_fast(df, output_csv)
    return(df)
  }

  # 4. Missing Category
  if (method == "missing_category") {
    for (v in columns) {
      x <- as.character(df[[v]])
      mask <- is_missing(x)
      x[mask] <- "Missing"
      df[[v]] <- factor(x)
    }
    write_csv_fast(df, output_csv)
    return(df)
  }

  # 5. Model Based (KNN)

  if (method == "model_based") {

    # Keep an exact copy of untouched columns
    other_cols <- setdiff(names(df), columns)
    df_other_original <- df[other_cols]

    # Convert missing tokens to NA ONLY in target columns
    for (col in columns) {
      mask <- is_missing(df[[col]])
      df[[col]][mask] <- NA
    }

    # (Optional but usually good) factorize ONLY target columns if they are character
    for (col in columns) {
      if (is.character(df[[col]])) df[[col]] <- as.factor(df[[col]])
    }

    # Run KNN only on requested columns
    df_knn <- VIM::kNN(df, variable = columns, k = k, imp_var = FALSE)

    # Restore other columns EXACTLY as they were
    df_knn[other_cols] <- df_other_original

    write_csv_fast(df_knn, output_csv, na = "")
    return(df_knn)
  }
}
