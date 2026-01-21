# Install all required R packages for HIS Project
# Run this script once during initial setup: Rscript backend/R_scripts/install_packages.R

cat("Installing required R packages for HIS Project...\n\n")

# CRAN mirror
options(repos = c(CRAN = "https://cran.r-project.org"))

# List of required packages
required_packages <- c(
  "jsonlite", # JSON parsing (used in multiple scripts)
  "FactoMineR", # Dimensionality reduction (MCA/FAMD)
  "dplyr", # Data manipulation (encoding)
  "readr", # CSV reading (encoding)
  "VIM", # Missing value imputation
  "vcd", # Categorical data analysis (correlation)
  "DescTools", # Descriptive statistics (correlation)
  "psych", # Psychological statistics (correlation)
  "reticulate", # Python integration (text transformation)
  "cluster", # Clustering algorithms (text transformation)
  "rmarkdown", # Report generation
  "knitr", # Dynamic report generation
  "kableExtra", # Table styling in reports
  "ggplot2", # Data visualization in reports
  "missRanger" # Model-based imputation (Random Forest)
)

cat("Required packages:\n")
cat(paste("  -", required_packages), sep = "\n")
cat("\n")

# Check which packages are already installed
installed <- installed.packages()[, "Package"]
to_install <- required_packages[!required_packages %in% installed]

if (length(to_install) == 0) {
  cat("All required packages are already installed!\n")
} else {
  cat("Installing missing packages:\n")
  cat(paste("  -", to_install), sep = "\n")
  cat("\n")

  # Install missing packages
  for (pkg in to_install) {
    cat(sprintf("Installing %s...\n", pkg))
    tryCatch(
      {
        install.packages(pkg, dependencies = TRUE, quiet = FALSE)
        cat(sprintf("  ✓ %s installed successfully\n\n", pkg))
      },
      error = function(e) {
        cat(sprintf("  ✗ Failed to install %s: %s\n\n", pkg, e$message))
      }
    )
  }
}

# Verify installation
cat("\nVerifying installation...\n")
success <- TRUE
for (pkg in required_packages) {
  if (requireNamespace(pkg, quietly = TRUE)) {
    cat(sprintf("  ✓ %s\n", pkg))
  } else {
    cat(sprintf("  ✗ %s (FAILED)\n", pkg))
    success <- FALSE
  }
}

if (success) {
  cat("\n✓ All R packages installed successfully!\n")
  cat("\nYou can now run the backend server.\n")
} else {
  cat("\n✗ Some packages failed to install. Please install them manually.\n")
  cat("Run: install.packages(c('package_name'))\n")
}
