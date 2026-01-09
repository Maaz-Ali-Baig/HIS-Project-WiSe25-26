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
  df <- read.csv(input_csv, stringsAsFactors = FALSE, check.names = FALSE)
  
  # Validate columns
  columns <- columns[columns %in% names(df)]
  if (length(columns) == 0) {
    stop("No valid columns provided. Available columns: ", paste(names(df), collapse = ", "))
  }
  
  # Convert specified columns to character if not already
  for (col in columns) {
    if (!is.character(df[[col]]) && !is.factor(df[[col]])) {
      warning("Column '", col, "' is not character/factor. Converting to character.")
      df[[col]] <- as.character(df[[col]])
    }
    # Convert factors to characters for easier manipulation
    if (is.factor(df[[col]])) {
      df[[col]] <- as.character(df[[col]])
    }
  }
  
  # Handle missing values in categorical data
  is_missing_cat <- function(x) {
    is.na(x) | x == "" | x == "NA" | x == "NULL" | x == "null" | x == "Missing"
  }
  
  # 1. Frequency-Based Binning (Lump infrequent categories)
  if (method == "frequency") {
    for (col in columns) {
      # Calculate frequencies
      freq_table <- table(df[[col]])
      freq_df <- data.frame(
        category = names(freq_table),
        frequency = as.numeric(freq_table),
        stringsAsFactors = FALSE
      )
      freq_df <- freq_df[order(-freq_df$frequency), ]
      
      # Keep top n_bins-1 categories, lump others
      if (nrow(freq_df) <= n_bins) {
        # No binning needed if categories <= n_bins
        warning("Column '", col, "' has only ", nrow(freq_df), 
                " categories. No binning applied.")
      } else {
        # Get categories to keep
        categories_to_keep <- freq_df$category[1:(n_bins - 1)]
        
        # Replace original column with binned values
        df[[col]] <- ifelse(
          df[[col]] %in% categories_to_keep,
          df[[col]],
          "Other"
        )
        
        # For categories below minimum frequency
        if (!is.null(min_freq)) {
          low_freq_cats <- freq_df$category[freq_df$frequency < min_freq]
          df[[col]][df[[col]] %in% low_freq_cats] <- "Low_Frequency"
        }
      }
      
      # Handle missing values
      df[[col]][is_missing_cat(df[[col]])] <- "Missing"
      
      # Convert to factor
      df[[col]] <- as.factor(df[[col]])
    }
  }
  
  # 2. Target-Based Binning (using response/target variable)
  else if (method == "target_based") {
    if (is.null(target_column) || !target_column %in% names(df)) {
      stop("For target_based method, provide a valid target_column name")
    }
    
    for (col in columns) {
      # Calculate target statistics for each category
      unique_cats <- unique(na.omit(df[[col]]))
      
      if (length(unique_cats) == 0) {
        warning("Column '", col, "' has no valid categories. Skipping.")
        next
      }
      
      # Initialize results
      cat_stats <- data.frame(
        category = character(),
        count = numeric(),
        target_mean = numeric(),
        target_sd = numeric(),
        stringsAsFactors = FALSE
      )
      
      # Calculate statistics for each category
      for (cat in unique_cats) {
        if (is_missing_cat(cat)) next
        
        mask <- df[[col]] == cat & !is_missing_cat(df[[col]])
        if (sum(mask) > 0) {
          if (is.numeric(df[[target_column]])) {
            target_mean <- mean(df[[target_column]][mask], na.rm = TRUE)
            target_sd <- sd(df[[target_column]][mask], na.rm = TRUE)
          } else {
            # For categorical target, use mode
            target_tab <- table(df[[target_column]][mask])
            target_mean <- names(target_tab)[which.max(target_tab)]
            target_sd <- NA
          }
          
          cat_stats <- rbind(cat_stats, data.frame(
            category = cat,
            count = sum(mask),
            target_mean = ifelse(is.numeric(target_mean), target_mean, NA),
            target_sd = target_sd,
            target_mode = ifelse(!is.numeric(target_mean), as.character(target_mean), NA),
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
      if (n_cats <= n_bins) {
        # Map each category to its own bin - no change needed
      } else {
        # Group categories into n_bins
        bin_size <- ceiling(n_cats / n_bins)
        bin_assignments <- cut(1:n_cats, breaks = n_bins, labels = FALSE)
        
        # Create mapping
        mapping <- list()
        for (i in 1:n_bins) {
          cats_in_bin <- cat_stats$category[bin_assignments == i]
          mapping[[paste0("Bin", i)]] <- cats_in_bin
        }
        
        # Apply mapping - replace original column
        temp_col <- "Other"
        for (bin_name in names(mapping)) {
          mask <- df[[col]] %in% mapping[[bin_name]]
          df[[col]][mask] <- bin_name
        }
      }
      
      # Handle missing values
      df[[col]][is_missing_cat(df[[col]])] <- "Missing"
      df[[col]] <- as.factor(df[[col]])
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
      # Get unique categories
      unique_cats <- unique(na.omit(df[[col]]))
      unique_cats <- unique_cats[!is_missing_cat(unique_cats)]
      
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
      
      # Apply grouping - replace original column
      for (group_name in names(groups)) {
        mask <- df[[col]] %in% groups[[group_name]]
        df[[col]][mask] <- group_name
      }
      
      # Convert to factor
      df[[col]] <- as.factor(df[[col]])
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
      if (!is.null(detected_domain) && detected_domain %in% names(domain_mappings)) {
        mapping <- domain_mappings[[detected_domain]]
        temp_col <- rep("Other", nrow(df))
        
        for (group_name in names(mapping)) {
          # Check for partial matches
          for (pattern in mapping[[group_name]]) {
            mask <- grepl(pattern, df[[col]], ignore.case = TRUE)
            temp_col[mask] <- group_name
          }
        }
        df[[col]] <- temp_col
      } else {
        # If no domain detected, use frequency-based as fallback
        warning("No domain mapping detected for column '", col, 
                "'. Using frequency-based binning as fallback.")
        freq_table <- table(df[[col]])
        top_cats <- names(sort(freq_table, decreasing = TRUE))[1:min(n_bins, length(freq_table))]
        df[[col]] <- ifelse(
          df[[col]] %in% top_cats,
          df[[col]],
          "Other"
        )
      }
      
      df[[col]] <- as.factor(df[[col]])
    }
  }
  
  # 5. Custom Mapping Binning
  else if (method == "custom") {
    if (is.null(custom_mapping)) {
      stop("For custom method, provide custom_mapping parameter (named list)")
    }
    
    for (col in columns) {
      # Apply custom mapping - replace original column
      temp_col <- rep("Other", nrow(df))  # Default
      
      for (group_name in names(custom_mapping)) {
        mask <- df[[col]] %in% custom_mapping[[group_name]]
        temp_col[mask] <- group_name
      }
      
      # Check if any categories weren't mapped
      unmapped <- !(df[[col]] %in% unlist(custom_mapping))
      if (any(unmapped)) {
        warning(sum(unmapped), " values in column '", col, 
                "' were not mapped and assigned to 'Other'")
      }
      
      df[[col]] <- as.factor(temp_col)
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