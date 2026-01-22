# Correlation Analysis R Script - OPTIMIZED VERSION
# This script performs various correlation analyses for nominal and ordinal variables
# Input: JSON via stdin
# Output: JSON to stdout

# Suppress ALL warnings, messages, and output
options(warn = -1)
invisible(suppressMessages({
  # Load required libraries
  library(jsonlite)
  library(data.table)
}))

# ==============================================================================
# PERFORMANCE CONFIGURATION
# ==============================================================================

# Enable multi-threading for maximum performance
# setDTthreads(0) uses all available CPU cores
old_threads <- getDTthreads()
setDTthreads(0)  # Use all available cores for parallel processing

# Restore thread count on exit
on.exit(setDTthreads(old_threads), add = TRUE)

# Optional: Print thread configuration for monitoring
# write(paste("data.table threads:", getDTthreads()), stderr())

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

# Helper function to create error response
create_error <- function(message) {
  list(error = message)
}

# Helper function to check if a value is NA (including string representations)
# OPTIMIZED: Using %chin% for character vector matching (faster than %in%)
is_na_value <- function(x) {
  # Check for standard R NA and NULL
  if (is.na(x) || is.null(x)) {
    return(TRUE)
  }

  # Check for empty strings and common string representations of missing values
  if (is.character(x)) {
    # Trim whitespace and convert to lowercase for comparison
    x_trimmed <- tolower(trimws(x))
    # OPTIMIZED: Using %chin% instead of %in% for character vectors (10-50x faster)
    missing_tokens <- c("", "na", "n/a", "nan", "none", "null", "nil",
                        "#n/a", "#na", "missing", "n.a.", "<na>")
    return(x_trimmed %chin% missing_tokens)
  }

  return(FALSE)
}

