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
#' @param treat_numeric_as_categorical If TRUE, converts low-cardinality numeric to categorical (default: TRUE)
#' @param max_numeric_categories Max unique values for numeric to be treated as categorical (default: 20)
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

#' Comprehensive missing value detection
#' Detects various representations of missing values
is_missing_categorical <- function(x) {
  if (is.null(x)) return(TRUE)
  if (length(x) == 0) return(TRUE)
  if (is.na(x)) return(TRUE)
  
  # For character/factor values, check common missing tokens
  if (is.character(x) || is.factor(x)) {
    x_lower <- tolower(trimws(as.character(x)))
    missing_tokens <- c("", "na", "n/a", "nan", "none", "null", "nil", 
                        "#n/a", "#na", "missing", "n.a.", "<na>", "<null>",
                        "undefined", "n.a", "--", ".", "?", "unknown")
    return(x_lower %in% missing_tokens)
  }
  
  return(FALSE)
}

bin_categorical_csv <- function(
    input_csv,
    output_csv,
    columns,
    method = c("frequency", "target_based", "similarity", "domain", "custom"),
    n_bins = 5,
    min_freq = 10,
    target_column = NULL,
    custom_mapping = NULL,
    similarity_threshold = 0.7,
    treat_numeric_as_categorical = TRUE,
    max_numeric_categories = 20
) {
  method <- match.arg(method)
  
  # Read CSV file
  if (!file.exists(input_csv)) {
    stop("Input CSV file does not exist: ", input_csv)
  }
  
  # Use check.names = FALSE to preserve original column names exactly
  df <- read.csv(input_csv, stringsAsFactors = FALSE, check.names = FALSE)
  
  # Validate columns
  columns <- columns[columns %in% names(df)]
  if (length(columns) == 0) {
    stop("No valid columns provided. Available columns: ", paste(names(df), collapse = ", "))
  }
  
  # Convert specified columns to character if not already (including numeric ratings)
  for (col in columns) {
    if (is.numeric(df[[col]])) {
      unique_vals <- length(unique(df[[col]][!is.na(df[[col]])]))
      
      if (treat_numeric_as_categorical && unique_vals <= max_numeric_categories && unique_vals >= 2) {
        message("Column '", col, "' is numeric with ", unique_vals, 
                " unique values - treating as categorical (rating scale)")
        df[[col]] <- as.character(df[[col]])
      } else if (!is.character(df[[col]]) && !is.factor(df[[col]])) {
        warning("Column '", col, "' is numeric with many values. Converting to character, but binning may not be meaningful.")
        df[[col]] <- as.character(df[[col]])
      }
    } else if (!is.character(df[[col]]) && !is.factor(df[[col]])) {
      warning("Column '", col, "' is not character/factor. Converting to character.")
      df[[col]] <- as.character(df[[col]])
    }
    # Convert factors to characters for easier manipulation
    if (is.factor(df[[col]])) {
      df[[col]] <- as.character(df[[col]])
    }
  }
  
  # 1. Frequency-Based Binning (Lump infrequent categories)
  if (method == "frequency") {
    for (col in columns) {
      # Calculate frequencies (excluding missing values)
      non_missing <- !sapply(df[[col]], is_missing_categorical)
      freq_table <- table(df[[col]][non_missing])
      freq_df <- data.frame(
        category = names(freq_table),
        frequency = as.numeric(freq_table),
        stringsAsFactors = FALSE
      )
      freq_df <- freq_df[order(-freq_df$frequency), ]
      
      # Keep top n_bins-1 categories, lump others
      if (nrow(freq_df) <= n_bins) {
        # No binning needed if categories <= n_bins
        message("Column '", col, "' has only ", nrow(freq_df), 
                " categories. Keeping all categories.")
        binned_values <- as.character(df[[col]])
      } else {
        # Determine which to keep vs lump
        categories_to_keep <- character(0)
        categories_for_other <- character(0)
        
        for (i in 1:nrow(freq_df)) {
          cat_name <- freq_df$category[i]
          cat_freq <- freq_df$frequency[i]
          
          # Priority: keep top categories OR those above min_freq (up to n_bins-1)
          if (length(categories_to_keep) < (n_bins - 1)) {
            if (is.null(min_freq) || cat_freq >= min_freq) {
              categories_to_keep <- c(categories_to_keep, cat_name)
            } else {
              categories_for_other <- c(categories_for_other, cat_name)
            }
          } else {
            categories_for_other <- c(categories_for_other, cat_name)
          }
        }
        
        # Create binned column
        binned_values <- ifelse(
          df[[col]] %in% categories_to_keep,
          as.character(df[[col]]),
          "Other"
        )
      }
      
      # Handle missing values
      missing_mask <- sapply(df[[col]], is_missing_categorical)
      binned_values[missing_mask] <- "Missing"
      
      # Overwrite original column
      df[[col]] <- as.factor(binned_values)
    }
  }
  
  # 2. Target-Based Binning (using response/target variable)
  else if (method == "target_based") {
    if (is.null(target_column) || !target_column %in% names(df)) {
      stop("For target_based method, provide a valid target_column name")
    }
    
    for (col in columns) {
      # Calculate target statistics for each category (excluding missing)
      non_missing <- !sapply(df[[col]], is_missing_categorical)
      unique_cats <- unique(df[[col]][non_missing])
      
      if (length(unique_cats) == 0) {
        warning("Column '", col, "' has no valid categories. Skipping.")
        next
      }
      
      # Initialize results
      cat_stats <- data.frame(
        category = character(),
        count = numeric(),
        target_mean = numeric(),
        target_mode = character(),
        stringsAsFactors = FALSE
      )
      
      # Calculate statistics for each category
      for (cat in unique_cats) {
        mask <- df[[col]] == cat & non_missing
        if (sum(mask) > 0) {
          if (is.numeric(df[[target_column]])) {
            target_stat <- mean(df[[target_column]][mask], na.rm = TRUE)
            mode_val <- NA
          } else {
            # For categorical target, use mode
            target_tab <- table(df[[target_column]][mask])
            target_stat <- NA
            mode_val <- names(target_tab)[which.max(target_tab)]
          }
          
          cat_stats <- rbind(cat_stats, data.frame(
            category = cat,
            count = sum(mask),
            target_mean = target_stat,
            target_mode = ifelse(is.na(mode_val), "", as.character(mode_val)),
            stringsAsFactors = FALSE
          ))
        }
      }
      
      # Sort by target statistic
      if (is.numeric(df[[target_column]])) {
        cat_stats <- cat_stats[order(cat_stats$target_mean), ]
      } else {
        cat_stats <- cat_stats[order(cat_stats$target_mode), ]
      }
      
      # Create bins based on sorted categories
      n_cats <- nrow(cat_stats)
      binned_values <- rep("Other", nrow(df))
      
      if (n_cats <= n_bins) {
        # Keep original categories
        binned_values <- as.character(df[[col]])
      } else {
        # Group categories into n_bins
        bin_assignments <- cut(1:n_cats, breaks = n_bins, labels = FALSE)
        
        # Create mapping
        for (i in 1:n_bins) {
          cats_in_bin <- cat_stats$category[bin_assignments == i]
          mask <- df[[col]] %in% cats_in_bin
          binned_values[mask] <- paste0("TargetBin_", i)
        }
      }
      
      # Handle missing values
      missing_mask <- sapply(df[[col]], is_missing_categorical)
      binned_values[missing_mask] <- "Missing"
      
      # Overwrite original column
      df[[col]] <- as.factor(binned_values)
    }
  }
  
  # 3. Similarity-Based Binning (group similar string patterns)
  else if (method == "similarity") {
    # Function to calculate string similarity
    string_similarity <- function(str1, str2) {
      if (is.na(str1) || is.na(str2) || str1 == "" || str2 == "") return(0)
      
      # Convert to lower case and remove spaces
      s1 <- tolower(gsub("[[:space:]]", "", str1))
      s2 <- tolower(gsub("[[:space:]]", "", str2))
      
      # Simple similarity: proportion of common characters
      chars1 <- strsplit(s1, "")[[1]]
      chars2 <- strsplit(s2, "")[[1]]
      
      common <- sum(chars1 %in% chars2)
      max_len <- max(length(chars1), length(chars2))
      
      if (max_len == 0) return(0)
      return(common / max_len)
    }
    
    for (col in columns) {
      # Get unique categories (exclude missing values)
      non_missing <- !sapply(df[[col]], is_missing_categorical)
      unique_cats <- unique(df[[col]][non_missing])
      
      if (length(unique_cats) <= 1) {
        next
      }
      
      # Create similarity matrix
      sim_matrix <- matrix(0, nrow = length(unique_cats), ncol = length(unique_cats))
      rownames(sim_matrix) <- unique_cats
      colnames(sim_matrix) <- unique_cats
      
      for (i in 1:length(unique_cats)) {
        for (j in i:length(unique_cats)) {
          if (i == j) {
            sim_matrix[i, j] <- 1
          } else {
            sim_matrix[i, j] <- string_similarity(unique_cats[i], unique_cats[j])
            sim_matrix[j, i] <- sim_matrix[i, j]
          }
        }
      }
      
      # Group similar categories
      groups <- list()
      used <- rep(FALSE, length(unique_cats))
      
      for (i in 1:length(unique_cats)) {
        if (!used[i]) {
          group <- unique_cats[i]
          used[i] <- TRUE
          
          # Only iterate if there are more categories to check
          if (i < length(unique_cats)) {
            for (j in (i+1):length(unique_cats)) {
              if (!used[j] && sim_matrix[i, j] >= similarity_threshold) {
                group <- c(group, unique_cats[j])
                used[j] <- TRUE
              }
            }
          }
          
          # Name group after most frequent category
          if (length(group) > 0) {
            group_name <- group[1]  # Use first category as group name
            groups[[group_name]] <- group
          }
        }
      }
      
      # Apply grouping
      binned_values <- as.character(df[[col]])
      
      for (group_name in names(groups)) {
        mask <- df[[col]] %in% groups[[group_name]]
        binned_values[mask] <- group_name
      }
      
      # Handle missing
      missing_mask <- sapply(df[[col]], is_missing_categorical)
      binned_values[missing_mask] <- "Missing"
      
      # Overwrite original column
      df[[col]] <- as.factor(binned_values)
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
      binned_values <- rep("Other", nrow(df))
      
      if (!is.null(detected_domain) && detected_domain %in% names(domain_mappings)) {
        mapping <- domain_mappings[[detected_domain]]
        
        for (group_name in names(mapping)) {
          # Check for partial matches
          for (pattern in mapping[[group_name]]) {
            mask <- grepl(pattern, df[[col]], ignore.case = TRUE)
            binned_values[mask] <- group_name
          }
        }
      } else {
        # If no domain detected, use frequency-based as fallback
        message("No domain mapping detected for column '", col, 
                "'. Using frequency-based binning as fallback.")
        non_missing <- !sapply(df[[col]], is_missing_categorical)
        freq_table <- table(df[[col]][non_missing])
        top_cats <- names(sort(freq_table, decreasing = TRUE))[1:min(n_bins, length(freq_table))]
        binned_values <- ifelse(
          df[[col]] %in% top_cats,
          as.character(df[[col]]),
          "Other"
        )
      }
      
      # Handle missing
      missing_mask <- sapply(df[[col]], is_missing_categorical)
      binned_values[missing_mask] <- "Missing"
      
      # Overwrite original column
      df[[col]] <- as.factor(binned_values)
    }
  }
  
  # 5. Custom Mapping Binning
  else if (method == "custom") {
    if (is.null(custom_mapping)) {
      stop("For custom method, provide custom_mapping parameter (named list)")
    }
    
    for (col in columns) {
      # Apply custom mapping
      binned_values <- rep("Other", nrow(df))  # Default
      
      for (group_name in names(custom_mapping)) {
        mask <- df[[col]] %in% custom_mapping[[group_name]]
        binned_values[mask] <- group_name
      }
      
      # Check if any categories weren't mapped (excluding missing)
      non_missing <- !sapply(df[[col]], is_missing_categorical)
      unmapped <- non_missing & !(df[[col]] %in% unlist(custom_mapping))
      if (any(unmapped)) {
        warning(sum(unmapped), " values in column '", col, 
                "' were not mapped and assigned to 'Other'")
      }
      
      # Handle missing
      missing_mask <- sapply(df[[col]], is_missing_categorical)
      binned_values[missing_mask] <- "Missing"
      
      # Overwrite original column
      df[[col]] <- as.factor(binned_values)
    }
  }
  
  # Write to output CSV
  write.csv(df, output_csv, row.names = FALSE)
  
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
    if (col %in% names(df)) {
      cat("\nColumn: ", col, " (overwritten)\n", sep = "")
      print(table(df[[col]], useNA = "ifany"))
      
      binned_unique <- length(unique(df[[col]][df[[col]] != "Missing"]))
      cat("Binned categories: ", binned_unique, "\n", sep = "")
    }
  }
  cat("\n", rep("=", 60), "\n\n", sep = "")
  
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
    # Check if original was overwritten
    if (original_col %in% names(binned_data) && is.factor(binned_data[[original_col]])) {
      message("Original column '", original_col, "' appears to have been overwritten (no *_bin column found)")
      return(list(table(binned_data[[original_col]], useNA = "ifany")))
    }
    stop("No bin columns found for: ", original_col)
  }
  
  summary_list <- list()
  
  for (bin_col in bin_cols) {
    if (is.factor(binned_data[[bin_col]]) || is.character(binned_data[[bin_col]])) {
      summary_list[[bin_col]] <- table(binned_data[[bin_col]], useNA = "ifany")
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