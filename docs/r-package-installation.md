# R Package Installation Guide

## Prerequisites

Make sure you have R installed on your system:
- **Download R**: https://cran.r-project.org/
- **Verify installation**: Run `R --version` in your terminal

## Installation Methods

### Method 1: Automated Installation (Recommended)

#### Windows:
```bash
# Double-click install_r_packages.bat or run:
install_r_packages.bat
```

#### Linux/Mac:
```bash
chmod +x install_r_packages.sh
./install_r_packages.sh
```

#### Using npm:
```bash
npm run install:r-packages
```

### Method 2: Manual Installation

Run the R installation script directly:
```bash
Rscript backend/R_scripts/install_packages.R
```

### Method 3: Install All Dependencies at Once

```bash
npm run install:all
```

This installs:
- Frontend dependencies (npm packages)
- Backend dependencies (Python packages)
- R packages (data processing)

## Required R Packages

The following packages will be installed automatically:

| Package | Purpose |
|---------|---------|
| `jsonlite` | JSON parsing and data exchange |
| `FactoMineR` | Dimensionality reduction (MCA/FAMD) |
| `dplyr` | Data manipulation and transformation |
| `readr` | Fast CSV file reading |
| `VIM` | Missing value imputation |
| `vcd` | Categorical data visualization |
| `DescTools` | Descriptive statistics tools |
| `psych` | Psychological and psychometric statistics |
| `reticulate` | Python-R integration |
| `cluster` | Clustering algorithms |

## Troubleshooting

### "R is not recognized" or "Rscript not found"

**Solution**: Add R to your system PATH

**Windows:**
1. Find your R installation (typically `C:\Program Files\R\R-x.x.x\bin`)
2. Add to PATH:
   - Search "Environment Variables" in Windows
   - Edit "Path" in System Variables
   - Add R's bin directory

**Linux/Mac:**
```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="/usr/local/bin/R:$PATH"
```

### Package Installation Fails

**Solution 1**: Run R as administrator (Windows) or with sudo (Linux/Mac)

**Solution 2**: Install packages manually in R console:
```r
install.packages(c(
  "jsonlite", "FactoMineR", "dplyr", "readr", 
  "VIM", "vcd", "DescTools", "psych", 
  "reticulate", "cluster"
))
```

### Specific Package Errors

**VIM package fails:**
```r
# Try installing from source
install.packages("VIM", type = "source")
```

**reticulate issues:**
```r
# Install development version
install.packages("reticulate")
reticulate::install_miniconda()
```

## Verification

After installation, verify all packages are working:

```r
# Run in R console
packages <- c("jsonlite", "FactoMineR", "dplyr", "readr", 
              "VIM", "vcd", "DescTools", "psych", 
              "reticulate", "cluster")

for (pkg in packages) {
  if (requireNamespace(pkg, quietly = TRUE)) {
    cat(sprintf("✓ %s\n", pkg))
  } else {
    cat(sprintf("✗ %s (FAILED)\n", pkg))
  }
}
```

## Next Steps

After installing R packages:
1. Start the backend server
2. Test data reduction features
3. Verify dimensionality reduction works

## Support

If you encounter issues:
1. Check R version: `R --version` (recommended: R >= 4.0)
2. Update R to latest version
3. Check CRAN mirror connectivity
4. Review error messages in the installation output
