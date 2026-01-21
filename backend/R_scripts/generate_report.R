#!/usr/bin/env Rscript

# Generate DataPrepHIS Analysis Report
# Usage: Rscript generate_report.R <selected_csv> <original_csv> <history_json> <output_html>

suppressMessages({
  library(jsonlite)
  library(rmarkdown)
})

# Get command line arguments
args <- commandArgs(trailingOnly = TRUE)

if (length(args) != 4) {
  stop("Usage: Rscript generate_report.R <selected_csv> <original_csv> <history_json> <output_html>")
}

selected_csv_path <- args[1]
original_csv_path <- args[2]
history_json_path <- args[3]
output_html_path <- args[4]

# Validate input files exist
if (!file.exists(selected_csv_path)) {
  stop(paste("Processed data file not found:", selected_csv_path))
}

if (!file.exists(original_csv_path)) {
  stop(paste("Original data file not found:", original_csv_path))
}

if (!file.exists(history_json_path)) {
  stop(paste("History file not found:", history_json_path))
}

# Read data
cat("Reading data files...\n")
processed_data <- tryCatch({
  read.csv(selected_csv_path, stringsAsFactors = FALSE)
}, error = function(e) {
  stop(paste("Error reading processed data:", e$message))
})

original_data <- tryCatch({
  read.csv(original_csv_path, stringsAsFactors = FALSE)
}, error = function(e) {
  stop(paste("Error reading original data:", e$message))
})

# Read preprocessing history
preprocessing_history <- tryCatch({
  fromJSON(history_json_path)
}, error = function(e) {
  stop(paste("Error reading history.json:", e$message))
})

# Extract filename from path
filename <- basename(original_csv_path)

# Identify numeric and categorical variables
numeric_vars <- names(processed_data)[sapply(processed_data, is.numeric)]
categorical_vars <- names(processed_data)[!sapply(processed_data, is.numeric)]

cat("Dataset summary:\n")
cat("  Rows:", nrow(processed_data), "\n")
cat("  Columns:", ncol(processed_data), "\n")
cat("  Numeric variables:", length(numeric_vars), "\n")
cat("  Categorical variables:", length(categorical_vars), "\n")
cat("  Preprocessing operations:", length(preprocessing_history), "\n")

# Get the directory where this script is located
script_args <- commandArgs(trailingOnly = FALSE)
script_path <- sub("^--file=", "", script_args[grep("^--file=", script_args)])

if (length(script_path) > 0 && file.exists(script_path)) {
  # Normalize path to handle spaces and special characters
  script_dir <- normalizePath(dirname(script_path))
  cat("Script directory:", script_dir, "\n")
} else {
  # Fallback: assume script is in R_scripts directory
  script_dir <- normalizePath(file.path(getwd(), "R_scripts"))
  cat("Using fallback directory:", script_dir, "\n")
}

# Path to R Markdown template
template_path <- file.path(script_dir, "report_template.Rmd")
cat("Looking for template at:", template_path, "\n")

if (!file.exists(template_path)) {
  # Try alternative path (if called from backend root)
  alt_template_path <- normalizePath(file.path(getwd(), "R_scripts", "report_template.Rmd"), mustWork = FALSE)
  if (file.exists(alt_template_path)) {
    template_path <- alt_template_path
    cat("Using alternative template path:", template_path, "\n")
  } else {
    stop(paste("Report template not found. Tried:\n  1.", template_path, "\n  2.", alt_template_path))
  }
}

# Render the R Markdown document
cat("Generating report from template:", template_path, "\n")
tryCatch({
  rmarkdown::render(
    input = template_path,
    output_file = basename(output_html_path),
    output_dir = dirname(output_html_path),
    params = list(
      processed_data = processed_data,
      original_data = original_data,
      filename = filename,
      preprocessing_history = preprocessing_history,
      numeric_vars = numeric_vars,
      categorical_vars = categorical_vars,
      include_plots = TRUE,
      include_stats = TRUE,
      include_preprocessing = TRUE,
      include_correlation = TRUE
    ),
    quiet = FALSE
  )
  
  cat("Report generated successfully:", output_html_path, "\n")
}, error = function(e) {
  stop(paste("Error rendering report:", e$message))
})
