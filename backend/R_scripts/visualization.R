# Visualization R Script - Comprehensive Categorical & Association Analysis
# Input: JSON via stdin
# Output: JSON to stdout

options(warn = -1)
invisible(suppressMessages({
  library(jsonlite)
}))

# Define stub functions first (will be overridden if ordinal_scales.R loads successfully)
detect_ordinal_preset <- function(values) NULL
get_neutral_point <- function(levels, preset_name = NULL) NULL

# Try to source ordinal scales detection
ordinal_detection_available <- FALSE
tryCatch({
  # Get the directory where this script is located
  script_args <- commandArgs(trailingOnly = FALSE)
  script_path <- sub("--file=", "", script_args[grep("--file=", script_args)])
  if (length(script_path) > 0) {
    script_dir <- dirname(script_path)
    ordinal_path <- file.path(script_dir, "ordinal_scales.R")
    if (file.exists(ordinal_path)) {
      source(ordinal_path, local = FALSE)  # Source into global environment
      ordinal_detection_available <- TRUE
    }
  }
}, error = function(e) {
  # Silent fail - stubs are already defined
})

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

create_error <- function(message) {
  list(error = message)
}

normalize_missing <- function(x) {
  x <- as.character(x)
  # Treat empty strings as NA
  x[x == ""] <- NA
  # Treat various missing value representations as NA (case-insensitive)
  x_upper <- toupper(trimws(x))
  x[x_upper %in% c("NA", "N/A", "MISSING", "NULL", "NONE")] <- NA
  x
}

to_numeric <- function(x) {
  x <- normalize_missing(x)
  x <- gsub(",", "", x)
  suppressWarnings(as.numeric(x))
}

calculate_percents <- function(counts) {
  total <- sum(counts)
  if (total == 0) return(rep(0, length(counts)))
  as.numeric(round((counts / total) * 100, 2))
}

# ============================================================================
# UNIVARIATE CATEGORICAL VISUALIZATIONS
# ============================================================================

build_bar <- function(x, options) {
  include_missing <- isTRUE(options$include_missing)
  x <- normalize_missing(x)
  
  if (include_missing) {
    x[is.na(x)] <- "Missing"
  }
  x <- x[!is.na(x)]
  
  if (length(x) == 0) {
    stop("No valid values available after removing missing values.")
  }
  
  counts <- table(x)
  
  # Check if ordinal (has explicit ordering)
  is_ordinal <- !is.null(options$ordered) && isTRUE(options$ordered)
  
  # Default sort by count desc for nominal
  if (!is_ordinal) {
    counts <- sort(counts, decreasing = TRUE)
  }
  
  percents <- calculate_percents(counts)
  
  list(
    categories = as.character(names(counts)),
    counts = as.integer(counts),
    percents = as.numeric(percents),
    stats = list(
      total = as.integer(sum(counts)),
      unique = as.integer(length(counts))
    )
  )
}

build_topn_bar <- function(x, options) {
  include_missing <- isTRUE(options$include_missing)
  top_n <- options$top_n
  other_label <- if (!is.null(options$other_label)) options$other_label else "Other"
  
  if (is.null(top_n) || is.na(top_n)) {
    top_n <- 10  # Default
  }
  
  x <- normalize_missing(x)
  if (include_missing) {
    x[is.na(x)] <- "Missing"
  }
  x <- x[!is.na(x)]
  
  if (length(x) == 0) {
    stop("No valid values available.")
  }
  
  counts <- table(x)
  counts <- sort(counts, decreasing = TRUE)
  
  if (length(counts) <= top_n) {
    percents <- calculate_percents(counts)
    return(list(
      categories = as.character(names(counts)),
      counts = as.integer(counts),
      percents = as.numeric(percents),
      stats = list(
        total = as.integer(sum(counts)),
        unique = as.integer(length(counts)),
        top_n = as.integer(top_n)
      )
    ))
  }
  
  # Split top N and others
  top_counts <- counts[1:top_n]
  other_sum <- sum(counts[(top_n + 1):length(counts)])
  
  combined_counts <- c(top_counts, other_sum)
  names(combined_counts)[length(combined_counts)] <- other_label
  
  percents <- calculate_percents(combined_counts)
  
  list(
    categories = as.character(names(combined_counts)),
    counts = as.integer(combined_counts),
    percents = as.numeric(percents),
    stats = list(
      total = as.integer(sum(combined_counts)),
      unique = as.integer(length(counts)),
      top_n = as.integer(top_n),
      others_count = as.integer(length(counts) - top_n)
    )
  )
}

