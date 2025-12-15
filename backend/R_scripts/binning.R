#' Binning Techniques for Numeric Variables
#'
#' @param input_csv Path to input CSV file
#' @param output_csv Path to output CSV file
#' @param columns Vector of column names to apply binning to (must be numeric)
#' @param method Binning method: "equal_width", "equal_freq", "smooth_mean", "smooth_median", "quantile", "custom"
#' @param n_bins Number of bins (default = 5)
#' @param bin_labels Custom labels for bins (optional)
#' @param smooth_window Window size for smoothing (default = 3)
#' @param breaks Custom break points (only for custom method)
#'
#' @return Data frame with binned columns and writes to output_csv
#'
#' @examples
#' \dontrun{
#' # Equal width binning
#' bin_data_csv("data.csv", "output.csv", c("age", "income"), "equal_width", n_bins = 4)
#'
#' # Equal frequency binning
#' bin_data_csv("data.csv", "output.csv", c("age"), "equal_freq", n_bins = 5)
#'
#' # Smooth binning
#' bin_data_csv("data.csv", "output.csv", c("value"), "smooth_mean", smooth_window = 5)
#' }
bin_data_csv <- function(
    input_csv,
    output_csv,
    columns,
    method = c("equal_width", "equal_freq", "smooth_mean", "smooth_median", "quantile", "custom"),
    n_bins = 5,
    bin_labels = NULL,
    smooth_window = 3,
    breaks = NULL
) {
  method <- match.arg(method)

  # Read CSV file
  if (!file.exists(input_csv)) {
    stop("Input CSV file does not exist: ", input_csv)
  }

  df <- read.csv(input_csv, stringsAsFactors = FALSE)

  # Validate columns
  columns <- columns[columns %in% names(df)]
  if (length(columns) == 0) {
    stop("No valid columns provided. Available columns: ", paste(names(df), collapse = ", "))
  }

  # Check if columns are numeric
  non_numeric <- columns[!sapply(df[columns], is.numeric)]
  if (length(non_numeric) > 0) {
    warning("The following columns are not numeric and will be skipped: ",
            paste(non_numeric, collapse = ", "))
    columns <- setdiff(columns, non_numeric)
  }

  if (length(columns) == 0) {
    stop("No numeric columns available for binning.")
  }

  # Function to generate bin labels
  generate_labels <- function(n, prefix = "Bin") {
    if (!is.null(bin_labels)) {
      if (length(bin_labels) != n) {
        warning("Number of bin_labels (", length(bin_labels),
                ") doesn't match n_bins (", n, "). Using default labels.")
        paste0(prefix, 1:n)
      } else {
        bin_labels
      }
    } else {
      paste0(prefix, 1:n)
    }
  }

  # 1. Equal Width Binning
  if (method == "equal_width") {
    for (col in columns) {
      if (all(is.na(df[[col]]))) {
        warning("Column '", col, "' contains only NA values. Skipping.")
        next
      }

      # Remove NA for break calculation
      clean_data <- df[[col]][!is.na(df[[col]])]
      if (length(clean_data) == 0) next

      min_val <- min(clean_data)
      max_val <- max(clean_data)

      # Create breaks
      br <- seq(min_val, max_val, length.out = n_bins + 1)

      # Adjust first and last break to include all values
      br[1] <- -Inf
      br[length(br)] <- Inf

      # Create bins
      bins <- cut(df[[col]], breaks = br, include.lowest = TRUE)

      # Generate labels
      labels <- generate_labels(n_bins, paste0(col, "_"))

      # Assign bin numbers (1 to n_bins)
      bin_nums <- as.numeric(bins)
      bin_nums[is.na(bin_nums)] <- NA

      # Create new column
      new_col_name <- paste0(col, "_ew_bin")
      df[[new_col_name]] <- factor(bin_nums, levels = 1:n_bins, labels = labels)

      # Also add numeric bin number
      df[[paste0(col, "_ew_bin_num")]] <- bin_nums
    }
  }

  # 2. Equal Frequency (Quantile) Binning
  else if (method == "equal_freq") {
    for (col in columns) {
      if (all(is.na(df[[col]]))) {
        warning("Column '", col, "' contains only NA values. Skipping.")
        next
      }

      # Remove NA for quantile calculation
      clean_data <- df[[col]][!is.na(df[[col]])]
      if (length(clean_data) == 0) next

      # Calculate quantile breaks
      probs <- seq(0, 1, length.out = n_bins + 1)
      br <- quantile(clean_data, probs = probs, na.rm = TRUE)

      # Ensure unique breaks
      br <- unique(br)
      if (length(br) < n_bins + 1) {
        warning("Column '", col, "' has ties. Reducing number of bins to ", length(br) - 1)
        n_actual_bins <- length(br) - 1
      } else {
        n_actual_bins <- n_bins
      }

      # Adjust first and last break
      br[1] <- -Inf
      br[length(br)] <- Inf

      # Create bins
      bins <- cut(df[[col]], breaks = br, include.lowest = TRUE)

      # Generate labels
      labels <- generate_labels(n_actual_bins, paste0(col, "_"))

      # Assign bin numbers
      bin_nums <- as.numeric(bins)
      bin_nums[is.na(bin_nums)] <- NA

      # Create new column
      new_col_name <- paste0(col, "_ef_bin")
      df[[new_col_name]] <- factor(bin_nums, levels = 1:n_actual_bins, labels = labels)

      # Also add numeric bin number
      df[[paste0(col, "_ef_bin_num")]] <- bin_nums
    }
  }

  # 3. Smooth Mean Binning
  else if (method == "smooth_mean") {
    for (col in columns) {
      if (all(is.na(df[[col]]))) {
        warning("Column '", col, "' contains only NA values. Skipping.")
        next
      }

      # Sort data
      sorted_idx <- order(df[[col]])
      sorted_data <- df[[col]][sorted_idx]

      # Apply moving average smoothing
      smoothed <- vector("numeric", length(sorted_data))

      for (i in 1:length(sorted_data)) {
        start_idx <- max(1, i - floor(smooth_window/2))
        end_idx <- min(length(sorted_data), i + floor(smooth_window/2))
        smoothed[i] <- mean(sorted_data[start_idx:end_idx], na.rm = TRUE)
      }

      # Create bins based on smoothed values
      probs <- seq(0, 1, length.out = n_bins + 1)
      br <- quantile(smoothed, probs = probs, na.rm = TRUE)
      br <- unique(br)

      # Adjust breaks
      br[1] <- -Inf
      br[length(br)] <- Inf

      # Create bins for original data
      bins <- cut(df[[col]], breaks = br, include.lowest = TRUE)

      # Generate labels
      labels <- generate_labels(length(levels(bins)), paste0(col, "_"))

      # Create new column
      new_col_name <- paste0(col, "_smooth_mean_bin")
      df[[new_col_name]] <- bins
      levels(df[[new_col_name]]) <- labels

      # Add smoothed value column
      # Unsmooth back to original order
      unsmoothed <- numeric(nrow(df))
      unsmoothed[sorted_idx] <- smoothed
      df[[paste0(col, "_smoothed")]] <- unsmoothed
    }
  }

  # 4. Smooth Median Binning
  else if (method == "smooth_median") {
    for (col in columns) {
      if (all(is.na(df[[col]]))) {
        warning("Column '", col, "' contains only NA values. Skipping.")
        next
      }

      # Sort data
      sorted_idx <- order(df[[col]])
      sorted_data <- df[[col]][sorted_idx]

      # Apply moving median smoothing
      smoothed <- vector("numeric", length(sorted_data))

      for (i in 1:length(sorted_data)) {
        start_idx <- max(1, i - floor(smooth_window/2))
        end_idx <- min(length(sorted_data), i + floor(smooth_window/2))
        smoothed[i] <- median(sorted_data[start_idx:end_idx], na.rm = TRUE)
      }

      # Create bins based on smoothed values
      probs <- seq(0, 1, length.out = n_bins + 1)
      br <- quantile(smoothed, probs = probs, na.rm = TRUE)
      br <- unique(br)

      # Adjust breaks
      br[1] <- -Inf
      br[length(br)] <- Inf

      # Create bins for original data
      bins <- cut(df[[col]], breaks = br, include.lowest = TRUE)

      # Generate labels
      labels <- generate_labels(length(levels(bins)), paste0(col, "_"))

      # Create new column
      new_col_name <- paste0(col, "_smooth_median_bin")
      df[[new_col_name]] <- bins
      levels(df[[new_col_name]]) <- labels

      # Add smoothed value column
      unsmoothed <- numeric(nrow(df))
      unsmoothed[sorted_idx] <- smoothed
      df[[paste0(col, "_smoothed")]] <- unsmoothed
    }
  }

  # 5. Quantile Binning (special case with specified quantiles)
  else if (method == "quantile") {
    for (col in columns) {
      if (all(is.na(df[[col]]))) {
        warning("Column '", col, "' contains only NA values. Skipping.")
        next
      }

      # Use provided breaks or calculate quantiles
      if (is.null(breaks)) {
        probs <- seq(0, 1, length.out = n_bins + 1)
        br <- quantile(df[[col]], probs = probs, na.rm = TRUE)
      } else {
        br <- quantile(df[[col]], probs = breaks, na.rm = TRUE)
      }

      br <- unique(br)
      br[1] <- -Inf
      br[length(br)] <- Inf

      # Create bins
      bins <- cut(df[[col]], breaks = br, include.lowest = TRUE)

      # Generate labels
      n_actual_bins <- length(levels(bins))
      labels <- generate_labels(n_actual_bins, paste0(col, "_"))

      # Create new column
      new_col_name <- paste0(col, "_quantile_bin")
      df[[new_col_name]] <- bins
      levels(df[[new_col_name]]) <- labels
    }
  }

  # 6. Custom Binning with specified breaks
  else if (method == "custom") {
    if (is.null(breaks)) {
      stop("For custom binning, you must provide 'breaks' parameter")
    }

    for (col in columns) {
      if (all(is.na(df[[col]]))) {
        warning("Column '", col, "' contains only NA values. Skipping.")
        next
      }

      # Use provided breaks
      br <- breaks
      br <- unique(sort(br))

      # Add -Inf and Inf to include all values
      if (min(df[[col]], na.rm = TRUE) < min(br)) {
        br <- c(-Inf, br)
      }
      if (max(df[[col]], na.rm = TRUE) > max(br)) {
        br <- c(br, Inf)
      }

      # Create bins
      bins <- cut(df[[col]], breaks = br, include.lowest = TRUE)

      # Generate labels
      n_actual_bins <- length(levels(bins))
      labels <- generate_labels(n_actual_bins, paste0(col, "_"))

      # Create new column
      new_col_name <- paste0(col, "_custom_bin")
      df[[new_col_name]] <- bins
      levels(df[[new_col_name]]) <- labels
    }
  }

  # Write to output CSV
  write.csv(df, output_csv, row.names = FALSE)

  # Print summary
  cat("Binning completed successfully!\n")
  cat("Input file:", input_csv, "\n")
  cat("Output file:", output_csv, "\n")
  cat("Method:", method, "\n")
  cat("Columns binned:", paste(columns, collapse = ", "), "\n")
  cat("New columns created:\n")
  new_cols <- setdiff(names(df), names(read.csv(input_csv, stringsAsFactors = FALSE, nrows = 1)))
  cat(paste("  -", new_cols, collapse = "\n"), "\n")

  invisible(df)
}

