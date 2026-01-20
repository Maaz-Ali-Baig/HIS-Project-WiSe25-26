#' Binning Techniques for Categorical Variables
#'
#' @param input_csv Path to input CSV file
#' @param output_csv Path to output CSV file
#' @param columns Vector of column names to apply binning to (must be categorical/character)
#' @param method Binning method: "frequency", "target_based", "similarity", "domain", "custom"
#' @param n_bins Number of bins/categories to keep (default = 5)
#' @param min_freq Minimum frequency to keep as separate category (for frequency method)
#' @param target_column Name of target variable for target-based binning
#' @param custom_mapping Named list mapping original categories to new groups
#' @param similarity_threshold Similarity threshold for grouping (0-1)
#'
#' @return Data frame with binned columns and writes to output_csv
#'
#' @examples
#' \dontrun{
#' # Frequency-based binning
#' bin_categorical_csv("data.csv", "output.csv", c("category1", "category2"),
#'                     "frequency", n_bins = 5)
#'
#' # Target-based binning
#' bin_categorical_csv("data.csv", "output.csv", c("category"),
#'                     "target_based", target_column = "response")
#' }
bin_categorical_csv <- function(
    input_csv,
    output_csv,
    columns,
    method = c("frequency", "target_based", "similarity", "domain", "custom"),
    n_bins = 5,
    min_freq = 10,
    target_column = NULL,
    custom_mapping = NULL,
    similarity_threshold = 0.7
) {
  method <- match.arg(method)

  # Read CSV file
  if (!file.exists(input_csv)) {
    stop("Input CSV file does not exist: ", input_csv)
  }

  # Use check.names = FALSE to preserve original column names exactly
  use_data_table <- requireNamespace("data.table", quietly = TRUE)
  if (use_data_table) {
    fread_args <- list(input = input_csv, data.table = FALSE, showProgress = FALSE)
    if ("check.names" %in% names(formals(data.table::fread))) {
      fread_args$check.names <- FALSE
    }
    df <- do.call(data.table::fread, fread_args)
  } else {
    df <- read.csv(input_csv, stringsAsFactors = FALSE, check.names = FALSE)
  }
  n_rows <- nrow(df)

  # Validate columns
  columns <- columns[columns %in% names(df)]
  if (length(columns) == 0) {
    stop("No valid columns provided. Available columns: ", paste(names(df), collapse = ", "))
  }

  # Convert specified columns to character if not already
  for (col in columns) {
    x <- df[[col]]
    # Convert factors to characters for easier manipulation
    if (is.factor(x)) {
      x <- as.character(x)
    } else if (!is.character(x)) {
      warning("Column '", col, "' is not character/factor. Converting to character.")
      x <- as.character(x)
    }
    df[[col]] <- x
  }

  # Handle missing values in categorical data
  missing_tokens <- c("", "NA", "NULL", "null", "Missing")
  is_missing_cat <- function(x) {
    is.na(x) | x %in% missing_tokens
  }

  # 1. Frequency-Based Binning (Lump infrequent categories)
  if (method == "frequency") {
    for (col in columns) {
      x <- df[[col]]
      # Calculate frequencies
      freq_table <- sort(table(x), decreasing = TRUE)

      # Keep top n_bins-1 categories, lump others
      if (length(freq_table) <= n_bins) {
        # No binning needed if categories <= n_bins
        warning("Column '", col, "' has only ", length(freq_table),
                " categories. No binning applied.")
      } else {
        # Get categories to keep
        keep_n <- max(n_bins - 1, 0L)
        categories_to_keep <- names(freq_table)[seq_len(keep_n)]

        # Replace original column with binned values
        x[!x %in% categories_to_keep] <- "Other"

        # For categories below minimum frequency
        if (!is.null(min_freq)) {
          low_freq_cats <- names(freq_table)[freq_table < min_freq]
          if (length(low_freq_cats) > 0) {
            x[x %in% low_freq_cats] <- "Low_Frequency"
          }
        }
      }

      # Handle missing values
      x[is_missing_cat(x)] <- "Missing"

      # Convert to factor
      df[[col]] <- factor(x)
    }
  }

  # 2. Target-Based Binning (using response/target variable)
  else if (method == "target_based") {
    if (is.null(target_column) || !target_column %in% names(df)) {
      stop("For target_based method, provide a valid target_column name")
    }

    target <- df[[target_column]]
    target_is_numeric <- is.numeric(target)

    for (col in columns) {
      x <- df[[col]]
      missing_mask <- is_missing_cat(x)

      if (!any(!missing_mask)) {
        warning("Column '", col, "' has no valid categories. Skipping.")
        next
      }

      x_valid <- x[!missing_mask]
      target_valid <- target[!missing_mask]
      tab <- table(x_valid)

      if (length(tab) == 0) {
        warning("Column '", col, "' has no valid categories. Skipping.")
        next
      }

      cat_names <- names(tab)

      if (target_is_numeric) {
        target_mean <- tapply(target_valid, x_valid, mean, na.rm = TRUE)
        target_sd <- tapply(target_valid, x_valid, sd, na.rm = TRUE)

        cat_stats <- data.frame(
          category = cat_names,
          count = as.integer(tab),
          target_mean = as.numeric(target_mean[cat_names]),
          target_sd = as.numeric(target_sd[cat_names]),
          target_mode = NA_character_,
          stringsAsFactors = FALSE
        )
      } else {
        target_mode <- tapply(target_valid, x_valid, function(y) {
          target_tab <- table(y)
          if (length(target_tab) == 0) {
            return(NA_character_)
          }
          names(target_tab)[which.max(target_tab)]
        })

        cat_stats <- data.frame(
          category = cat_names,
          count = as.integer(tab),
          target_mean = NA_real_,
          target_sd = NA_real_,
          target_mode = as.character(target_mode[cat_names]),
          stringsAsFactors = FALSE
        )
      }

      # Sort by target statistic
      if (target_is_numeric) {
        cat_stats <- cat_stats[order(cat_stats$target_mean), ]
      } else {
        cat_stats <- cat_stats[order(cat_stats$target_mode), ]
      }

      # Create bins based on sorted categories
      n_cats <- nrow(cat_stats)
      if (n_cats <= n_bins) {
        # Map each category to its own bin - no change needed
      } else {
        # Group categories into n_bins
        bin_assignments <- cut(seq_len(n_cats), breaks = n_bins, labels = FALSE)

        # Create mapping
        mapping <- split(cat_stats$category, bin_assignments)
        names(mapping) <- paste0("Bin", names(mapping))

        # Apply mapping - replace original column
        bin_map <- setNames(rep(names(mapping), lengths(mapping)),
                            unlist(mapping, use.names = FALSE))
        mapped <- bin_map[x]
        replace_idx <- !is.na(mapped)
        x[replace_idx] <- mapped[replace_idx]
      }

      # Handle missing values
      x[is_missing_cat(x)] <- "Missing"
      df[[col]] <- factor(x)
    }
  }

  # 3. Similarity-Based Binning (group similar string patterns)
  else if (method == "similarity") {
    # Precompute normalized character vectors for similarity comparisons
    normalize_cat <- function(x) {
      tolower(gsub("[[:space:]]", "", x))
    }

    for (col in columns) {
      x <- df[[col]]
      # Get unique categories
      unique_cats <- unique(na.omit(x))
      unique_cats <- unique_cats[!is_missing_cat(unique_cats)]

      if (length(unique_cats) <= 1) {
        df[[col]] <- factor(x)
        next
      }

      norm_cats <- normalize_cat(unique_cats)
      char_sets <- lapply(norm_cats, function(s) strsplit(s, "")[[1]])
      cat_lengths <- lengths(char_sets)

      # Group similar categories
      groups <- list()
      used <- logical(length(unique_cats))

      for (i in seq_along(unique_cats)) {
        if (!used[i]) {
          base_chars <- char_sets[[i]]
          base_len <- cat_lengths[i]
          group <- unique_cats[i]
          used[i] <- TRUE

          # Only iterate if there are more categories to check
          remaining_idx <- which(!used)
          if (length(remaining_idx) > 0) {
            sims <- vapply(remaining_idx, function(j) {
              common <- sum(base_chars %in% char_sets[[j]])
              max_len <- max(base_len, cat_lengths[j])
              if (max_len == 0) {
                return(0)
              }
              common / max_len
            }, numeric(1))

            to_add_idx <- remaining_idx[sims >= similarity_threshold]
            if (length(to_add_idx) > 0) {
              group <- c(group, unique_cats[to_add_idx])
              used[to_add_idx] <- TRUE
            }
          }

          # Name group after most frequent category
          if (length(group) > 0) {
            group_name <- group[1]  # Use first category as group name
            groups[[group_name]] <- group
          }
        }
      }

      # Apply grouping - replace original column
      group_map <- setNames(rep(names(groups), lengths(groups)),
                            unlist(groups, use.names = FALSE))
      mapped <- group_map[x]
      replace_idx <- !is.na(mapped)
      x[replace_idx] <- mapped[replace_idx]

      # Convert to factor
      df[[col]] <- factor(x)
    }
  }

  # 4. Domain Knowledge Binning (predefined common groupings)
  else if (method == "domain") {
    # Common domain-based groupings for various types of categorical data
    domain_mappings <- list(
      # Education levels
      education = list(
        "Low" = c("No Formal Education", "Primary", "Elementary"),
        "Medium" = c("Secondary", "High School", "Some College"),
        "High" = c("Bachelor", "Master", "Doctorate", "PhD", "Graduate")
      ),

      # Income brackets
      income_level = list(
        "Low" = c("Low", "Very Low", "Poor", "Below Poverty"),
        "Middle" = c("Middle", "Average", "Moderate"),
        "High" = c("High", "Very High", "Upper", "Affluent", "Wealthy")
      ),

      # Age groups
      age_group = list(
        "Child" = c("Infant", "Toddler", "Child", "Kid"),
        "Youth" = c("Teen", "Teenager", "Adolescent", "Youth"),
        "Adult" = c("Adult", "Middle-aged"),
        "Senior" = c("Senior", "Elderly", "Retired", "Old")
      ),

      # Business sizes
      business_size = list(
        "Small" = c("Small", "Micro", "Startup", "Sole Proprietor"),
        "Medium" = c("Medium", "Mid-size", "SME"),
        "Large" = c("Large", "Enterprise", "Corporate", "Multinational")
      )
    )

    for (col in columns) {
      x <- df[[col]]
      # Try to detect column type based on column name or values
      col_lower <- tolower(col)
      detected_domain <- NULL

      # Check column name hints
      if (grepl("educ|degree|qualif", col_lower)) {
        detected_domain <- "education"
      } else if (grepl("income|salary|wage|earn", col_lower)) {
        detected_domain <- "income_level"
      } else if (grepl("age|generation", col_lower)) {
        detected_domain <- "age_group"
      } else if (grepl("size|scale|business", col_lower)) {
        detected_domain <- "business_size"
      }

      # Apply domain mapping if detected
      if (!is.null(detected_domain) && detected_domain %in% names(domain_mappings)) {
        mapping <- domain_mappings[[detected_domain]]
        temp_col <- rep("Other", n_rows)

        for (group_name in names(mapping)) {
          pattern <- paste(mapping[[group_name]], collapse = "|")
          mask <- grepl(pattern, x, ignore.case = TRUE)
          temp_col[mask] <- group_name
        }
        x <- temp_col
      } else {
        # If no domain detected, use frequency-based as fallback
        warning("No domain mapping detected for column '", col,
                "'. Using frequency-based binning as fallback.")
        freq_table <- sort(table(x), decreasing = TRUE)
        top_cats <- names(freq_table)[seq_len(min(n_bins, length(freq_table)))]
        x <- ifelse(
          x %in% top_cats,
          x,
          "Other"
        )
      }

      df[[col]] <- factor(x)
    }
  }

  # 5. Custom Mapping Binning
  else if (method == "custom") {
    if (is.null(custom_mapping)) {
      stop("For custom method, provide custom_mapping parameter (named list)")
    }

    map <- setNames(rep(names(custom_mapping), lengths(custom_mapping)),
                    unlist(custom_mapping, use.names = FALSE))
    for (col in columns) {
      x <- df[[col]]
      # Apply custom mapping - replace original column
      mapped <- map[x]
      temp_col <- mapped
      temp_col[is.na(temp_col)] <- "Other"

      # Check if any categories weren't mapped
      unmapped <- is.na(mapped)
      if (any(unmapped)) {
        warning(sum(unmapped), " values in column '", col,
                "' were not mapped and assigned to 'Other'")
      }

      df[[col]] <- factor(temp_col)
    }
  }

  # Write to output CSV
  if (use_data_table && requireNamespace("data.table", quietly = TRUE)) {
    data.table::fwrite(df, output_csv)
  } else {
    write.csv(df, output_csv, row.names = FALSE)
  }

  # Print summary
  cat("\n", rep("=", 60), "\n", sep = "")
  cat("CATEGORICAL BINNING COMPLETED SUCCESSFULLY!\n")
  cat(rep("=", 60), "\n")
  cat("Input file:  ", input_csv, "\n")
  cat("Output file: ", output_csv, "\n")
  cat("Method:      ", method, "\n")
  cat("Columns processed: ", paste(columns, collapse = ", "), "\n\n")

  # Show binning results summary
  cat("Binning Results Summary:\n")
  for (col in columns) {
    bin_col <- paste0(col, "_", switch(method,
      "frequency" = "freq_bin",
      "target_based" = "target_bin",
      "similarity" = "sim_bin",
      "domain" = "domain_bin",
      "custom" = "custom_bin"
    ))

    if (bin_col %in% names(df)) {
      cat("\nColumn: ", col, " -> ", bin_col, "\n", sep = "")
      print(table(df[[bin_col]], useNA = "always"))
      cat("Original categories: ", length(unique(na.omit(df[[col]]))),
          " -> Binned categories: ", length(unique(na.omit(df[[bin_col]]))), "\n", sep = "")
    }
  }

  invisible(df)
}