build_pareto <- function(x, options) {
  include_missing <- isTRUE(options$include_missing)
  x <- normalize_missing(x)
  
  if (include_missing) {
    x[is.na(x)] <- "Missing"
  }
  x <- x[!is.na(x)]
  
  if (length(x) == 0) {
    stop("No valid values available.")
  }
  
  counts <- table(x)
  counts <- sort(counts, decreasing = TRUE)
  
  percents <- calculate_percents(counts)
  cum_percent <- cumsum(percents)
  
  list(
    categories = as.character(names(counts)),
    counts = as.integer(counts),
    percents = as.numeric(percents),
    cum_percent = as.numeric(cum_percent),
    stats = list(
      total = as.integer(sum(counts)),
      unique = as.integer(length(counts))
    )
  )
}

build_cumulative_percent <- function(x, options) {
  include_missing <- isTRUE(options$include_missing)
  x <- normalize_missing(x)
  
  if (include_missing) {
    x[is.na(x)] <- "Missing"
  }
  x <- x[!is.na(x)]
  
  if (length(x) == 0) {
    stop("No valid values available.")
  }
  
  # Try to detect or use provided ordering
  if (!is.null(options$levels)) {
    level_order <- options$levels
    x <- factor(x, levels = level_order, ordered = TRUE)
  } else {
    # Try auto-detect ordinal scale
    ordinal_info <- tryCatch({
      unique_x <- unique(x)
      detect_ordinal_preset(unique_x)
    }, error = function(e) {
      NULL
    })
    
    if (!is.null(ordinal_info)) {
      # Use detected ordinal scale
      x <- factor(x, levels = ordinal_info$levels, ordered = TRUE)
    } else if (is.factor(x) && is.ordered(x)) {
      # Already ordered factor
    } else {
      # Fallback: assume natural ordering
      x <- factor(x, ordered = TRUE)
    }
  }
  
  counts <- table(x)
  percents <- calculate_percents(counts)
  cum_percent <- cumsum(percents)
  
  list(
    categories = as.character(names(counts)),
    counts = as.integer(counts),
    percents = as.numeric(percents),
    cum_percent = as.numeric(cum_percent),
    stats = list(
      total = as.integer(sum(counts)),
      levels = as.integer(length(counts))
    )
  )
}

build_ordered_bar <- function(x, options) {
  include_missing <- isTRUE(options$include_missing)
  x <- normalize_missing(x)
  
  if (include_missing) {
    x[is.na(x)] <- "Missing"
  }
  x <- x[!is.na(x)]
  
  if (length(x) == 0) {
    stop("No valid values available.")
  }
  
  # Use provided level order or detect
  if (!is.null(options$levels)) {
    level_order <- options$levels
    x <- factor(x, levels = level_order, ordered = TRUE)
  } else {
    # Try auto-detect ordinal scale
    ordinal_info <- tryCatch({
      unique_x <- unique(x)
      detect_ordinal_preset(unique_x)
    }, error = function(e) {
      NULL
    })
    
    if (!is.null(ordinal_info)) {
      # Use detected ordinal scale
      x <- factor(x, levels = ordinal_info$levels, ordered = TRUE)
    } else if (is.factor(x) && is.ordered(x)) {
      # Already ordered
    } else {
      # Try natural ordering
      x <- factor(x, ordered = TRUE)
    }
  }
  
  counts <- table(x)
  percents <- calculate_percents(counts)
  
  list(
    categories = as.character(names(counts)),
    counts = as.integer(counts),
    percents = as.numeric(percents),
    stats = list(
      total = as.integer(sum(counts)),
      levels = as.integer(length(counts))
    )
  )
}

