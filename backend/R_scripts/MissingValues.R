handle_missing_values_csv <- function(
    input_csv,
    output_csv,
    columns,
    method = c("row_deletion", "mode", "median", "missing_category", "model_based"),
    k = 5
) {
  method <- match.arg(method)

  # model_based = KNN, so we need VIM
  if (method == "model_based") {
    if (!requireNamespace("VIM", quietly = TRUE)) {
      stop("Package 'VIM' is required for model-based (KNN) imputation. Please run install.packages('VIM')")
    }
  }

  # Use Base R to read CSV
  # Use check.names = FALSE to preserve original column names exactly
  df <- read.csv(input_csv, stringsAsFactors = FALSE, na.strings = character(0), check.names = FALSE)

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
    missing_rows <- apply(df[columns], 1, function(row) any(is_missing(row)))
    result <- df[!missing_rows, ]
    write.csv(result, output_csv, row.names = FALSE)
    return(result)
  }

  # 2. Mode Imputation
  if (method == "mode") {
    for (v in columns) {
      x <- df[[v]]
      mask <- is_missing(x)
      if (any(mask)) {
        mode_val <- names(which.max(table(x[!mask])))
        df[[v]][mask] <- mode_val
      }
    }
    write.csv(df, output_csv, row.names = FALSE)
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
        mode_val <- names(which.max(table(x_non_missing)))
        x[mask] <- mode_val
        df[[v]] <- x
        message(paste0("Column '", v, "': Applied MODE imputation (categorical column, mode = '", mode_val, "')"))
      }
    }
    write.csv(df, output_csv, row.names = FALSE)
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
    write.csv(df, output_csv, row.names = FALSE)
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

    write.csv(df_knn, output_csv, row.names = FALSE, na = "")
    return(df_knn)
  }
}
