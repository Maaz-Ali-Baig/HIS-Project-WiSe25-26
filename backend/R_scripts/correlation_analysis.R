
# Correlation Analysis R Script
# This script performs various correlation analyses for nominal and ordinal variables
# Input: JSON via stdin
# Output: JSON to stdout

# Suppress ALL warnings, messages, and output
options(warn = -1)
invisible(suppressMessages({
  # Load required libraries
  library(jsonlite)

  # Try to load optional packages, continue if not available
  tryCatch({
    library(vcd)
  }, error = function(e) {})

  tryCatch({
    library(DescTools)
  }, error = function(e) {})

  tryCatch({
    library(psych)
  }, error = function(e) {})
}))

# Optional fast backend
use_data_table <- requireNamespace("data.table", quietly = TRUE)

# Helper function to create error response
create_error <- function(message) {
  list(error = message)
}

# Fast mode calculation with optional data.table backend
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
  if (length(tab) == 0) {
    return(NA_character_)
  }
  names(tab)[which.max(tab)]
}

unique_n <- function(x) {
  if (use_data_table) {
    return(data.table::uniqueN(x))
  }
  length(unique(x))
}

make_contingency_table <- function(x, y) {
  valid <- !is.na(x) & !is.na(y)
  x <- x[valid]
  y <- y[valid]
  if (use_data_table) {
    dt <- data.table::data.table(x = x, y = y)
    counts <- dt[, .N, by = .(x, y)]
    cast <- data.table::dcast(counts, x ~ y, value.var = "N", fill = 0)
    rownames(cast) <- cast[[1L]]
    return(as.matrix(cast[, -1, with = FALSE]))
  }
  table(x, y)
}