# ============================================================================
# BIVARIATE CATEGORICAL VISUALIZATIONS
# ============================================================================

build_stacked_bar_100 <- function(x, y, options) {
  include_missing <- isTRUE(options$include_missing)
  x <- normalize_missing(x)
  y <- normalize_missing(y)
  
  if (include_missing) {
    x[is.na(x)] <- "Missing"
    y[is.na(y)] <- "Missing"
  }
  
  valid <- !is.na(x) & !is.na(y)
  x <- x[valid]
  y <- y[valid]
  
  if (length(x) == 0) {
    stop("No valid categorical values.")
  }
  
  table_data <- table(x, y)
  x_categories <- rownames(table_data)
  y_categories <- colnames(table_data)
  
  # Normalize to 100% within each x category
  series <- lapply(seq_along(y_categories), function(i) {
    counts <- as.integer(table_data[, i])
    percents <- sapply(seq_along(x_categories), function(j) {
      x_total <- sum(table_data[j, ])
      if (x_total == 0) return(0)
      round((table_data[j, i] / x_total) * 100, 2)
    })
    
    list(
      name = y_categories[i],
      counts = counts,
      percent_within_x = percents
    )
  })
  
  list(
    x_categories = x_categories,
    y_categories = y_categories,
    series = series,
    stats = list(
      total = as.integer(sum(table_data))
    )
  )
}

build_grouped_bar <- function(x, y, options) {
  include_missing <- isTRUE(options$include_missing)
  x <- normalize_missing(x)
  y <- normalize_missing(y)
  
  if (include_missing) {
    x[is.na(x)] <- "Missing"
    y[is.na(y)] <- "Missing"
  }
  
  valid <- !is.na(x) & !is.na(y)
  x <- x[valid]
  y <- y[valid]
  
  if (length(x) == 0) {
    stop("No valid categorical values.")
  }
  
  table_data <- table(x, y)
  x_categories <- rownames(table_data)
  y_categories <- colnames(table_data)
  
  # Calculate percent within x
  series <- lapply(seq_along(y_categories), function(i) {
    counts <- as.integer(table_data[, i])
    percents <- sapply(seq_along(x_categories), function(j) {
      x_total <- sum(table_data[j, ])
      if (x_total == 0) return(0)
      round((table_data[j, i] / x_total) * 100, 2)
    })
    
    list(
      name = y_categories[i],
      counts = counts,
      percent_within_x = percents
    )
  })
  
  list(
    x_categories = x_categories,
    y_categories = y_categories,
    series = series,
    stats = list(
      total = as.integer(sum(table_data))
    )
  )
}

build_contingency_heatmap_percent <- function(x, y, options) {
  include_missing <- isTRUE(options$include_missing)
  percent_mode <- if (!is.null(options$percent_mode)) options$percent_mode else "row"
  
  x <- normalize_missing(x)
  y <- normalize_missing(y)
  
  if (include_missing) {
    x[is.na(x)] <- "Missing"
    y[is.na(y)] <- "Missing"
  }
  
  valid <- !is.na(x) & !is.na(y)
  x <- x[valid]
  y <- y[valid]
  
  if (length(x) == 0) {
    stop("No valid categorical values.")
  }
  
  table_data <- table(x, y)
  counts_matrix <- as.matrix(table_data)
  
  # Calculate percentages based on mode
  if (percent_mode == "row" || percent_mode == "within_x") {
    percent_matrix <- t(apply(counts_matrix, 1, function(row) {
      total <- sum(row)
      if (total == 0) return(rep(0, length(row)))
      round((row / total) * 100, 2)
    }))
  } else if (percent_mode == "col" || percent_mode == "within_y") {
    percent_matrix <- apply(counts_matrix, 2, function(col) {
      total <- sum(col)
      if (total == 0) return(rep(0, length(col)))
      round((col / total) * 100, 2)
    })
  } else {
    # Overall percentage
    total <- sum(counts_matrix)
    percent_matrix <- round((counts_matrix / total) * 100, 2)
  }
  
  # Ensure percent_matrix is a matrix (not a vector)
  if (!is.matrix(percent_matrix)) {
    percent_matrix <- as.matrix(percent_matrix)
  }
  if (!is.matrix(counts_matrix)) {
    counts_matrix <- as.matrix(counts_matrix)
  }
  
  # Convert matrices to list format for JSON
  percent_list <- lapply(seq_len(nrow(percent_matrix)), function(i) {
    as.list(as.numeric(percent_matrix[i, ]))
  })
  names(percent_list) <- as.character(rownames(table_data))
  
  counts_list <- lapply(seq_len(nrow(counts_matrix)), function(i) {
    as.list(as.integer(counts_matrix[i, ]))
  })
  names(counts_list) <- as.character(rownames(table_data))
  
  list(
    x_categories = as.character(rownames(table_data)),
    y_categories = as.character(colnames(table_data)),
    percents = percent_list,
    counts = counts_list,
    percent_mode = as.character(percent_mode),
    stats = list(
      total = as.integer(sum(table_data))
    )
  )
}

