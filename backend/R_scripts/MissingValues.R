handle_missing_values_csv <- function(
    input_csv,
    output_csv,
    columns,
    method = c("row_deletion", "mode", "median", "missing_category", "model_based")
) {
  method <- match.arg(method)

  # Check for mice package only if needed
  if (method == "model_based") {
    if (!requireNamespace("mice", quietly = TRUE)) {
      stop("Package 'mice' is required for model-based imputation. Please run install.packages('mice')")
    }
  }

  # Use Base R to read CSV
  df <- read.csv(input_csv, stringsAsFactors = FALSE)

  is_missing <- function(x) {
    is.na(x) | x == "" | x == "NA" | x == "NULL"
  }

  # Filter columns
  columns <- columns[columns %in% names(df)]
  if (length(columns) == 0) stop("No valid columns provided.")

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

  # 3. Median Imputation
  if (method == "median") {
    for (v in columns) {
      if (is.numeric(df[[v]])) {
        mask <- is_missing(df[[v]])
        if (any(mask)) {
          med <- median(df[[v]], na.rm = TRUE)
          df[[v]][mask] <- med
        }
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

  # 5. Model Based (MICE)
  if (method == "model_based") {
    # Prepare data for MICE
    for (col in names(df)) {
      mask <- is_missing(df[[col]])
      df[[col]][mask] <- NA
    }

    # Convert characters to factors for MICE
    df[sapply(df, is.character)] <- lapply(df[sapply(df, is.character)], as.factor)

    # Setup methods
    mice_methods <- rep("", ncol(df))
    names(mice_methods) <- names(df)

    for (v in names(df)) {
      if (is.numeric(df[[v]])) {
        mice_methods[v] <- "pmm"
      } else {
        mice_methods[v] <- "polyreg"
      }
    }

    # Only impute requested columns
    for (v in names(df)) {
      if (!(v %in% columns)) {
        mice_methods[v] <- ""
      }
    }

    # Run MICE
    imputed <- mice::mice(df, m = 1, maxit = 5, method = mice_methods, print = FALSE)
    result <- mice::complete(imputed)

    write.csv(result, output_csv, row.names = FALSE)
    return(result)
  }
}

# Command line argument handling would go here if this is run as a script
