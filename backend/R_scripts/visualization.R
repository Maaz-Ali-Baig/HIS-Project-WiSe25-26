# Visualization R Script
# Input: JSON via stdin
# Output: JSON to stdout

options(warn = -1)
invisible(suppressMessages({
  library(jsonlite)
}))

create_error <- function(message) {
  list(error = message)
}

normalize_missing <- function(x) {
  x <- as.character(x)
  x[x == ""] <- NA
  x[toupper(x) == "NA"] <- NA
  x
}

to_numeric <- function(x) {
  x <- normalize_missing(x)
  x <- gsub(",", "", x)
  suppressWarnings(as.numeric(x))
}

limit_categories <- function(counts, top_n) {
  if (is.null(top_n) || is.na(top_n) || top_n <= 0) {
    return(counts)
  }
  if (length(counts) <= top_n) {
    return(counts)
  }
  sorted_counts <- sort(counts, decreasing = TRUE)
  top_counts <- sorted_counts[1:top_n]
  other_sum <- sum(sorted_counts[(top_n + 1):length(sorted_counts)])
  combined <- c(top_counts, Other = other_sum)
  combined
}

build_categorical_counts <- function(x, options) {
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
  counts <- limit_categories(counts, options$top_categories)

  list(
    categories = names(counts),
    counts = as.integer(counts),
    stats = list(
      total = as.integer(sum(counts)),
      unique = as.integer(length(counts))
    )
  )
}

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

build_stacked_bar <- function(x, y, options) {
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
    stop("No valid categorical values for stacked bar.")
  }

  table_data <- table(x, y)
  x_categories <- rownames(table_data)
  y_categories <- colnames(table_data)

  series <- lapply(seq_along(y_categories), function(i) {
    list(
      name = y_categories[i],
      values = as.integer(table_data[, i])
    )
  })

  list(
    x_categories = x_categories,
    series = series,
    stats = list(
      total = as.integer(sum(table_data))
    )
  )
}

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

  result <- switch(
    chart_type,
    "pie" = build_categorical_counts(df[[x_column]], options),
    "bar" = build_categorical_counts(df[[x_column]], options),
    "histogram" = build_histogram(df[[x_column]], options),
    "qq" = build_qq(df[[x_column]], FALSE, options),
    "qqline" = build_qq(df[[x_column]], TRUE, options),
    "scatter" = build_scatter(df[[x_column]], df[[y_column]], options),
    "stacked_bar" = build_stacked_bar(df[[x_column]], df[[y_column]], options),
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