build_likert_diverging <- function(x, y, options) {
  include_missing <- isTRUE(options$include_missing)
  neutral_value <- options$neutral_value  # e.g., 3 or "Neutral"
  
  x <- normalize_missing(x)  # Grouping variable
  y <- normalize_missing(y)  # Likert scale variable
  
  if (include_missing) {
    x[is.na(x)] <- "Missing"
    y[is.na(y)] <- "Missing"
  }
  
  valid <- !is.na(x) & !is.na(y)
  x <- x[valid]
  y <- y[valid]
  
  if (length(x) == 0) {
    stop("No valid values.")
  }
  
  # Detect or use provided levels for Likert scale
  if (!is.null(options$levels)) {
    y <- factor(y, levels = options$levels, ordered = TRUE)
  } else {
    # Try auto-detect ordinal scale for y
    ordinal_info <- tryCatch({
      unique_y <- unique(y)
      detect_ordinal_preset(unique_y)
    }, error = function(e) {
      NULL
    })
    
    if (!is.null(ordinal_info)) {
      y <- factor(y, levels = ordinal_info$levels, ordered = TRUE)
    } else {
      # Fallback to factor
      y <- factor(y, ordered = TRUE)
    }
  }
  
  levels_y <- levels(factor(y))
  
  # Find neutral point - auto-detect if not provided
  if (is.null(neutral_value)) {
    # Try to auto-detect neutral from the scale
    detected_neutral <- tryCatch({
      get_neutral_point(levels_y, preset_name = NULL)
    }, error = function(e) {
      NULL
    })
    
    if (!is.null(detected_neutral)) {
      neutral_idx <- which(levels_y == detected_neutral)
    } else {
      # Default to middle
      neutral_idx <- ceiling(length(levels_y) / 2)
    }
  } else {
    neutral_idx <- which(levels_y == as.character(neutral_value))
    if (length(neutral_idx) == 0) {
      neutral_idx <- ceiling(length(levels_y) / 2)
    }
  }
  
  table_data <- table(x, y)
  groups <- rownames(table_data)
  
  # For each group, calculate negative, neutral, positive percentages
  group_data <- lapply(seq_along(groups), function(i) {
    row <- table_data[i, ]
    total <- sum(row)
    
    if (total == 0) {
      return(list(
        group = groups[i],
        negative_percent = 0,
        neutral_percent = 0,
        positive_percent = 0
      ))
    }
    
    negative_count <- if (neutral_idx > 1) sum(row[1:(neutral_idx - 1)]) else 0
    neutral_count <- row[neutral_idx]
    positive_count <- if (neutral_idx < length(row)) sum(row[(neutral_idx + 1):length(row)]) else 0
    
    list(
      group = groups[i],
      negative_percent = round((negative_count / total) * 100, 2),
      neutral_percent = round((neutral_count / total) * 100, 2),
      positive_percent = round((positive_count / total) * 100, 2),
      negative_count = as.integer(negative_count),
      neutral_count = as.integer(neutral_count),
      positive_count = as.integer(positive_count)
    )
  })
  
  list(
    groups = groups,
    data = group_data,
    neutral_value = if (!is.null(neutral_value)) as.character(neutral_value) else levels_y[neutral_idx],
    levels = levels_y,
    stats = list(
      total = as.integer(sum(table_data))
    )
  )
}

