

# Correlation Analysis R Script
# This script performs various correlation analyses for nominal and ordinal variables
# Input: JSON via stdin
# Output: JSON to stdout


# Suppress ALL warnings, messages, and output
options(warn = -1)
invisible(suppressMessages({
  # Load only required library
  library(jsonlite)
}))


# Helper function to create error response
create_error <- function(message) {
  list(error = message)
}


# Helper function to check if a value is NA (including string representations)
is_na_value <- function(x) {
  # Check for standard R NA and NULL
  if (is.na(x) || is.null(x)) {
    return(TRUE)
  }
  
  # Check for empty strings and common string representations of missing values
  if (is.character(x)) {
    # Trim whitespace and convert to lowercase for comparison
    x_trimmed <- tolower(trimws(x))
    # Check against common missing value representations
    missing_tokens <- c("", "na", "n/a", "nan", "none", "null", "nil", 
                        "#n/a", "#na", "missing", "n.a.", "<na>")
    return(x_trimmed %in% missing_tokens)
  }
  
  return(FALSE)
}


# Helper function to handle missing values based on specified method
# Methods: "remove", "mode", "median", "missing_category"
handle_missing_values <- function(data1, data2, method = "remove", var1_type = NULL, var1_ordering = NULL, var2_type = NULL, var2_ordering = NULL) {
  # Identify missing values (including empty strings and common string representations)
  missing1 <- sapply(data1, is_na_value)
  missing2 <- sapply(data2, is_na_value)


  if (method == "remove") {
    # Pairwise deletion: remove rows where EITHER column has missing values
    valid_indices <- !missing1 & !missing2
    return(list(
      data1 = data1[valid_indices],
      data2 = data2[valid_indices],
      removed = sum(!valid_indices)
    ))
  }


  else if (method == "mode") {
    # Impute with mode (most frequent value)
    if (any(missing1)) {
      mode_val1 <- names(sort(table(data1[!missing1]), decreasing = TRUE))[1]
      data1[missing1] <- mode_val1
    }
    if (any(missing2)) {
      mode_val2 <- names(sort(table(data2[!missing2]), decreasing = TRUE))[1]
      data2[missing2] <- mode_val2
    }
    return(list(
      data1 = data1,
      data2 = data2,
      removed = 0
    ))
  }


  else if (method == "median") {
    # For ordinal: impute with median category
    # For nominal: fall back to mode
    if (any(missing1)) {
      if (!is.null(var1_type) && var1_type == "ordinal" && !is.null(var1_ordering)) {
        # Map to numeric, find median, map back to category
        numeric_vals <- sapply(data1[!missing1], function(x) {
          if (x %in% names(var1_ordering)) var1_ordering[[x]] else NA
        })
        median_val <- median(numeric_vals, na.rm = TRUE)
        # Find closest category
        closest_cat <- names(var1_ordering)[which.min(abs(unlist(var1_ordering) - median_val))]
        data1[missing1] <- closest_cat
      } else {
        # Fall back to mode for nominal
        mode_val1 <- names(sort(table(data1[!missing1]), decreasing = TRUE))[1]
        data1[missing1] <- mode_val1
      }
    }
    if (any(missing2)) {
      # For data2, always use mode (we don't have var2_type/ordering in this function)
      mode_val2 <- names(sort(table(data2[!missing2]), decreasing = TRUE))[1]
      data2[missing2] <- mode_val2
    }
    return(list(
      data1 = data1,
      data2 = data2,
      removed = 0
    ))
  }


  else if (method == "missing_category") {
    # Replace with "Missing" category
    missing_cat_count1 <- sum(missing1)
    missing_cat_count2 <- sum(missing2)


    if (any(missing1)) data1[missing1] <- "Missing"
    if (any(missing2)) data2[missing2] <- "Missing"


    # For ordinal variables, we need to remove rows with "Missing" category from analysis
    # but track how many were categorized as missing
    rows_with_missing_category <- rep(FALSE, length(data1))


    # If var1 is ordinal, mark rows with "Missing" for removal
    if (!is.null(var1_type) && var1_type == "ordinal" && any(missing1)) {
      rows_with_missing_category <- rows_with_missing_category | (data1 == "Missing")
    }


    # If var2 is ordinal, mark rows with "Missing" for removal
    if (!is.null(var2_type) && var2_type == "ordinal" && any(missing2)) {
      rows_with_missing_category <- rows_with_missing_category | (data2 == "Missing")
    }


    # Remove rows with "Missing" if either variable is ordinal
    if (any(rows_with_missing_category)) {
      data1 <- data1[!rows_with_missing_category]
      data2 <- data2[!rows_with_missing_category]
      removed_count <- sum(rows_with_missing_category)
    } else {
      removed_count <- 0
    }


    return(list(
      data1 = data1,
      data2 = data2,
      removed = removed_count,
      missing_category_count = missing_cat_count1 + missing_cat_count2
    ))
  }


  else {
    # Default to remove
    valid_indices <- !missing1 & !missing2
    return(list(
      data1 = data1[valid_indices],
      data2 = data2[valid_indices],
      removed = sum(!valid_indices)
    ))
  }
}