#' Helper function to get binning summary statistics
#'
#' @param binned_data Data frame returned from bin_data_csv
#' @param original_col Original column name
#'
#' @return Summary statistics for bins
get_bin_summary <- function(binned_data, original_col) {
  # Find bin columns for this original column
  bin_cols <- grep(paste0("^", original_col, "_.*_bin$"), names(binned_data), value = TRUE)

  if (length(bin_cols) == 0) {
    stop("No bin columns found for: ", original_col)
  }

  summary_list <- list()

  for (bin_col in bin_cols) {
    if (is.factor(binned_data[[bin_col]])) {
      summary_list[[bin_col]] <- table(binned_data[[bin_col]], useNA = "always")
    }
  }

  return(summary_list)
}

# Example usage function
example_binning_usage <- function() {
  # Create sample data
  set.seed(123)
  sample_data <- data.frame(
    id = 1:100,
    age = round(rnorm(100, mean = 45, sd = 15)),
    income = round(rnorm(100, mean = 50000, sd = 20000)),
    score = runif(100, 0, 100)
  )

  # Add some missing values
  sample_data$age[sample(1:100, 10)] <- NA
  sample_data$income[sample(1:100, 5)] <- NA

  # Write to CSV
  write.csv(sample_data, "sample_data.csv", row.names = FALSE)

  cat("Sample data created: sample_data.csv\n\n")

  # Example 1: Equal width binning
  cat("=== Example 1: Equal Width Binning ===\n")
  result1 <- bin_data_csv(
    input_csv = "sample_data.csv",
    output_csv = "binned_equal_width.csv",
    columns = c("age", "income"),
    method = "equal_width",
    n_bins = 4,
    bin_labels = c("Young", "Middle", "Senior", "Elderly")
  )

  # Example 2: Equal frequency binning
  cat("\n=== Example 2: Equal Frequency Binning ===\n")
  result2 <- bin_data_csv(
    input_csv = "sample_data.csv",
    output_csv = "binned_equal_freq.csv",
    columns = c("age", "income"),
    method = "equal_freq",
    n_bins = 5
  )

  # Example 3: Smooth mean binning
  cat("\n=== Example 3: Smooth Mean Binning ===\n")
  result3 <- bin_data_csv(
    input_csv = "sample_data.csv",
    output_csv = "binned_smooth_mean.csv",
    columns = c("score"),
    method = "smooth_mean",
    n_bins = 4,
    smooth_window = 5
  )

  # Clean up example files
  unlink(c("sample_data.csv", "binned_equal_width.csv",
           "binned_equal_freq.csv", "binned_smooth_mean.csv"))

  cat("\nExample files cleaned up.\n")
}

# To run examples:
# example_binning_usage()