# ============================================================================
# ASSOCIATION / CORRELATION VISUALIZATIONS
# ============================================================================

calculate_cramers_v <- function(x, y) {
  tbl <- table(x, y)
  chi_sq <- suppressWarnings(chisq.test(tbl))
  n <- sum(tbl)
  k <- min(nrow(tbl), ncol(tbl))
  if (k <= 1) return(0)
  sqrt(chi_sq$statistic / (n * (k - 1)))
}

calculate_theils_u <- function(x, y) {
  # Uncertainty coefficient (asymmetric)
  tbl <- table(x, y)
  n <- sum(tbl)
  
  # Entropy of y
  py <- colSums(tbl) / n
  hy <- -sum(py[py > 0] * log(py[py > 0]))
  
  # Conditional entropy H(Y|X)
  hyx <- 0
  for (i in seq_len(nrow(tbl))) {
    px <- sum(tbl[i, ]) / n
    if (px > 0) {
      pyx <- tbl[i, ] / sum(tbl[i, ])
      hyx <- hyx + px * (-sum(pyx[pyx > 0] * log(pyx[pyx > 0])))
    }
  }
  
  if (hy == 0) return(0)
  (hy - hyx) / hy
}

build_assoc_heatmap <- function(df, options) {
  # Calculate association matrix for selected or all columns
  
  # Use selected columns if provided, otherwise use all columns
  if (!is.null(options$selected_columns) && length(options$selected_columns) > 0) {
    cols <- options$selected_columns
    # Filter to only columns that exist in df
    cols <- cols[cols %in% colnames(df)]
  } else {
    cols <- colnames(df)
  }
  
  n_cols <- length(cols)
  
  if (n_cols < 2) {
    stop("Need at least 2 columns for association analysis.")
  }
  
  # Limit to max 50 columns for performance
  max_cols <- 50
  if (n_cols > max_cols) {
    cols <- cols[1:max_cols]
    n_cols <- max_cols
    warning(paste("Too many columns selected. Using first", max_cols, "columns."))
  }
  
  # Initialize matrix
  assoc_matrix <- matrix(0, n_cols, n_cols)
  rownames(assoc_matrix) <- cols
  colnames(assoc_matrix) <- cols
  
  # Calculate pairwise associations
  for (i in 1:(n_cols - 1)) {
    for (j in (i + 1):n_cols) {
      x <- normalize_missing(df[[cols[i]]])
      y <- normalize_missing(df[[cols[j]]])
      
      valid <- !is.na(x) & !is.na(y)
      x <- x[valid]
      y <- y[valid]
      
      if (length(x) < 5) {
        assoc_matrix[i, j] <- NA
        assoc_matrix[j, i] <- NA
        next
      }
      
      # Use Cramér's V as default
      tryCatch({
        v <- calculate_cramers_v(x, y)
        assoc_matrix[i, j] <- v
        assoc_matrix[j, i] <- v
      }, error = function(e) {
        assoc_matrix[i, j] <<- NA
        assoc_matrix[j, i] <<- NA
      })
    }
  }
  
  # Diagonal is 1
  diag(assoc_matrix) <- 1
  
  # Convert to list format
  matrix_list <- lapply(1:n_cols, function(i) {
    as.list(round(assoc_matrix[i, ], 3))
  })
  names(matrix_list) <- cols
  
  list(
    columns = cols,
    matrix = matrix_list,
    method = "cramers_v"
  )
}