#' Helper function to get binning summary statistics
#'
#' @param binned_data Data frame returned from bin_categorical_csv
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

#' Create sample categorical data for testing
#'
#' @param n Number of rows to generate
#' @return Data frame with sample categorical data
create_sample_categorical_data <- function(n = 100) {
  set.seed(123)

  # Create diverse categorical data
  education_levels <- c("Primary", "Secondary", "High School", "Bachelor",
                       "Master", "PhD", "No Formal Education", "Some College")

  product_categories <- c("Electronics", "Clothing", "Books", "Home & Garden",
                         "Sports", "Toys", "Automotive", "Health & Beauty",
                         "Groceries", "Office Supplies", "Furniture")

  # Generate data
  sample_data <- data.frame(
    customer_id = 1:n,
    education = sample(education_levels, n, replace = TRUE,
                      prob = c(0.1, 0.15, 0.2, 0.25, 0.15, 0.05, 0.05, 0.05)),
    product_category = sample(product_categories, n, replace = TRUE,
                             prob = rep(1/length(product_categories), length(product_categories))),
    purchase_amount = round(rnorm(n, mean = 100, sd = 50), 2),
    response = sample(c("Yes", "No"), n, replace = TRUE, prob = c(0.3, 0.7))
  )

  # Add some missing values
  sample_data$education[sample(1:n, 10)] <- NA
  sample_data$product_category[sample(1:n, 5)] <- ""

  return(sample_data)
}

