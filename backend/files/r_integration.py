"""R integration helper for missing values handling."""

import os
from pathlib import Path
from typing import List

from fastapi import HTTPException


def validate_r_environment():
    """
    Validate that R is accessible and rpy2 can be imported.

    Raises:
        HTTPException: If R environment is not properly configured
    """
    try:
        import rpy2.robjects as robjects
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="rpy2 is not installed. Please install it with: pip install rpy2",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"R environment error: {str(e)}. Please ensure R_HOME is set and R is in PATH",
        )


def validate_columns(
    selected_columns: List[str], available_columns: List[str]
) -> tuple[bool, str]:
    """
    Validate requested columns for missing value handling.

    Args:
        selected_columns: List of columns to process
        available_columns: List of available columns in the file

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check if any columns provided
    if not selected_columns or len(selected_columns) == 0:
        return False, "No columns selected for missing value handling"

    # Exclude 'id' column
    if "id" in selected_columns:
        return False, "Cannot apply missing value handling to 'id' column"

    # Check all columns exist
    for col in selected_columns:
        if col not in available_columns:
            return False, f"Column '{col}' does not exist in the file"

    return True, ""


def handle_missing_values(
    csv_path: Path, selected_columns: List[str], method: str
) -> None:
    """
    Execute R script to handle missing values in CSV file.

    Args:
        csv_path: Path to the selected.csv file (will be read and written)
        selected_columns: List of column names to process
        method: Missing value handling method

    Raises:
        HTTPException: If R execution fails or environment is invalid
    """
    # Validate R environment first
    validate_r_environment()

    try:
        import rpy2.robjects as robjects
        from rpy2.robjects import StrVector, default_converter
        from rpy2.robjects.conversion import localconverter

        # Load the R script
        r_script_path = Path(__file__).parent.parent / "R_scripts" / "MissingValues.R"

        if not r_script_path.exists():
            raise HTTPException(
                status_code=500, detail=f"R script not found at {r_script_path}"
            )

        # Source the R script
        robjects.r.source(str(r_script_path))

        # Get the R function
        handle_missing_values_r = robjects.r["handle_missing_values_csv"]

        # Convert paths to strings
        input_csv = str(csv_path.absolute())
        output_csv = str(csv_path.absolute())  # Write back to same file

        # Convert column list to R vector
        columns_r = StrVector(selected_columns)

        # Call R function with proper conversion context
        # The R function signature: handle_missing_values_csv(input_csv, output_csv, columns, method)
        with localconverter(default_converter):
            result = handle_missing_values_r(input_csv, output_csv, columns_r, method)

        # R function writes directly to file, no need to return anything

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="rpy2 is not installed. Please install it with: pip install rpy2",
        )
    except Exception as e:
        error_msg = str(e)

        # Provide helpful error messages for common issues
        if "mice" in error_msg.lower() and method == "model_based":
            raise HTTPException(
                status_code=500,
                detail="R package 'mice' is not installed. Please run: install.packages('mice') in R",
            )
        elif "R_HOME" in error_msg or "not found" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail="R is not properly configured. Please ensure R_HOME environment variable is set and R is in PATH",
            )
        else:
            raise HTTPException(
                status_code=500, detail=f"Failed to execute R script: {error_msg}"
            )


def map_method_name(frontend_method: str) -> str:
    """
    Map frontend method names (kebab-case) to R function method names (snake_case).

    Args:
        frontend_method: Method name from frontend (e.g., 'row-deletion')

    Returns:
        R function method name (e.g., 'row_deletion')
    """
    method_mapping = {
        "row-deletion": "row_deletion",
        "mode": "mode",
        "median": "median",
        "missing-category": "missing_category",
        "model-based": "model_based",
    }

    return method_mapping.get(frontend_method, frontend_method)


def handle_binning(
    csv_path: Path,
    selected_columns: List[str],
    method: str,
    n_bins: int = 5,
    bin_labels: List[str] = None,
    smooth_window: int = 3,
    breaks: List[float] = None,
) -> None:
    """
    Execute R script to perform binning on CSV file.

    Args:
        csv_path: Path to the selected.csv file (will be read and written)
        selected_columns: List of column names to bin
        method: Binning method (equal_width, equal_freq, smooth_mean, smooth_median, quantile, custom)
        n_bins: Number of bins (default 5)
        bin_labels: Optional custom labels for bins
        smooth_window: Window size for smoothing methods (default 3)
        breaks: Custom break points for 'custom' method

    Raises:
        HTTPException: If R execution fails or environment is invalid
    """
    # Validate R environment first
    validate_r_environment()

    try:
        import rpy2.robjects as robjects
        from rpy2.robjects import FloatVector, IntVector, StrVector, default_converter
        from rpy2.robjects.conversion import localconverter

        # Load the R script
        r_script_path = Path(__file__).parent.parent / "R_scripts" / "binning.R"

        if not r_script_path.exists():
            raise HTTPException(
                status_code=500, detail=f"R script not found at {r_script_path}"
            )

        # Source the R script
        robjects.r.source(str(r_script_path))

        # Get the R function
        bin_data_csv_r = robjects.r["bin_data_csv"]

        # Convert paths to strings
        input_csv = str(csv_path.absolute())
        output_csv = str(csv_path.absolute())  # Write back to same file

        # Convert column list to R vector
        columns_r = StrVector(selected_columns)

        # Prepare optional parameters
        with localconverter(default_converter):
            # Build arguments for R function
            if bin_labels:
                labels_r = StrVector(bin_labels)
            else:
                labels_r = robjects.NULL

            if breaks:
                breaks_r = FloatVector(breaks)
            else:
                breaks_r = robjects.NULL

            # Call R function
            # R function signature: bin_data_csv(input_csv, output_csv, columns, method, n_bins, bin_labels, smooth_window, breaks)
            result = bin_data_csv_r(
                input_csv,
                output_csv,
                columns_r,
                method,
                n_bins,
                labels_r,
                smooth_window,
                breaks_r,
            )

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="rpy2 is not installed. Please install it with: pip install rpy2",
        )
    except Exception as e:
        error_msg = str(e)

        # Provide helpful error messages for common issues
        if "non-numeric" in error_msg.lower() or "not numeric" in error_msg.lower():
            raise HTTPException(
                status_code=400,
                detail="Binning can only be applied to numeric columns. Some selected columns contain non-numeric values.",
            )
        elif "R_HOME" in error_msg or "not found" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail="R is not properly configured. Please ensure R_HOME environment variable is set and R is in PATH",
            )
        else:
            raise HTTPException(
                status_code=500, detail=f"Failed to execute binning: {error_msg}"
            )


def map_binning_method_name(frontend_method: str) -> str:
    """
    Map frontend binning method names (kebab-case) to R function method names (snake_case).

    Args:
        frontend_method: Method name from frontend (e.g., 'equal-width')

    Returns:
        R function method name (e.g., 'equal_width')
    """
    method_mapping = {
        "equal-width": "equal_width",
        "equal-freq": "equal_freq",
        "smooth-mean": "smooth_mean",
        "smooth-median": "smooth_median",
        "quantile": "quantile",
        "custom": "custom",
    }

    return method_mapping.get(frontend_method, frontend_method)


def handle_encoding(
    csv_path: Path,
    selected_columns: List[str],
    method: str,
    target_columns: List[str] = None,
) -> None:
    """
    Execute R script to perform encoding on CSV file.

    Args:
        csv_path: Path to the selected.csv file (will be read and written)
        selected_columns: List of column names to encode
        method: Encoding method (label, onehot, ordinal, frequency, target)
        target_columns: Target columns for target encoding (optional)

    Raises:
        HTTPException: If R execution fails or environment is invalid
    """
    # Validate R environment first
    validate_r_environment()

    try:
        import rpy2.robjects as robjects
        from rpy2.robjects import StrVector, default_converter
        from rpy2.robjects.conversion import localconverter

        # Load the R script
        r_script_path = Path(__file__).parent.parent / "R_scripts" / "encoding.R"

        if not r_script_path.exists():
            raise HTTPException(
                status_code=500, detail=f"R script not found at {r_script_path}"
            )

        # Source the R script
        robjects.r.source(str(r_script_path))

        # Get the R function
        encode_data_csv_r = robjects.r["encode_data_csv"]

        # Convert paths to strings
        input_csv = str(csv_path.absolute())
        output_csv = str(csv_path.absolute())  # Write back to same file

        # Convert column list to R vector
        columns_r = StrVector(selected_columns)

        # Prepare optional parameters
        with localconverter(default_converter):
            if target_columns:
                target_cols_r = StrVector(target_columns)
            else:
                target_cols_r = robjects.NULL

            # Call R function
            # R function signature: encode_data_csv(input_csv, output_csv, columns, method, target_columns)
            result = encode_data_csv_r(
                input_csv,
                output_csv,
                columns_r,
                method,
                target_cols_r,
            )

        # R function writes directly to file, no need to return anything

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="rpy2 is not installed. Please install it with: pip install rpy2",
        )
    except Exception as e:
        error_msg = str(e)

        # Provide helpful error messages for common issues
        if "dplyr" in error_msg.lower() or "readr" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail="R packages 'dplyr' and 'readr' are required. Please run: install.packages(c('dplyr', 'readr')) in R",
            )
        elif "R_HOME" in error_msg or "not found" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail="R is not properly configured. Please ensure R_HOME environment variable is set and R is in PATH",
            )
        else:
            raise HTTPException(
                status_code=500, detail=f"Failed to execute encoding: {error_msg}"
            )


def map_encoding_method_name(frontend_method: str) -> str:
    """
    Map frontend encoding method names to R function method names.

    Frontend uses: one-hot, label, frequency, target, ordinal
    R expects: onehot, label, frequency, target, ordinal

    Args:
        frontend_method: Method name from frontend (e.g., 'one-hot')

    Returns:
        R function method name (e.g., 'onehot')
    """
    method_mapping = {
        "one-hot": "onehot",
        "label": "label",
        "frequency": "frequency",
        "target": "target",
        "ordinal": "ordinal",
    }

    return method_mapping.get(frontend_method, frontend_method)
