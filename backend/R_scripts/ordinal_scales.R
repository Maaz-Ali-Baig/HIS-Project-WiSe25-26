# Ordinal Scale Detection and Preset Definitions for R
# Provides utilities to detect and apply common ordinal scales to categorical data

# ============================================================================
# ORDINAL SCALE PRESETS
# ============================================================================

ORDINAL_PRESETS <- list(
  # Numeric scales (3-point)
  numeric_3 = c("1", "2", "3"),
  level_3_low_high = c("low", "medium", "high"),
  
  # Numeric scales (4-point)
  numeric_4 = c("1", "2", "3", "4"),
  quality_4 = c("poor", "fair", "good", "excellent"),
  quality_4_alt = c("poor", "average", "good", "excellent"),
  usage_4 = c("not at all", "low", "medium", "high"),
  intensity_4 = c("none", "low", "medium", "high"),
  risk_4 = c("low", "medium", "high", "extreme"),
  urgency_4 = c("low", "medium", "high", "immediate"),
  priority_4 = c("low", "medium", "high", "critical"),
  difficulty_4 = c("simple", "moderate", "complex", "very complex"),
  compliance_4 = c("non-compliant", "partially compliant", "mostly compliant", "fully compliant"),
  agreement_4_no_neutral = c("strongly disagree", "disagree", "agree", "strongly agree"),
  
  # Numeric scales (5-point)
  numeric_5 = c("1", "2", "3", "4", "5"),
  level_5 = c("very low", "low", "medium", "high", "very high"),
  quality_5 = c("poor", "fair", "good", "very good", "excellent"),
  performance_5 = c("very poor", "poor", "average", "good", "excellent"),
  risk_5 = c("very low", "low", "medium", "high", "very high"),
  severity_5 = c("none", "low", "medium", "high", "critical"),
  severity_5_alt = c("trivial", "minor", "major", "severe", "critical"),
  impact_5 = c("none", "low", "medium", "high", "very high"),
  confidence_5 = c("very low", "low", "medium", "high", "very high"),
  certainty_5 = c("very uncertain", "uncertain", "neutral", "certain", "very certain"),
  probability_5 = c("very unlikely", "unlikely", "possible", "likely", "very likely"),
  difficulty_5 = c("very easy", "easy", "medium", "hard", "very hard"),
  effort_5 = c("very low", "low", "medium", "high", "very high"),
  reliability_5 = c("very low", "low", "medium", "high", "very high"),
  magnitude_5 = c("negligible", "minor", "moderate", "major", "extreme"),
  maturity_5 = c("initial", "managed", "defined", "quantitatively managed", "optimizing"),
  pain_5 = c("none", "mild", "moderate", "severe", "unbearable"),
  health_5 = c("very poor", "poor", "fair", "good", "excellent"),
  
  # Likert agreement scales
  agreement_5 = c("strongly disagree", "disagree", "neutral", "agree", "strongly agree"),
  agreement_7 = c("strongly disagree", "disagree", "somewhat disagree", "neutral", 
                  "somewhat agree", "agree", "strongly agree"),
  
  # Satisfaction scales
  satisfaction_5 = c("very dissatisfied", "dissatisfied", "neutral", "satisfied", "very satisfied"),
  happiness_5 = c("very unhappy", "unhappy", "neutral", "happy", "very happy"),
  nps_5 = c("very unlikely", "unlikely", "neutral", "likely", "very likely"),
  
  # Frequency scales
  frequency_5 = c("never", "rarely", "sometimes", "often", "always"),
  frequency_6 = c("never", "very rarely", "rarely", "sometimes", "often", "always"),
  
  # Numeric scales (7-point and 10-point)
  numeric_7 = c("1", "2", "3", "4", "5", "6", "7"),
  numeric_10_0 = c("0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"),
  numeric_10_1 = c("1", "2", "3", "4", "5", "6", "7", "8", "9", "10"),
  
  # Progress/Status
  progress_3 = c("not started", "in progress", "completed"),
  progress_5 = c("not started", "started", "in progress", "nearly done", "completed"),
  ticket_4 = c("open", "in progress", "resolved", "closed"),
  phase_5 = c("planning", "design", "development", "testing", "deployment"),
  
  # Priority
  priority_3 = c("low", "medium", "high"),
  priority_p_levels = c("p4", "p3", "p2", "p1"),
  
  # Education/Seniority
  education_6 = c("primary", "secondary", "high school", "bachelor", "master", "doctorate"),
  seniority_5 = c("junior", "mid", "senior", "lead", "principal"),
  experience_4 = c("beginner", "intermediate", "advanced", "expert"),
  
  # Sizes
  sizes_6 = c("xs", "s", "m", "l", "xl", "xxl"),
  
  # Star ratings
  stars_5 = c("1 star", "2 stars", "3 stars", "4 stars", "5 stars")
)