#' Simple example usage
#'
#' @return Runs a simple example and prints results
example_usage <- function() {
  cat("Running categorical binning example...\n")

  # Create sample data
  sample_data <- data.frame(
    category = c("A", "A", "A", "B", "B", "C", "C", "C", "C", "D", "E", "F", "G"),
    value = c(10, 12, 11, 8, 9, 15, 18, 20, 16, 5, 6, 7, 9),
    target = c(1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1)
  )

  write.csv(sample_data, "example_input.csv", row.names = FALSE)

  cat("\n1. Frequency binning (keep top 3 categories):\n")
  result <- bin_categorical_csv("example_input.csv", "example_output.csv",
                               "category", "frequency", n_bins = 3)
  print(table(result$category_freq_bin))

  cat("\n2. Target-based binning:\n")
  result2 <- bin_categorical_csv("example_input.csv", "example_output2.csv",
                                "category", "target_based",
                                target_column = "target", n_bins = 2)
  print(table(result2$category_target_bin))

  # Cleanup
  unlink(c("example_input.csv", "example_output.csv", "example_output2.csv"))
  cat("\nExample completed and files cleaned up.\n")
}

# Add this to make the function available when sourced
if (sys.nframe() == 0) {
  cat("Categorical binning function loaded successfully.\n")
  cat("Use bin_categorical_csv() to bin categorical data.\n")
  cat("Use example_usage() to see an example.\n")
}
