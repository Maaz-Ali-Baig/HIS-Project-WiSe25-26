handle_missing_values_csv <- function(
    input_csv,
    output_csv,
    columns,
    method = c("row_deletion", "mode", "median", "missing_category", "model_based"),
    k = 5) {
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

  # Vectorized function to check for missing values
  is_missing <- function(x) {
    # Initialize result vector
    result <- rep(FALSE, length(x))
    
    # Check for standard R NA
    result <- result | is.na(x)
    
    # Check for empty strings and common string representations
    if (is.character(x)) {
      # Trim whitespace and convert to lowercase for comparison
      x_trimmed <- tolower(trimws(x))
      # Check against common missing value representations
      missing_tokens <- c("", "na", "n/a", "nan", "none", "null", "nil", 
                          "#n/a", "#na", "missing", "n.a.", "<na>")
      result <- result | (x_trimmed %in% missing_tokens)
    }
    
    return(result)
  }

  # Filter columns
  columns <- columns[columns %in% names(df)]
  if (length(columns) == 0) {
    available_cols <- paste(names(df), collapse = ", ")
    requested_cols <- paste(columns, collapse = ", ")
    stop(paste0(
      "No valid columns provided. Available columns: [", available_cols,
      "]. Requested columns: [", requested_cols, "]"
    ))
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
        next # No missing values, skip this column
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


  # 5. Model Based (Fast Random Forest via missRanger)
  if (method == "model_based") {
    if (!requireNamespace("missRanger", quietly = TRUE)) {
      stop("Package 'missRanger' is required for fast model-based imputation. Please run install.packages('missRanger')")
    }


    other_cols <- setdiff(names(df), columns)
    df_other_original <- df[other_cols]


    for (col in columns) {
      mask <- is_missing(df[[col]])
      df[[col]][mask] <- NA


      if (is.character(df[[col]])) {
        df[[col]] <- as.factor(df[[col]])
      }
    }


    df_imputed <- missRanger::missRanger(
      df,
      formula = as.formula(paste(paste(columns, collapse = "+"), "~ .")),
      pmm.k = 3, # Note: The function argument 'k' is currently ignored here
      num.trees = 100,
      verbose = 0,
      seed = 123
    )


    df_imputed[other_cols] <- df_other_original

    write.csv(df_imputed, output_csv, row.names = FALSE, na = "")
    return(df_imputed)
  }
}