# ============================================================================
# DETECTION FUNCTIONS
# ============================================================================

normalize_value <- function(value) {
  if (is.na(value) || is.null(value)) return("")
  tolower(trimws(as.character(value)))
}

detect_numeric_scale <- function(values) {
  # Try to convert to numbers
  numeric_values <- suppressWarnings(as.numeric(gsub(",", "", values)))
  
  if (all(is.na(numeric_values))) {
    return(NULL)
  }
  
  # Get unique sorted values
  unique_sorted <- sort(unique(numeric_values[!is.na(numeric_values)]))
  unique_count <- length(unique_sorted)
  
  if (unique_count == 0 || unique_count > 20) {
    return(NULL)
  }
  
  min_val <- min(unique_sorted)
  max_val <- max(unique_sorted)
  
  # Check for continuous ranges
  is_continuous <- (max_val - min_val == unique_count - 1)
  
  if (is_continuous) {
    ordered <- as.character(unique_sorted)
    
    if (unique_count == 3 && min_val == 1) {
      return(list(preset_name = "numeric_3", levels = ordered))
    } else if (unique_count == 4 && min_val == 1) {
      return(list(preset_name = "numeric_4", levels = ordered))
    } else if (unique_count == 5 && min_val == 1) {
      return(list(preset_name = "numeric_5", levels = ordered))
    } else if (unique_count == 7 && min_val == 1) {
      return(list(preset_name = "numeric_7", levels = ordered))
    } else if (unique_count == 10 && min_val == 1) {
      return(list(preset_name = "numeric_10_1", levels = ordered))
    } else if (unique_count == 11 && min_val == 0 && max_val == 10) {
      return(list(preset_name = "numeric_10_0", levels = ordered))
    } else {
      return(list(preset_name = "numeric_custom", levels = ordered))
    }
  }
  
  NULL
}

detect_ordinal_preset <- function(values) {
  if (length(values) == 0) return(NULL)
  
  # Remove NA and normalize
  values <- values[!is.na(values)]
  normalized_values <- unique(sapply(values, normalize_value))
  normalized_values <- normalized_values[nchar(normalized_values) > 0]
  
  if (length(normalized_values) == 0) return(NULL)
  
  # Try numeric detection first
  numeric_result <- detect_numeric_scale(values)
  if (!is.null(numeric_result)) {
    return(numeric_result)
  }
  
  # Try to match against presets
  for (preset_name in names(ORDINAL_PRESETS)) {
    preset_levels <- ORDINAL_PRESETS[[preset_name]]
    normalized_preset <- sapply(preset_levels, normalize_value)
    
    # Check if all values are in the preset
    if (all(normalized_values %in% normalized_preset)) {
      # Return in the order defined by preset, filtered to actual values
      ordered <- preset_levels[normalized_preset %in% normalized_values]
      return(list(preset_name = preset_name, levels = ordered))
    }
  }
  
  NULL
}

get_column_order <- function(values, column_name = NULL) {
  result <- detect_ordinal_preset(values)
  
  if (!is.null(result)) {
    return(list(
      is_ordinal = TRUE,
      preset_name = result$preset_name,
      levels = result$levels,
      detection_method = if (grepl("numeric", result$preset_name)) "numeric" else "preset"
    ))
  }
  
  # Check if column name suggests ordering
  if (!is.null(column_name)) {
    name_lower <- tolower(column_name)
    keywords <- c("priority", "severity", "risk", "level", "stage", "phase", "order", "rank")
    
    if (any(sapply(keywords, function(k) grepl(k, name_lower)))) {
      return(list(
        is_ordinal = FALSE,
        preset_name = NULL,
        levels = sort(unique(values)),
        detection_method = "suggested",
        note = "Column name suggests ordinal data. Consider setting manual order."
      ))
    }
  }
  
  NULL
}

get_neutral_point <- function(levels, preset_name = NULL) {
  normalized_levels <- sapply(levels, normalize_value)
  
  # Look for explicit neutral keywords
  neutral_keywords <- c("neutral", "neither", "undecided", "unsure", "moderate")
  
  for (i in seq_along(normalized_levels)) {
    if (any(sapply(neutral_keywords, function(k) grepl(k, normalized_levels[i])))) {
      return(levels[i])  # Return the actual value, not index
    }
  }
  
  # For odd-numbered scales without explicit neutral, use middle
  if (length(levels) %% 2 == 1) {
    return(levels[ceiling(length(levels) / 2)])
  }
  
  NULL
}

apply_ordinal_factor <- function(x, levels) {
  # Convert to factor with specified levels
  factor(x, levels = levels, ordered = TRUE)
}