# Helper function to handle missing values based on specified method
# Methods: "remove", "mode", "median", "missing_category"
handle_missing_values <- function(data1, data2, method = "remove", var1_type = NULL, var1_ordering = NULL, var2_type = NULL, var2_ordering = NULL) {
  # Identify missing values (NA and empty strings)
  missing1 <- is.na(data1) | data1 == ""
  missing2 <- is.na(data2) | data2 == ""

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
      mode_val1 <- fast_mode(data1, missing1)
      data1[missing1] <- mode_val1
    }
    if (any(missing2)) {
      mode_val2 <- fast_mode(data2, missing2)
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
        ordering_map <- unlist(var1_ordering, use.names = TRUE)
        numeric_vals <- ordering_map[as.character(data1[!missing1])]
        median_val <- median(numeric_vals, na.rm = TRUE)
        # Find closest category
        ordering_vals <- as.numeric(ordering_map)
        closest_cat <- names(ordering_map)[which.min(abs(ordering_vals - median_val))]
        data1[missing1] <- closest_cat
      } else {
        # Fall back to mode for nominal
        mode_val1 <- fast_mode(data1, missing1)
        data1[missing1] <- mode_val1
      }
    }
    if (any(missing2)) {
      # For data2, always use mode (we don't have var2_type/ordering in this function)
      mode_val2 <- fast_mode(data2, missing2)
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

# Helper function to remove rows with missing values in both columns (DEPRECATED - use handle_missing_values)
# Only removes actual NA/NaN and empty strings, not string literals like "NA"
clean_data <- function(data1, data2) {
  valid_indices <- !is.na(data1) & !is.na(data2) & data1 != "" & data2 != ""
  list(
    data1 = data1[valid_indices],
    data2 = data2[valid_indices],
    removed = sum(!valid_indices)
  )
}

# Helper function to apply ordinal ordering
apply_ordering <- function(data, ordering) {
  if (is.null(ordering) || length(ordering) == 0) {
    # If no ordering provided, create natural ordering from unique values
    return(as.numeric(factor(data)))
  }

  # Create ordered factor based on provided ordering
  ordering_map <- unlist(ordering, use.names = TRUE)
  numeric_data <- as.numeric(ordering_map[as.character(data)])

  # Check if we have NAs from unmapped values
  if (any(is.na(numeric_data))) {
    # Get unique values not in ordering
    unmapped_vals <- unique(data[is.na(numeric_data)])
    warning(paste("Some values not found in ordering:", paste(unmapped_vals, collapse = ", ")))
  }

  return(numeric_data)
}

# Chi-square test of independence
chi_square_test <- function(data1, data2) {
  tryCatch({
    contingency_table <- make_contingency_table(data1, data2)
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
    contingency_table <- make_contingency_table(data1, data2)

    # Check if 2x2 table
    if (nrow(contingency_table) != 2 || ncol(contingency_table) != 2) {
      return(create_error("Phi coefficient requires a 2x2 contingency table"))
    }

    test_result <- chisq.test(contingency_table)
    chi_sq <- test_result$statistic
    n <- sum(contingency_table)
    phi <- sqrt(chi_sq / n)

    # Calculate p-value from chi-square
    p_value <- test_result$p.value

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
    contingency_table <- make_contingency_table(data1, data2)
    test_result <- chisq.test(contingency_table)
    chi_sq <- test_result$statistic
    n <- sum(contingency_table)
    min_dim <- min(nrow(contingency_table) - 1, ncol(contingency_table) - 1)

    cramers_v_value <- sqrt(chi_sq / (n * min_dim))
    p_value <- test_result$p.value

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
    if (unique_n(data1_clean) < 2 || unique_n(data2_clean) < 2) {
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
    n <- length(data1)
    if (n < 2) {
      return(create_error("Insufficient data for Somers' D (need at least 2 observations)"))
    }

    if (requireNamespace("DescTools", quietly = TRUE)) {
      res <- tryCatch(DescTools::SomersDelta(data1, data2), error = function(e) NULL)
      if (!is.null(res)) {
        somers_d_value <- if (!is.null(res$estimate)) {
          as.numeric(res$estimate)
        } else if (!is.null(res$delta)) {
          as.numeric(res$delta)
        } else if (!is.null(res$statistic)) {
          as.numeric(res$statistic)
        } else {
          as.numeric(res)
        }
        p_value <- if (!is.null(res$p.value)) as.numeric(res$p.value) else NA_real_
        se <- sqrt((4 * n + 10) / (9 * n * (n - 1)))
        z_value <- if (se > 0) somers_d_value / se else 0
        if (is.na(p_value)) {
          p_value <- 2 * pnorm(-abs(z_value))
        }
        return(list(
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
        ))
      }
    }

    # Somers' D implementation using concordant and discordant pairs (fallback)
    n <- length(data1)
    concordant <- 0
    discordant <- 0
    ties_x <- 0
    ties_y <- 0

    for (i in 1:(n-1)) {
      for (j in (i+1):n) {
        x_diff <- sign(data1[i] - data1[j])
        y_diff <- sign(data2[i] - data2[j])

        if (x_diff * y_diff > 0) {
          concordant <- concordant + 1
        } else if (x_diff * y_diff < 0) {
          discordant <- discordant + 1
        } else if (x_diff == 0 && y_diff != 0) {
          ties_x <- ties_x + 1
        } else if (y_diff == 0 && x_diff != 0) {
          ties_y <- ties_y + 1
        }
      }
    }

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
    # Create data frame
    df <- data.frame(
      group = factor(nominal_data),
      value = ordinal_data
    )

    # Perform ANOVA
    anova_result <- aov(value ~ group, data = df)
    anova_summary <- summary(anova_result)

    # Calculate eta squared
    ss_between <- anova_summary[[1]]$"Sum Sq"[1]
    ss_total <- sum(anova_summary[[1]]$"Sum Sq")
    eta_squared <- ss_between / ss_total

    # Get F-statistic and p-value
    f_statistic <- anova_summary[[1]]$"F value"[1]
    p_value <- anova_summary[[1]]$"Pr(>F)"[1]

    list(
      method_name = "One-way ANOVA with eta squared",
      result = list(
        statistic = as.numeric(f_statistic),
        f_statistic = as.numeric(f_statistic),
        p_value = as.numeric(p_value),
        eta_squared = as.numeric(eta_squared),
        effect_size = as.numeric(eta_squared),
        effect_size_name = "η²",
        df = as.numeric(anova_summary[[1]]$Df[1]),
        df_between = as.numeric(anova_summary[[1]]$Df[1]),
        df_within = as.numeric(anova_summary[[1]]$Df[2]),
        interpretation = paste0(
          "F(", anova_summary[[1]]$Df[1], ", ", anova_summary[[1]]$Df[2], ") = ",
          round(f_statistic, 2), ", p = ", round(p_value, 4), ". ",
          "η² = ", round(eta_squared, 3), " (",
          ifelse(eta_squared < 0.06, "small",
                 ifelse(eta_squared < 0.14, "medium", "large")),
          " effect size). ",
          ifelse(p_value < 0.05,
                 "Significant group differences detected (p < 0.05)",
                 "No significant group differences (p >= 0.05)")
        )
      )
    )
  }, error = function(e) {
    create_error(paste("ANOVA calculation failed:", e$message))
  })
}

# Kruskal-Wallis test with epsilon squared
kruskal_wallis <- function(nominal_data, ordinal_data) {
  tryCatch({
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
  # Read JSON input from stdin
  input_json <- readLines("stdin", warn = FALSE)
  input_data <- fromJSON(input_json)

  # Extract variables
  var1 <- input_data$variable1
  var2 <- input_data$variable2
  method <- input_data$method
  missing_method <- if (!is.null(input_data$missing_method)) input_data$missing_method else "remove"

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
    data1_processed <- apply_ordering(data1_clean, var1$ordering)
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
    data2_processed <- apply_ordering(data2_clean, var2$ordering)
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
      if (var1$type == "nominal" && var2$type == "ordinal") {
        anova_eta(data1_processed, data2_processed)
      } else {
        anova_eta(data2_processed, data1_processed)
      }
    },
    "kruskal_wallis" = {
      # Determine which variable is nominal and which is ordinal
      if (var1$type == "nominal" && var2$type == "ordinal") {
        kruskal_wallis(data1_processed, data2_processed)
      } else {
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

}, error = function(e) {
  # Handle any unexpected errors
  error_output <- create_error(paste("Unexpected error:", e$message))
  cat(toJSON(error_output, auto_unbox = TRUE))
  quit(status = 1)
})