build_assoc_target_bar <- function(df, options) {
  target_column <- options$target_column
  
  if (is.null(target_column) || !(target_column %in% colnames(df))) {
    stop("Target column must be specified and exist in dataset.")
  }
  
  cols <- setdiff(colnames(df), target_column)
  target_data <- normalize_missing(df[[target_column]])
  target_data <- target_data[!is.na(target_data)]
  
  if (length(target_data) < 5) {
    stop("Not enough valid data in target column.")
  }
  
  # Calculate association with each column
  associations <- lapply(cols, function(col) {
    x <- normalize_missing(df[[col]])
    valid <- !is.na(x) & !is.na(df[[target_column]])
    x <- x[valid]
    y <- target_data[valid]
    
    if (length(x) < 5) {
      return(list(column = col, assoc_value = NA))
    }
    
    tryCatch({
      v <- calculate_cramers_v(x, y)
      list(column = col, assoc_value = round(v, 3))
    }, error = function(e) {
      list(column = col, assoc_value = NA)
    })
  })
  
  # Filter out NA and sort by strength
  associations <- associations[!sapply(associations, function(a) is.na(a$assoc_value))]
  associations <- associations[order(sapply(associations, function(a) a$assoc_value), decreasing = TRUE)]
  
  # Apply top_k if specified
  top_k <- options$top_k
  if (!is.null(top_k) && !is.na(top_k) && top_k > 0 && top_k < length(associations)) {
    associations <- associations[1:top_k]
  }
  
  list(
    target_column = target_column,
    associations = associations,
    method = "cramers_v"
  )
}

# ============================================================================
# LEGACY SUPPORT (keeping old chart types)
# ============================================================================

build_histogram <- function(x, options) {
  x <- to_numeric(x)
  x <- x[!is.na(x)]

  if (length(x) < 2) {
    stop("Not enough numeric values for histogram.")
  }

  bins <- options$bins
  if (is.null(bins) || is.na(bins)) {
    bins <- 10
  }

  hist_data <- hist(x, breaks = bins, plot = FALSE)
  bin_list <- lapply(seq_along(hist_data$counts), function(i) {
    list(
      start = hist_data$breaks[i],
      end = hist_data$breaks[i + 1],
      count = hist_data$counts[i]
    )
  })

  list(
    bins = bin_list,
    stats = list(
      count = as.integer(length(x)),
      min = min(x),
      max = max(x),
      mean = mean(x),
      median = median(x),
      sd = sd(x)
    )
  )
}

build_qq <- function(x, with_line, options) {
  x <- to_numeric(x)
  x <- x[!is.na(x)]

  if (length(x) < 3) {
    stop("Not enough numeric values for QQ plot.")
  }

  max_points <- options$max_points
  if (!is.null(max_points) && !is.na(max_points) && length(x) > max_points) {
    set.seed(42)
    x <- sample(x, max_points)
  }

  qq <- qqnorm(x, plot.it = FALSE)
  points <- lapply(seq_along(qq$x), function(i) {
    list(theoretical = qq$x[i], sample = qq$y[i])
  })

  output <- list(points = points)

  if (with_line) {
    qx <- quantile(x, c(0.25, 0.75))
    qn <- qnorm(c(0.25, 0.75))
    slope <- diff(qx) / diff(qn)
    intercept <- qx[1] - slope * qn[1]
    x_range <- range(qq$x)
    line_points <- list(
      list(theoretical = x_range[1], sample = intercept + slope * x_range[1]),
      list(theoretical = x_range[2], sample = intercept + slope * x_range[2])
    )
    output$line <- line_points
  }

  output$stats <- list(
    count = as.integer(length(x)),
    mean = mean(x),
    sd = sd(x)
  )

  output
}