# Helper function to apply ordinal ordering
apply_ordering <- function(data, ordering) {
  write("=== APPLY_ORDERING DEBUG ===", stderr())
  write(paste("Input data length:", length(data)), stderr())
  write(paste("Input data class:", class(data)[1]), stderr())
  write(paste("Sample input data:", paste(head(data, 3), collapse=", ")), stderr())
  write(paste("Ordering is.null:", is.null(ordering)), stderr())
  
  # Handle NULL, empty list, or empty named list
  if (is.null(ordering) || length(ordering) == 0 || (is.list(ordering) && length(names(ordering)) == 0)) {
    write("No ordering provided, creating natural ordering", stderr())
    # If no ordering provided, create natural ordering from unique values
    # Filter out NA/NULL values before creating the ordering
    non_na_data <- data[!sapply(data, is_na_value)]
    unique_vals <- sort(unique(non_na_data))
    factor_data <- factor(data, levels = unique_vals)
    result <- as.numeric(factor_data)
    write(paste("Output - is.numeric:", is.numeric(result)), stderr())
    write(paste("Sample output:", paste(head(result, 3), collapse=", ")), stderr())
    write("============================", stderr())
    return(result)
  }

  write(paste("Ordering class:", class(ordering)[1]), stderr())
  write(paste("Ordering length:", length(ordering)), stderr())
  write(paste("Ordering names sample:", paste(names(ordering)[1:min(3, length(ordering))], collapse=", ")), stderr())

  # Create ordered factor based on provided ordering
  ordered_data <- sapply(data, function(x) {
    # Check if it's an NA value first
    if (is_na_value(x)) {
      return(NA)
    }
    
    if (x %in% names(ordering)) {
      return(ordering[[x]])
    } else {
      # If value not in ordering, return NA (will be handled later)
      return(NA)
    }
  })
 
  # Convert to numeric
  numeric_data <- as.numeric(ordered_data)
 
  # Check if we have NAs from unmapped values
  if (any(is.na(numeric_data))) {
    # Get unique values not in ordering
    unmapped_vals <- unique(data[is.na(numeric_data)])
    write(paste("WARNING: Some values not found in ordering:", paste(unmapped_vals, collapse=", ")), stderr())
  }

  write(paste("Output - is.numeric:", is.numeric(numeric_data)), stderr())
  write(paste("Sample output:", paste(head(numeric_data, 3), collapse=", ")), stderr())
  write("============================", stderr())
  return(numeric_data)
}


# Chi-square test of independence
chi_square_test <- function(data1, data2) {
  tryCatch({
    contingency_table <- table(data1, data2)
    test_result <- chisq.test(contingency_table)


    # Calculate Cramer's V as effect size
    chi_sq <- test_result$statistic
    n <- sum(contingency_table)
    min_dim <- min(nrow(contingency_table) - 1, ncol(contingency_table) - 1)
    cramers_v_value <- sqrt(chi_sq / (n * min_dim))


    list(
      method_name = "Chi-square test of independence",
      result = list(
        statistic = as.numeric(test_result$statistic),
        p_value = as.numeric(test_result$p.value),
        df = as.numeric(test_result$parameter),
        effect_size = as.numeric(cramers_v_value),
        effect_size_name = "Cramer's V",
        interpretation = ifelse(
          test_result$p.value < 0.05,
          "Significant association detected (p < 0.05)",
          "No significant association detected (p >= 0.05)"
        )
      )
    )
  }, error = function(e) {
    create_error(paste("Chi-square test failed:", e$message))
  })
}