# Helper function to handle missing values based on specified method
# OPTIMIZED: Vectorized operations, pre-allocated vectors
handle_missing_values <- function(data1, data2, method = "remove", var1_type = NULL, var1_ordering = NULL, var2_type = NULL, var2_ordering = NULL) {
  # OPTIMIZED: Vectorized NA detection using sapply (already optimal for this use case)
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
    # OPTIMIZED: Using data.table for frequency counting (faster than base table())
    if (any(missing1)) {
      dt1 <- data.table(val = data1[!missing1])
      mode_val1 <- dt1[, .N, by = val][order(-N)][1, val]
      data1[missing1] <- mode_val1
    }
    if (any(missing2)) {
      dt2 <- data.table(val = data2[!missing2])
      mode_val2 <- dt2[, .N, by = val][order(-N)][1, val]
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
        # OPTIMIZED: Vectorized mapping using named vector for O(1) lookup
        ordering_vec <- unlist(var1_ordering)
        numeric_vals <- ordering_vec[data1[!missing1]]
        median_val <- median(numeric_vals, na.rm = TRUE)
        # Find closest category
        closest_cat <- names(ordering_vec)[which.min(abs(ordering_vec - median_val))]
        data1[missing1] <- closest_cat
      } else {
        # Fall back to mode for nominal
        dt1 <- data.table(val = data1[!missing1])
        mode_val1 <- dt1[, .N, by = val][order(-N)][1, val]
        data1[missing1] <- mode_val1
      }
    }
    if (any(missing2)) {
      dt2 <- data.table(val = data2[!missing2])
      mode_val2 <- dt2[, .N, by = val][order(-N)][1, val]
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

    # For ordinal variables, mark rows with "Missing" category for removal
    rows_with_missing_category <- rep(FALSE, length(data1))

    if (!is.null(var1_type) && var1_type == "ordinal" && any(missing1)) {
      rows_with_missing_category <- rows_with_missing_category | (data1 == "Missing")
    }

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
# OPTIMIZED: Using named vector for O(1) lookup instead of iterative matching
apply_ordering <- function(data, ordering) {
  write("=== APPLY_ORDERING DEBUG ===", stderr())
  write(paste("Input data length:", length(data)), stderr())
  write(paste("Input data class:", class(data)[1]), stderr())
  write(paste("Sample input data:", paste(head(data, 3), collapse=", ")), stderr())
  write(paste("Ordering is.null:", is.null(ordering)), stderr())

  # Handle NULL, empty list, or empty named list
  if (is.null(ordering) || length(ordering) == 0 || (is.list(ordering) && length(names(ordering)) == 0)) {
    write("No ordering provided, creating natural ordering", stderr())
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

  # OPTIMIZED: Create named vector for O(1) lookup (much faster than iterative matching)
  ordering_vec <- unlist(ordering)

  # OPTIMIZED: Vectorized lookup using named vector indexing
  ordered_data <- ordering_vec[data]

  # Convert to numeric
  numeric_data <- as.numeric(ordered_data)

  # Check if we have NAs from unmapped values
  if (any(is.na(numeric_data))) {
    unmapped_vals <- unique(data[is.na(numeric_data)])
    write(paste("WARNING: Some values not found in ordering:", paste(unmapped_vals, collapse=", ")), stderr())
  }

  write(paste("Output - is.numeric:", is.numeric(numeric_data)), stderr())
  write(paste("Sample output:", paste(head(numeric_data, 3), collapse=", ")), stderr())
  write("============================", stderr())
  return(numeric_data)
}

# ==============================================================================
# STATISTICAL TEST FUNCTIONS
# ==============================================================================

# Chi-square test of independence
# OPTIMIZED: Uses base R table() which is already well-optimized
chi_square_test <- function(data1, data2) {
  tryCatch({
    contingency_table <- table(data1, data2)
    test_result <- chisq.test(contingency_table)

    # Calculate Cramer's V as effect size
    chi_sq <- test_result$statistic
    n <- sum(contingency_table)
    min_dim <- min(nrow(contingency_table) - 1, ncol(contingency_table) - 1)
    cramers_v_value <- sqrt(chi_sq / (n * min_dim))

    # OPTIMIZED: Using fifelse() would not apply here as we're not doing vectorized conditionals
    list(
      method_name = "Chi-square test of independence",
      result = list(
        statistic = as.numeric(test_result$statistic),
        p_value = as.numeric(test_result$p.value),
        df = as.numeric(test_result$parameter),
        effect_size = as.numeric(cramers_v_value),
        effect_size_name = "Cramer's V",
        interpretation = fifelse(
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

    # OPTIMIZED: Vectorized conditional using nested fifelse (faster than nested ifelse)
    effect_label <- fifelse(abs(phi) < 0.1, "Weak", fifelse(abs(phi) < 0.3, "Moderate", "Strong"))
    sig_label <- fifelse(p_value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")

    list(
      method_name = "Phi coefficient",
      result = list(
        statistic = as.numeric(phi),
        p_value = as.numeric(p_value),
        effect_size = as.numeric(phi),
        effect_size_name = "Phi",
        interpretation = paste0(
          "Phi = ", round(phi, 3), ". ",
          effect_label, " association. ", sig_label
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

    # OPTIMIZED: Using fifelse for faster conditional evaluation
    effect_label <- fifelse(cramers_v_value < 0.1, "Weak",
                   fifelse(cramers_v_value < 0.3, "Moderate", "Strong"))
    sig_label <- fifelse(p_value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")

    list(
      method_name = "Cramer's V",
      result = list(
        statistic = as.numeric(cramers_v_value),
        p_value = as.numeric(p_value),
        effect_size = as.numeric(cramers_v_value),
        effect_size_name = "Cramer's V",
        interpretation = paste0(
          "Cramer's V = ", round(cramers_v_value, 3), ". ",
          effect_label, " association. ", sig_label
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
    # Remove any remaining NAs
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

    # OPTIMIZED: Using fifelse for conditional text generation
    effect_label <- fifelse(abs(test_result$estimate) < 0.3, "Weak",
                   fifelse(abs(test_result$estimate) < 0.7, "Moderate", "Strong"))
    direction_label <- fifelse(test_result$estimate > 0, "positive", "negative")
    sig_label <- fifelse(test_result$p.value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")

    list(
      method_name = "Spearman's rank correlation",
      result = list(
        statistic = as.numeric(test_result$estimate),
        p_value = as.numeric(test_result$p.value),
        effect_size = as.numeric(test_result$estimate),
        effect_size_name = "Spearman's ρ",
        interpretation = paste0(
          "Spearman's ρ = ", round(test_result$estimate, 3), ". ",
          effect_label, " ", direction_label, " correlation. ", sig_label
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

    # OPTIMIZED: Using fifelse for conditional labels
    effect_label <- fifelse(abs(test_result$estimate) < 0.3, "Weak",
                   fifelse(abs(test_result$estimate) < 0.7, "Moderate", "Strong"))
    direction_label <- fifelse(test_result$estimate > 0, "positive", "negative")
    sig_label <- fifelse(test_result$p.value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")

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
          effect_label, " ", direction_label, " association. ", sig_label
        )
      )
    )
  }, error = function(e) {
    create_error(paste("Kendall's tau calculation failed:", e$message))
  })
}

# Somers' D
# ALREADY OPTIMIZED: Uses vectorized outer products and matrix operations
somers_d <- function(data1, data2) {
  tryCatch({
    # Optimized Somers' D using vectorized operations
    n <- length(data1)

    # Convert to numeric ranks for faster comparison
    rank_x <- as.numeric(factor(data1))
    rank_y <- as.numeric(factor(data2))

    # HIGHLY OPTIMIZED: Vectorized concordance calculation using matrix operations
    # This is much faster than nested loops (O(n²) complexity but vectorized)
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
    somers_d_value <- fifelse(denominator > 0, (concordant - discordant) / denominator, 0)

    # Approximate p-value using normal approximation
    n_pairs <- n * (n - 1) / 2
    se <- sqrt((4 * n + 10) / (9 * n * (n - 1)))
    z_value <- somers_d_value / se
    p_value <- 2 * pnorm(-abs(z_value))

    # OPTIMIZED: Using fifelse for conditional labels
    effect_label <- fifelse(abs(somers_d_value) < 0.3, "Weak",
                   fifelse(abs(somers_d_value) < 0.7, "Moderate", "Strong"))
    sig_label <- fifelse(p_value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")

    list(
      method_name = "Somers' D",
      result = list(
        statistic = as.numeric(somers_d_value),
        p_value = as.numeric(p_value),
        effect_size = as.numeric(somers_d_value),
        effect_size_name = "Somers' D",
        interpretation = paste0(
          "Somers' D = ", round(somers_d_value, 3), ". ",
          effect_label, " asymmetric association. ", sig_label
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

    # OPTIMIZED: Using fifelse for conditional labels
    effect_label <- fifelse(abs(test_result$estimate) < 0.3, "Weak",
                   fifelse(abs(test_result$estimate) < 0.7, "Moderate", "Strong"))
    direction_label <- fifelse(test_result$estimate > 0, "positive", "negative")
    sig_label <- fifelse(test_result$p.value < 0.05, "Significant (p < 0.05)", "Not significant (p >= 0.05)")

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
          effect_label, " ", direction_label, " linear relationship. ", sig_label
        )
      )
    )
  }, error = function(e) {
    create_error(paste("Pearson correlation failed:", e$message))
  })
}

# One-way ANOVA with eta squared
# OPTIMIZED: Pre-validation and cleaner data handling
anova_eta <- function(nominal_data, ordinal_data) {
  tryCatch({
    write(paste("ANOVA Debug - Nominal data type:", class(nominal_data)[1],
                "| Ordinal data type:", class(ordinal_data)[1]), stderr())
    write(paste("ANOVA Debug - Nominal is.numeric:", is.numeric(nominal_data),
                "| Ordinal is.numeric:", is.numeric(ordinal_data)), stderr())

    # OPTIMIZED: Ensure correct types
    ordinal_data <- as.numeric(if (is.numeric(ordinal_data)) ordinal_data else unlist(ordinal_data))
    nominal_data <- as.character(if (is.character(nominal_data) || is.factor(nominal_data)) nominal_data else unlist(nominal_data))

    # OPTIMIZED: Vectorized NA removal
    valid_nom <- !is.na(nominal_data) & (nchar(trimws(nominal_data)) > 0)
    valid_ord <- !is.na(ordinal_data)
    valid_indices <- valid_nom & valid_ord

    nominal_data <- nominal_data[valid_indices]
    ordinal_data <- ordinal_data[valid_indices]

    # Validation checks
    if (length(nominal_data) < 2 || length(ordinal_data) < 2) {
      return(create_error("Insufficient data after removing NA values (need at least 2 observations)"))
    }

    if (!is.numeric(ordinal_data)) {
      return(create_error(paste0("Ordinal data is not numeric after processing. Type: ", class(ordinal_data)[1])))
    }

    if (length(unique(nominal_data)) < 2) {
      return(create_error("Nominal variable has less than 2 unique groups"))
    }

    # OPTIMIZED: Using data.table for frequency counting (faster than table())
    dt_groups <- data.table(group = nominal_data)
    group_counts <- dt_groups[, .N, by = group]
    groups_with_replication <- group_counts[N > 1, .N]
    total_groups <- nrow(group_counts)

    write(paste("ANOVA Debug - Total groups:", total_groups), stderr())
    write(paste("ANOVA Debug - Groups with >1 observation:", groups_with_replication), stderr())

    if (groups_with_replication < 2) {
      return(create_error(paste0(
        "ANOVA is not appropriate: nominal variable has ", total_groups,
        " groups but only ", groups_with_replication,
        " groups have multiple observations."
      )))
    }

    # Convert nominal to factor
    nominal_data <- as.factor(nominal_data)

    # Create data frame
    df <- data.frame(
      group = nominal_data,
      value = ordinal_data,
      stringsAsFactors = FALSE
    )

    # Perform ANOVA
    anova_result <- aov(value ~ group, data = df)
    anova_summary <- summary(anova_result)

    # Validate summary structure
    has_f_value <- "F value" %chin% names(anova_summary[[1]])
    has_pr_f <- "Pr(>F)" %chin% names(anova_summary[[1]])

    if (!has_f_value || !has_pr_f) {
      return(create_error("ANOVA summary is incomplete. This may occur when there is no within-group variation."))
    }

    # Calculate eta squared
    ss_between <- as.numeric(anova_summary[[1]][1, "Sum Sq"])
    ss_total <- as.numeric(sum(anova_summary[[1]][, "Sum Sq"]))
    eta_squared <- as.numeric(ss_between / ss_total)

    # Extract statistics
    f_statistic <- as.numeric(anova_summary[[1]][1, "F value"])
    p_value <- as.numeric(anova_summary[[1]][1, "Pr(>F)"])
    df_between <- as.numeric(anova_summary[[1]][1, "Df"])
    df_within <- as.numeric(anova_summary[[1]][2, "Df"])

    # OPTIMIZED: Using fifelse for conditional labels
    effect_category <- fifelse(eta_squared < 0.06, "small",
                      fifelse(eta_squared < 0.14, "medium", "large"))
    sig_message <- fifelse(p_value < 0.05,
                  "Significant group differences detected (p < 0.05)",
                  "No significant group differences (p >= 0.05)")

    interpretation_text <- paste0(
      "F(", df_between, ", ", df_within, ") = ",
      round(f_statistic, 2), ", p = ", round(p_value, 4), ". ",
      "η² = ", round(eta_squared, 3), " (",
      effect_category, " effect size). ",
      sig_message
    )

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
    ordinal_data <- as.numeric(unlist(ordinal_data))

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

    # OPTIMIZED: Using fifelse for conditional labels
    effect_label <- fifelse(epsilon_squared < 0.04, "small",
                   fifelse(epsilon_squared < 0.16, "medium", "large"))
    sig_label <- fifelse(kw_result$p.value < 0.05,
                "Significant group differences detected (p < 0.05)",
                "No significant group differences (p >= 0.05)")

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
          effect_label, " effect size). ", sig_label
        )
      )
    )
  }, error = function(e) {
    create_error(paste("Kruskal-Wallis test failed:", e$message))
  })
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

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

  write("=== INPUT DEBUG ===", stderr())
  write(paste("Method:", method), stderr())
  write(paste("Var1 type:", var1$type, "| columnName:", var1$columnName), stderr())
  write(paste("Var2 type:", var2$type, "| columnName:", var2$columnName), stderr())
  write("===================", stderr())

  # Handle missing values using specified method
  cleaned <- handle_missing_values(var1$data, var2$data, missing_method, var1$type, var1$ordering, var2$type, var2$ordering)
  data1_clean <- cleaned$data1
  data2_clean <- cleaned$data2
  removed_rows <- cleaned$removed
  missing_category_count <- if (!is.null(cleaned$missing_category_count)) cleaned$missing_category_count else 0

  # Update ordering if modified
  if (!is.null(cleaned$ordering1)) var1$ordering <- cleaned$ordering1
  if (!is.null(cleaned$ordering2)) var2$ordering <- cleaned$ordering2

  # Check if enough data remains
  if (length(data1_clean) < 3) {
    output <- create_error("Insufficient data after removing missing values (need at least 3 observations)")
    cat(toJSON(output, auto_unbox = TRUE))
    quit(status = 1)
  }

  # Apply ordinal ordering if needed
  if (var1$type == "ordinal") {
    data1_processed <- apply_ordering(data1_clean, var1$ordering)
    if (any(is.na(data1_processed))) {
      na_count <- sum(is.na(data1_processed))
      output <- create_error(paste0("Variable 1 ordering failed: ", na_count, " values could not be mapped."))
      cat(toJSON(output, auto_unbox = TRUE))
      quit(status = 1)
    }
  } else {
    data1_processed <- data1_clean
  }

  if (var2$type == "ordinal") {
    data2_processed <- apply_ordering(data2_clean, var2$ordering)
    if (any(is.na(data2_processed))) {
      na_count <- sum(is.na(data2_processed))
      output <- create_error(paste0("Variable 2 ordering failed: ", na_count, " values could not be mapped."))
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
      write(paste("Main Debug - var1 type:", var1$type, "| var2 type:", var2$type), stderr())
      if (var1$type == "nominal" && var2$type == "ordinal") {
        anova_eta(data1_processed, data2_processed)
      } else {
        anova_eta(data2_processed, data1_processed)
      }
    },
    "kruskal_wallis" = {
      if (var1$type == "nominal" && var2$type == "ordinal") {
        kruskal_wallis(data1_processed, data2_processed)
      } else {
        kruskal_wallis(data2_processed, data1_processed)
      }
    },
    create_error(paste("Unknown method:", method))
  )

  # Add metadata to result
  if (!"error" %chin% names(result)) {
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
  error_output <- create_error(paste("Unexpected error:", e$message))
  cat(toJSON(error_output, auto_unbox = TRUE))

  tryCatch({
    sink(type="message")
    if (exists("log_file")) close(log_file)
  }, error = function(e2) {})

  quit(status = 1)
})