build_scatter <- function(x, y, options) {
  x <- to_numeric(x)
  y <- to_numeric(y)

  valid <- !is.na(x) & !is.na(y)
  x <- x[valid]
  y <- y[valid]

  if (length(x) < 2) {
    stop("Not enough numeric values for scatter plot.")
  }

  max_points <- options$max_points
  if (!is.null(max_points) && !is.na(max_points) && length(x) > max_points) {
    set.seed(42)
    idx <- sample(seq_along(x), max_points)
    x <- x[idx]
    y <- y[idx]
  }

  points <- lapply(seq_along(x), function(i) {
    list(x = x[i], y = y[i])
  })

  list(
    points = points,
    stats = list(
      count = as.integer(length(x)),
      correlation = cor(x, y)
    )
  )
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

tryCatch({
  input_json <- readLines("stdin", warn = FALSE)
  input_data <- fromJSON(input_json)

  file_path <- input_data$file_path
  chart_type <- input_data$chart_type
  x_column <- input_data$x_column
  y_column <- input_data$y_column
  options <- if (!is.null(input_data$options)) input_data$options else list()

  if (is.null(file_path) || !file.exists(file_path)) {
    output <- create_error("Input file not found.")
    cat(toJSON(output, auto_unbox = TRUE))
    quit(status = 0)
  }

  df <- read.csv(file_path, stringsAsFactors = FALSE)

  # Validate dataset size
  if (nrow(df) > 1000000) {
    output <- create_error("Dataset too large. Maximum 1 million rows allowed.")
    cat(toJSON(output, auto_unbox = TRUE))
    quit(status = 0)
  }

  # Sample large datasets for performance
  MAX_ROWS <- 100000
  if (nrow(df) > MAX_ROWS) {
    set.seed(42)
    df <- df[sample(nrow(df), MAX_ROWS), ]
  }

  if (!is.null(x_column) && !(x_column %in% colnames(df))) {
    output <- create_error(paste("Column not found:", x_column))
    cat(toJSON(output, auto_unbox = TRUE))
    quit(status = 0)
  }
  if (!is.null(y_column) && !(y_column %in% colnames(df))) {
    output <- create_error(paste("Column not found:", y_column))
    cat(toJSON(output, auto_unbox = TRUE))
    quit(status = 0)
  }

  # Check cardinality for categorical charts
  if (!is.null(x_column) && chart_type %in% c("bar", "pie", "ordered_bar", "pareto", "cumulative_percent", "grouped_bar", "stacked_bar_100", "contingency_heatmap_percent", "likert_diverging")) {
    x_unique <- length(unique(df[[x_column]]))
    if (x_unique > 1000) {
      output <- create_error(paste("Too many categories in x_column:", x_unique, ". Maximum 1000 allowed. Consider using topn_bar."))
      cat(toJSON(output, auto_unbox = TRUE))
      quit(status = 0)
    }
  }

  result <- switch(
    chart_type,
    # Univariate categorical
    "bar" = build_bar(df[[x_column]], options),
    "topn_bar" = build_topn_bar(df[[x_column]], options),
    "pareto" = build_pareto(df[[x_column]], options),
    "cumulative_percent" = build_cumulative_percent(df[[x_column]], options),
    "ordered_bar" = build_ordered_bar(df[[x_column]], options),
    
    # Bivariate categorical
    "stacked_bar_100" = build_stacked_bar_100(df[[x_column]], df[[y_column]], options),
    "grouped_bar" = build_grouped_bar(df[[x_column]], df[[y_column]], options),
    "contingency_heatmap_percent" = build_contingency_heatmap_percent(df[[x_column]], df[[y_column]], options),
    "likert_diverging" = build_likert_diverging(df[[x_column]], df[[y_column]], options),
    
    # Association analysis
    "assoc_heatmap" = build_assoc_heatmap(df, options),
    "assoc_target_bar" = build_assoc_target_bar(df, options),
    
    # Legacy/numeric charts
    "pie" = build_bar(df[[x_column]], options),  # Pie uses same data as bar
    "histogram" = build_histogram(df[[x_column]], options),
    "qq" = build_qq(df[[x_column]], FALSE, options),
    "qqline" = build_qq(df[[x_column]], TRUE, options),
    "scatter" = build_scatter(df[[x_column]], df[[y_column]], options),
    "stacked_bar" = build_stacked_bar_100(df[[x_column]], df[[y_column]], options),  # Legacy alias
    
    create_error(paste("Unknown chart type:", chart_type))
  )

  if ("error" %in% names(result)) {
    cat(toJSON(result, auto_unbox = TRUE))
    quit(status = 0)
  }

  output <- list(
    chartType = chart_type,
    xColumn = x_column,
    yColumn = y_column,
    data = result
  )

  cat(toJSON(output, auto_unbox = TRUE))

}, error = function(e) {
  error_output <- create_error(paste("Unexpected error:", e$message))
  cat(toJSON(error_output, auto_unbox = TRUE))
  quit(status = 0)
})