# Phi coefficient
phi_coefficient <- function(data1, data2) {
  tryCatch({
    contingency_table <- table(data1, data2)


    # Check if 2x2 table
    if (nrow(contingency_table) != 2 || ncol(contingency_table) != 2) {
      return(create_error("Phi coefficient requires a 2x2 contingency table"))
    }


    chi_sq <- chisq.test(contingency_table)$statistic
    n <- sum(contingency_table)
    phi <- sqrt(chi_sq / n)


    # Calculate p-value from chi-square
    p_value <- chisq.test(contingency_table)$p.value


    list(
      method_name = "Phi coefficient",
      result = list(
        statistic = as.numeric(phi),
        p_value = as.numeric(p_value),
        effect_size = as.numeric(phi),
        effect_size_name = "Phi",
        interpretation = paste0(
          "Phi = ", round(phi, 3), ". ",
          ifelse(abs(phi) < 0.1, "Weak", ifelse(abs(phi) < 0.3, "Moderate", "Strong")),
          " association. ",
          ifelse(p_value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")
        )
      )
    )
  }, error = function(e) {
    create_error(paste("Phi coefficient calculation failed:", e$message))
  })
}


# Cramer's V
cramers_v <- function(data1, data2) {
  tryCatch({
    contingency_table <- table(data1, data2)
    chi_sq <- chisq.test(contingency_table)$statistic
    n <- sum(contingency_table)
    min_dim <- min(nrow(contingency_table) - 1, ncol(contingency_table) - 1)


    cramers_v_value <- sqrt(chi_sq / (n * min_dim))
    p_value <- chisq.test(contingency_table)$p.value


    list(
      method_name = "Cramer's V",
      result = list(
        statistic = as.numeric(cramers_v_value),
        p_value = as.numeric(p_value),
        effect_size = as.numeric(cramers_v_value),
        effect_size_name = "Cramer's V",
        interpretation = paste0(
          "Cramer's V = ", round(cramers_v_value, 3), ". ",
          ifelse(cramers_v_value < 0.1, "Weak",
                 ifelse(cramers_v_value < 0.3, "Moderate", "Strong")),
          " association. ",
          ifelse(p_value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")
        )
      )
    )
  }, error = function(e) {
    create_error(paste("Cramer's V calculation failed:", e$message))
  })
}


# Spearman's rank correlation
spearman_correlation <- function(data1, data2) {
  tryCatch({
    # Remove any remaining NAs that might have been introduced
    valid_indices <- !is.na(data1) & !is.na(data2)
    data1_clean <- data1[valid_indices]
    data2_clean <- data2[valid_indices]
   
    # Check if we have enough data
    if (length(data1_clean) < 3) {
      return(create_error("Insufficient data for Spearman correlation (need at least 3 valid observations)"))
    }
   
    # Check if there's any variation in the data
    if (length(unique(data1_clean)) < 2 || length(unique(data2_clean)) < 2) {
      return(create_error("Insufficient variation in data (need at least 2 distinct values in each variable)"))
    }
   
    test_result <- cor.test(data1_clean, data2_clean, method = "spearman", exact = FALSE)


    list(
      method_name = "Spearman's rank correlation",
      result = list(
        statistic = as.numeric(test_result$estimate),
        p_value = as.numeric(test_result$p.value),
        effect_size = as.numeric(test_result$estimate),
        effect_size_name = "Spearman's ρ",
        interpretation = paste0(
          "Spearman's ρ = ", round(test_result$estimate, 3), ". ",
          ifelse(abs(test_result$estimate) < 0.3, "Weak",
                 ifelse(abs(test_result$estimate) < 0.7, "Moderate", "Strong")),
          " ", ifelse(test_result$estimate > 0, "positive", "negative"), " correlation. ",
          ifelse(test_result$p.value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")
        )
      )
    )
  }, error = function(e) {
    create_error(paste("Spearman correlation failed:", e$message))
  })
}


# Kendall's tau-b
kendall_tau <- function(data1, data2) {
  tryCatch({
    test_result <- cor.test(data1, data2, method = "kendall")


    list(
      method_name = "Kendall's tau-b",
      result = list(
        statistic = as.numeric(test_result$estimate),
        p_value = as.numeric(test_result$p.value),
        z_value = as.numeric(test_result$statistic),
        effect_size = as.numeric(test_result$estimate),
        effect_size_name = "Kendall's τb",
        interpretation = paste0(
          "Kendall's τb = ", round(test_result$estimate, 3), ". ",
          ifelse(abs(test_result$estimate) < 0.3, "Weak",
                 ifelse(abs(test_result$estimate) < 0.7, "Moderate", "Strong")),
          " ", ifelse(test_result$estimate > 0, "positive", "negative"), " association. ",
          ifelse(test_result$p.value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")
        )
      )
    )
  }, error = function(e) {
    create_error(paste("Kendall's tau calculation failed:", e$message))
  })
}


# Somers' D
somers_d <- function(data1, data2) {
  tryCatch({
    # Optimized Somers' D using vectorized operations
    n <- length(data1)
   
    # Convert to numeric ranks for faster comparison
    rank_x <- as.numeric(factor(data1))
    rank_y <- as.numeric(factor(data2))
   
    # Vectorized concordance calculation (much faster than nested loops)
    concordant <- 0
    discordant <- 0
    ties_y <- 0
   
    # Use outer subtraction for vectorization
    x_outer <- outer(rank_x, rank_x, "-")
    y_outer <- outer(rank_y, rank_y, "-")
   
    # Count concordant, discordant, and ties
    # Only consider upper triangle (i < j)
    upper_tri <- upper.tri(x_outer)
    x_upper <- x_outer[upper_tri]
    y_upper <- y_outer[upper_tri]
   
    concordant <- sum(sign(x_upper) == sign(y_upper) & sign(x_upper) != 0)
    discordant <- sum(sign(x_upper) != sign(y_upper) & sign(x_upper) != 0 & sign(y_upper) != 0)
    ties_y <- sum(x_upper != 0 & y_upper == 0)
   
    # Somers' D (asymmetric: d(Y|X))
    denominator <- concordant + discordant + ties_y
    somers_d_value <- if (denominator > 0) {
      (concordant - discordant) / denominator
    } else {
      0
    }


    # Approximate p-value using normal approximation
    n_pairs <- n * (n - 1) / 2
    se <- sqrt((4 * n + 10) / (9 * n * (n - 1)))
    z_value <- somers_d_value / se
    p_value <- 2 * pnorm(-abs(z_value))


    list(
      method_name = "Somers' D",
      result = list(
        statistic = as.numeric(somers_d_value),
        p_value = as.numeric(p_value),
        effect_size = as.numeric(somers_d_value),
        effect_size_name = "Somers' D",
        interpretation = paste0(
          "Somers' D = ", round(somers_d_value, 3), ". ",
          ifelse(abs(somers_d_value) < 0.3, "Weak",
                 ifelse(abs(somers_d_value) < 0.7, "Moderate", "Strong")),
          " asymmetric association. ",
          ifelse(p_value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")
        )
      )
    )
  }, error = function(e) {
    create_error(paste("Somers' D calculation failed:", e$message))
  })
}


# Pearson correlation on ordinal scores
pearson_ordinal <- function(data1, data2) {
  tryCatch({
    test_result <- cor.test(data1, data2, method = "pearson")


    list(
      method_name = "Pearson correlation on ordinal scores",
      result = list(
        statistic = as.numeric(test_result$estimate),
        p_value = as.numeric(test_result$p.value),
        confidence_interval = as.numeric(test_result$conf.int),
        effect_size = as.numeric(test_result$estimate),
        effect_size_name = "Pearson r",
        interpretation = paste0(
          "Pearson r = ", round(test_result$estimate, 3), ". ",
          ifelse(abs(test_result$estimate) < 0.3, "Weak",
                 ifelse(abs(test_result$estimate) < 0.7, "Moderate", "Strong")),
          " ", ifelse(test_result$estimate > 0, "positive", "negative"), " linear relationship. ",
          ifelse(test_result$p.value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")
        )
      )
    )
  }, error = function(e) {
    create_error(paste("Pearson correlation failed:", e$message))
  })
}


# One-way ANOVA with eta squared
anova_eta <- function(nominal_data, ordinal_data) {
  tryCatch({
    # Debug: Log input types
    write(paste("ANOVA Debug - Nominal data type:", class(nominal_data)[1], 
                "| Ordinal data type:", class(ordinal_data)[1]), stderr())
    write(paste("ANOVA Debug - Nominal is.numeric:", is.numeric(nominal_data), 
                "| Ordinal is.numeric:", is.numeric(ordinal_data)), stderr())
    write(paste("ANOVA Debug - Sample nominal values:", paste(head(nominal_data, 3), collapse=", ")), stderr())
    write(paste("ANOVA Debug - Sample ordinal values:", paste(head(ordinal_data, 3), collapse=", ")), stderr())
    
    # Step 1: Ensure we have vectors (not lists)
    # Unlist but preserve numeric type for ordinal data
    if (is.numeric(ordinal_data)) {
      ordinal_data <- as.numeric(ordinal_data)
    } else {
      ordinal_data <- as.numeric(unlist(ordinal_data))
    }
    
    if (is.character(nominal_data) || is.factor(nominal_data)) {
      nominal_data <- as.character(nominal_data)
    } else {
      nominal_data <- as.character(unlist(nominal_data))
    }
    
    write(paste("ANOVA Debug - After unlist/conversion - Ordinal is.numeric:", is.numeric(ordinal_data)), stderr())
    write(paste("ANOVA Debug - After unlist/conversion - Nominal is.character:", is.character(nominal_data)), stderr())
    
    # Step 2: Remove NA values (check for both R NA and empty strings)
    valid_nom <- !is.na(nominal_data)
    if (is.character(nominal_data)) {
      valid_nom <- valid_nom & nchar(trimws(nominal_data)) > 0
    }
    
    valid_ord <- !is.na(ordinal_data)
    
    valid_indices <- valid_nom & valid_ord
    nominal_data <- nominal_data[valid_indices]
    ordinal_data <- ordinal_data[valid_indices]
    
    # Step 3: Check we have enough data
    if (length(nominal_data) < 2 || length(ordinal_data) < 2) {
      return(create_error("Insufficient data after removing NA values (need at least 2 observations)"))
    }
    
    write(paste("ANOVA Debug - After NA removal - lengths:", length(nominal_data), length(ordinal_data)), stderr())
    write(paste("ANOVA Debug - Ordinal still numeric?", is.numeric(ordinal_data)), stderr())
    
    # Step 4: Final validation - ensure ordinal is truly numeric
    if (!is.numeric(ordinal_data)) {
      return(create_error(paste0(
        "Ordinal data is not numeric after processing. ",
        "Type: ", class(ordinal_data)[1], ". ",
        "This is a bug in the data pipeline."
      )))
    }
    
    # Step 5: Validate we have variation
    if (length(unique(nominal_data)) < 2) {
      return(create_error("Nominal variable has less than 2 unique groups"))
    }
    
    # Check for sufficient replication within groups
    group_counts <- table(nominal_data)
    groups_with_replication <- sum(group_counts > 1)
    total_groups <- length(group_counts)
    
    write(paste("ANOVA Debug - Total groups:", total_groups), stderr())
    write(paste("ANOVA Debug - Groups with >1 observation:", groups_with_replication), stderr())
    write(paste("ANOVA Debug - Average observations per group:", mean(group_counts)), stderr())
    
    # If most groups have only 1 observation, ANOVA is inappropriate
    if (groups_with_replication < 2) {
      return(create_error(paste0(
        "ANOVA is not appropriate: nominal variable has ", total_groups, 
        " groups but only ", groups_with_replication, 
        " groups have multiple observations. ",
        "ANOVA requires replication within groups to estimate within-group variance."
      )))
    }
    
    # Warn if there are many groups with single observations
    if (groups_with_replication / total_groups < 0.5) {
      write(paste("ANOVA Warning - Over half of the groups have only 1 observation. Results may be unreliable."), stderr())
    }
    
    # Convert nominal to factor
    nominal_data <- as.factor(nominal_data)
    
    write(paste("ANOVA Debug - Creating dataframe..."), stderr())
    
    # Step 6: Create data frame
    df <- data.frame(
      group = nominal_data,
      value = ordinal_data,
      stringsAsFactors = FALSE
    )
    
    write(paste("ANOVA Debug - DataFrame created. Running ANOVA..."), stderr())
    
    # Step 7: Perform ANOVA
    anova_result <- aov(value ~ group, data = df)
    anova_summary <- summary(anova_result)
    
    write(paste("ANOVA Debug - ANOVA completed successfully"), stderr())
    write(paste("ANOVA Debug - Summary structure:"), stderr())
    write(paste("ANOVA Debug - Number of summary elements:", length(anova_summary)), stderr())
    write(paste("ANOVA Debug - First element class:", class(anova_summary[[1]])[1]), stderr())
    write(paste("ANOVA Debug - Column names:", paste(names(anova_summary[[1]]), collapse=", ")), stderr())
    write(paste("ANOVA Debug - Number of rows:", nrow(anova_summary[[1]])), stderr())
    
    # Check if F value and Pr(>F) columns exist
    has_f_value <- "F value" %in% names(anova_summary[[1]])
    has_pr_f <- "Pr(>F)" %in% names(anova_summary[[1]])
    
    write(paste("ANOVA Debug - Has 'F value' column:", has_f_value), stderr())
    write(paste("ANOVA Debug - Has 'Pr(>F)' column:", has_pr_f), stderr())
    
    if (!has_f_value || !has_pr_f) {
      return(create_error(paste0(
        "ANOVA summary is incomplete. This may occur when there is no within-group variation. ",
        "Available columns: ", paste(names(anova_summary[[1]]), collapse=", ")
      )))
    }
    
    # Step 8: Calculate eta squared
    ss_between <- as.numeric(anova_summary[[1]][1, "Sum Sq"])
    ss_total <- as.numeric(sum(anova_summary[[1]][, "Sum Sq"]))
    eta_squared <- as.numeric(ss_between / ss_total)
    
    write(paste("ANOVA Debug - Eta squared calculated:", eta_squared), stderr())
    
    # Step 9: Extract statistics  
    f_statistic <- as.numeric(anova_summary[[1]][1, "F value"])
    p_value <- as.numeric(anova_summary[[1]][1, "Pr(>F)"])
    df_between <- as.numeric(anova_summary[[1]][1, "Df"])
    df_within <- as.numeric(anova_summary[[1]][2, "Df"])
    
    write(paste("ANOVA Debug - f_statistic:", f_statistic, "| p_value:", p_value), stderr())
    write(paste("ANOVA Debug - df_between:", df_between, "| df_within:", df_within), stderr())
    
    # Check for invalid values
    if (is.na(f_statistic) || is.na(p_value) || is.na(df_between) || is.na(df_within)) {
      return(create_error("ANOVA produced invalid statistics (NA values detected)"))
    }
    
    if (length(f_statistic) == 0 || length(p_value) == 0 || length(df_between) == 0 || length(df_within) == 0) {
      return(create_error("ANOVA produced empty statistics (length zero detected)"))
    }
    
    write(paste("ANOVA Debug - Statistics extracted and validated"), stderr())
    
    # Step 10: Determine effect size category
    if (eta_squared < 0.06) {
      effect_category <- "small"
    } else if (eta_squared < 0.14) {
      effect_category <- "medium"
    } else {
      effect_category <- "large"
    }
    
    # Determine significance message
    if (p_value < 0.05) {
      sig_message <- "Significant group differences detected (p < 0.05)"
    } else {
      sig_message <- "No significant group differences (p >= 0.05)"
    }
    
    write(paste("ANOVA Debug - Building interpretation string"), stderr())
    
    # Step 11: Build interpretation
    interpretation_text <- paste0(
      "F(", df_between, ", ", df_within, ") = ",
      round(f_statistic, 2), ", p = ", round(p_value, 4), ". ",
      "η² = ", round(eta_squared, 3), " (",
      effect_category, " effect size). ",
      sig_message
    )
    
    write(paste("ANOVA Debug - Interpretation built successfully"), stderr())
    
    # Step 12: Return results
    list(
      method_name = "One-way ANOVA with eta squared",
      result = list(
        statistic = f_statistic,
        f_statistic = f_statistic,
        p_value = p_value,
        eta_squared = eta_squared,
        effect_size = eta_squared,
        effect_size_name = "η²",
        df = df_between,
        df_between = df_between,
        df_within = df_within,
        interpretation = interpretation_text
      )
    )
  }, error = function(e) {
    write(paste("ANOVA Debug - ERROR:", e$message), stderr())
    create_error(paste("ANOVA calculation failed:", e$message))
  })
}


# Kruskal-Wallis test with epsilon squared
kruskal_wallis <- function(nominal_data, ordinal_data) {
  tryCatch({
    # Ensure we have vectors (not lists)
    nominal_data <- unlist(nominal_data)
    ordinal_data <- unlist(ordinal_data)
    
    # CRITICAL: Ensure ordinal_data is numeric
    ordinal_data <- as.numeric(ordinal_data)
    
    # Create data frame
    df <- data.frame(
      group = factor(nominal_data),
      value = ordinal_data
    )


    # Perform Kruskal-Wallis test
    kw_result <- kruskal.test(value ~ group, data = df)


    # Calculate epsilon squared (effect size)
    n <- length(ordinal_data)
    k <- length(unique(nominal_data))
    h_statistic <- as.numeric(kw_result$statistic)
    epsilon_squared <- (h_statistic - k + 1) / (n - k)


    # Ensure epsilon squared is between 0 and 1
    epsilon_squared <- max(0, min(1, epsilon_squared))


    list(
      method_name = "Kruskal-Wallis test with epsilon squared",
      result = list(
        statistic = as.numeric(kw_result$statistic),
        h_statistic = as.numeric(kw_result$statistic),
        p_value = as.numeric(kw_result$p.value),
        epsilon_squared = as.numeric(epsilon_squared),
        effect_size = as.numeric(epsilon_squared),
        effect_size_name = "ε²",
        df = as.numeric(kw_result$parameter),
        interpretation = paste0(
          "H(", kw_result$parameter, ") = ", round(kw_result$statistic, 2),
          ", p = ", round(kw_result$p.value, 4), ". ",
          "ε² = ", round(epsilon_squared, 3), " (",
          ifelse(epsilon_squared < 0.04, "small",
                 ifelse(epsilon_squared < 0.16, "medium", "large")),
          " effect size). ",
          ifelse(kw_result$p.value < 0.05,
                 "Significant group differences detected (p < 0.05)",
                 "No significant group differences (p >= 0.05)")
        )
      )
    )
  }, error = function(e) {
    create_error(paste("Kruskal-Wallis test failed:", e$message))
  })
}


# Main execution
tryCatch({
  # Open log file for debugging
  log_file <- file("C:/Users/chris/Desktop/HIS-Project-WiSe25-26/backend/r_debug.log", open="wt")
  sink(log_file, type="message")
  
  # Read JSON input from stdin
  input_json <- readLines("stdin", warn = FALSE)
  input_data <- fromJSON(input_json)


  # Extract variables
  var1 <- input_data$variable1
  var2 <- input_data$variable2
  method <- input_data$method
  missing_method <- if (!is.null(input_data$missing_method)) input_data$missing_method else "remove"
  
  # Debug: Log received data
  write("=== INPUT DEBUG ===", stderr())
  write(paste("Method:", method), stderr())
  write(paste("Var1 type:", var1$type, "| columnName:", var1$columnName), stderr())
  write(paste("Var1 ordering is.null:", is.null(var1$ordering), "| class:", class(var1$ordering)[1]), stderr())
  if (!is.null(var1$ordering)) {
    write(paste("Var1 ordering length:", length(var1$ordering)), stderr())
    write(paste("Var1 ordering names:", paste(names(var1$ordering)[1:min(3, length(var1$ordering))], collapse=", ")), stderr())
    write(paste("Var1 ordering values:", paste(unlist(var1$ordering)[1:min(3, length(var1$ordering))], collapse=", ")), stderr())
  }
  write(paste("Var2 type:", var2$type, "| columnName:", var2$columnName), stderr())
  write(paste("Var2 ordering is.null:", is.null(var2$ordering), "| class:", class(var2$ordering)[1]), stderr())
  if (!is.null(var2$ordering)) {
    write(paste("Var2 ordering length:", length(var2$ordering)), stderr())
    write(paste("Var2 ordering names:", paste(names(var2$ordering)[1:min(3, length(var2$ordering))], collapse=", ")), stderr())
    write(paste("Var2 ordering values:", paste(unlist(var2$ordering)[1:min(3, length(var2$ordering))], collapse=", ")), stderr())
  }
  write(paste("Sample var1 data:", paste(head(var1$data, 3), collapse=", ")), stderr())
  write(paste("Sample var2 data:", paste(head(var2$data, 3), collapse=", ")), stderr())
  write("===================", stderr())


  # Handle missing values using specified method
  cleaned <- handle_missing_values(var1$data, var2$data, missing_method, var1$type, var1$ordering, var2$type, var2$ordering)
  data1_clean <- cleaned$data1
  data2_clean <- cleaned$data2
  removed_rows <- cleaned$removed
  missing_category_count <- if (!is.null(cleaned$missing_category_count)) cleaned$missing_category_count else 0


  # Update ordering if it was modified (e.g., by missing_category method)
  if (!is.null(cleaned$ordering1)) {
    var1$ordering <- cleaned$ordering1
  }
  if (!is.null(cleaned$ordering2)) {
    var2$ordering <- cleaned$ordering2
  }


  # Check if enough data remains
  if (length(data1_clean) < 3) {
    output <- create_error("Insufficient data after removing missing values (need at least 3 observations)")
    cat(toJSON(output, auto_unbox = TRUE))
    quit(status = 1)
  }


  # Apply ordinal ordering if needed
  if (var1$type == "ordinal") {
    write(paste("Main Debug - Before apply_ordering var1 - data1_clean sample:", paste(head(data1_clean, 3), collapse=", ")), stderr())
    data1_processed <- apply_ordering(data1_clean, var1$ordering)
    write(paste("Main Debug - After apply_ordering var1 - is.numeric:", is.numeric(data1_processed)), stderr())
    write(paste("Main Debug - After apply_ordering var1 - class:", class(data1_processed)[1]), stderr())
    write(paste("Main Debug - After apply_ordering var1 - typeof:", typeof(data1_processed)), stderr())
    write(paste("Main Debug - After apply_ordering var1 - sample:", paste(head(data1_processed, 3), collapse=", ")), stderr())
    # Check for NAs introduced by ordering
    if (any(is.na(data1_processed))) {
      na_count <- sum(is.na(data1_processed))
      output <- create_error(paste0("Variable 1 ordering failed: ", na_count, " values could not be mapped to the provided ordering. Check category names."))
      cat(toJSON(output, auto_unbox = TRUE))
      quit(status = 1)
    }
  } else {
    data1_processed <- data1_clean
  }


  if (var2$type == "ordinal") {
    write(paste("Main Debug - Before apply_ordering var2 - data2_clean sample:", paste(head(data2_clean, 3), collapse=", ")), stderr())
    data2_processed <- apply_ordering(data2_clean, var2$ordering)
    write(paste("Main Debug - After apply_ordering var2 - is.numeric:", is.numeric(data2_processed)), stderr())
    write(paste("Main Debug - After apply_ordering var2 - class:", class(data2_processed)[1]), stderr())
    write(paste("Main Debug - After apply_ordering var2 - typeof:", typeof(data2_processed)), stderr())
    write(paste("Main Debug - After apply_ordering var2 - sample:", paste(head(data2_processed, 3), collapse=", ")), stderr())
    # Check for NAs introduced by ordering
    if (any(is.na(data2_processed))) {
      na_count <- sum(is.na(data2_processed))
      output <- create_error(paste0("Variable 2 ordering failed: ", na_count, " values could not be mapped to the provided ordering. Check category names."))
      cat(toJSON(output, auto_unbox = TRUE))
      quit(status = 1)
    }
  } else {
    data2_processed <- data2_clean
  }


  # Execute the appropriate method
  result <- switch(method,
    "chi_square" = chi_square_test(data1_processed, data2_processed),
    "phi" = phi_coefficient(data1_processed, data2_processed),
    "cramers_v" = cramers_v(data1_processed, data2_processed),
    "spearman" = spearman_correlation(data1_processed, data2_processed),
    "kendall_tau" = kendall_tau(data1_processed, data2_processed),
    "somers_d" = somers_d(data1_processed, data2_processed),
    "pearson_ordinal" = pearson_ordinal(data1_processed, data2_processed),
    "anova_eta" = {
      # Determine which variable is nominal and which is ordinal
      # ANOVA needs: nominal (categorical/factor) vs ordinal (numeric)
      write(paste("Main Debug - var1 type:", var1$type, "| var2 type:", var2$type), stderr())
      write(paste("Main Debug - data1_processed is.numeric:", is.numeric(data1_processed), 
                  "| data2_processed is.numeric:", is.numeric(data2_processed)), stderr())
      write(paste("Main Debug - data1_processed class:", class(data1_processed)[1], 
                  "| data2_processed class:", class(data2_processed)[1]), stderr())
      
      if (var1$type == "nominal" && var2$type == "ordinal") {
        # data1_processed is nominal (non-numeric), data2_processed is ordinal (numeric)
        write("Main Debug - Calling anova_eta(data1=nominal, data2=ordinal)", stderr())
        anova_eta(data1_processed, data2_processed)
      } else {
        # data2_processed is nominal (non-numeric), data1_processed is ordinal (numeric)
        write("Main Debug - Calling anova_eta(data2=nominal, data1=ordinal)", stderr())
        anova_eta(data2_processed, data1_processed)
      }
    },
    "kruskal_wallis" = {
      # Determine which variable is nominal and which is ordinal
      # Kruskal-Wallis needs: nominal (categorical/factor) vs ordinal (numeric)
      if (var1$type == "nominal" && var2$type == "ordinal") {
        # data1_processed is nominal (non-numeric), data2_processed is ordinal (numeric)
        kruskal_wallis(data1_processed, data2_processed)
      } else {
        # data2_processed is nominal (non-numeric), data1_processed is ordinal (numeric)
        kruskal_wallis(data2_processed, data1_processed)
      }
    },
    create_error(paste("Unknown method:", method))
  )


  # Add metadata to result
  if (!"error" %in% names(result)) {
    result$sample_size <- length(data1_clean)
    result$removed_rows <- removed_rows
    result$missing_category_rows <- missing_category_count
  }


  # Output result as JSON
  cat(toJSON(result, auto_unbox = TRUE))
  
  # Close log file
  sink(type="message")
  close(log_file)

}, error = function(e) {
  # Handle any unexpected errors
  error_output <- create_error(paste("Unexpected error:", e$message))
  cat(toJSON(error_output, auto_unbox = TRUE))
  
  # Close log file if open
  tryCatch({
    sink(type="message")
    if (exists("log_file")) close(log_file)
  }, error = function(e2) {})
  
  quit(status = 1)
})



