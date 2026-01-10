"""R integration helper for missing values handling."""

import json
import tempfile

import os
import subprocess
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException

if os.name == "nt":
    r_home = os.environ.get("R_HOME")
    if r_home:
        r_bin = Path(r_home) / "bin" / "x64"
        if r_bin.exists():
            os.add_dll_directory(str(r_bin))

# Initialize rpy2 once at module load to avoid context variable issues
try:
    import rpy2.robjects as robjects
    from rpy2.robjects import StrVector, FloatVector, IntVector
    RPY2_AVAILABLE = True
except ImportError:
    RPY2_AVAILABLE = False
    robjects = None


def validate_r_environment():
    """
    Validate that R is accessible and rpy2 can be imported.

    Raises:
        HTTPException: If R environment is not properly configured
    """
    if not RPY2_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="rpy2 is not installed. Please install it with: pip install rpy2",
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

        # Call R function
        # The R function signature: handle_missing_values_csv(input_csv, output_csv, columns, method)
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
    min_freq: int = 10,
    target_column: str = None,
    custom_mapping: dict = None,
    similarity_threshold: float = 0.7,
) -> None:
    """
    Execute R script to perform categorical binning on CSV file.

    Args:
        csv_path: Path to the selected.csv file (will be read and written)
        selected_columns: List of column names to bin
        method: Binning method (frequency, target_based, similarity, domain, custom)
        n_bins: Number of bins/categories to keep (default 5)
        bin_labels: Optional custom labels for bins
        smooth_window: Window size for smoothing methods (default 3) - legacy parameter
        breaks: Custom break points for 'custom' method - legacy parameter
        min_freq: Minimum frequency to keep as separate category (for frequency method)
        target_column: Name of target variable for target-based binning
        custom_mapping: Named dict mapping original categories to new groups
        similarity_threshold: Similarity threshold for grouping (0-1)

    Raises:
        HTTPException: If R execution fails or environment is invalid
    """
    # Validate R environment
    validate_r_environment()

    try:
        # Load the R script
        r_script_path = Path(__file__).parent.parent / "R_scripts" / "binning.R"

        if not r_script_path.exists():
            raise HTTPException(
                status_code=500, detail=f"R script not found at {r_script_path}"
            )

        # Source the R script
        robjects.r.source(str(r_script_path))

        # Get the R function
        bin_categorical_csv_r = robjects.r["bin_categorical_csv"]

        # Convert paths to strings
        input_csv = str(csv_path.absolute())
        output_csv = str(csv_path.absolute())  # Write back to same file

        # Convert column list to R vector
        columns_r = StrVector(selected_columns)

        # Build arguments for R function based on method
        # R function signature: bin_categorical_csv(input_csv, output_csv, columns, method, n_bins, min_freq, target_column, custom_mapping, similarity_threshold)
        
        # Prepare target_column
        if target_column:
            target_r = target_column
        else:
            target_r = robjects.NULL
            
        # Prepare custom_mapping
        if custom_mapping and isinstance(custom_mapping, dict):
            # Convert Python dict to R named list
            custom_r = robjects.ListVector(custom_mapping)
        else:
            custom_r = robjects.NULL

        # Call R function
        result = bin_categorical_csv_r(
            input_csv,
            output_csv,
            columns_r,
            method,
            n_bins,
            min_freq,
            target_r,
            custom_r,
            similarity_threshold,
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
        frontend_method: Method name from frontend (e.g., 'frequency')

    Returns:
        R function method name (e.g., 'frequency')
    """
    method_mapping = {
        "frequency": "frequency",
        "target-based": "target_based",
        "similarity": "similarity",
        "domain": "domain",
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
    Execute R script to perform encoding on CSV file using subprocess.

    Args:
        csv_path: Path to the selected.csv file (will be read and written)
        selected_columns: List of column names to encode
        method: Encoding method (label, onehot, ordinal, frequency, target)
        target_columns: Target columns for target encoding (optional)

    Raises:
        HTTPException: If R execution fails or environment is invalid
    """
    # Validate R environment
    validate_r_environment()

    try:
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


def handle_text_transformation(
    csv_path: Path,
    selected_columns: List[str],
    k: int = None,
) -> None:
    """
    Execute Python script to transform free text columns into categorical themes.

    Uses sentence embeddings and K-means clustering to create themes.
    Replaces original text with theme labels.

    Args:
        csv_path: Path to the selected.csv file (will be read and written)
        selected_columns: List of column names containing free text
        k: Number of themes/clusters (None for auto-detection)

    Raises:
        HTTPException: If transformation fails
    """
    try:
        # Import the text transformer module
        import sys
        from pathlib import Path as PathLib
        
        backend_path = PathLib(__file__).parent.parent
        if str(backend_path) not in sys.path:
            sys.path.insert(0, str(backend_path))
        
        from text_transformer import transform_csv
        
        # Convert paths to strings
        input_csv = str(csv_path.absolute())
        output_csv = str(csv_path.absolute())  # Write back to same file
        
        # Call the transformation function
        transform_csv(
            input_path=input_csv,
            output_path=output_csv,
            columns=selected_columns,
            n_clusters=k
        )

    except ImportError as e:
        error_msg = str(e)
        if "sentence_transformers" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail="Python package 'sentence-transformers' is not installed. Please run: pip install sentence-transformers",
            )
        elif "sklearn" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail="Python package 'scikit-learn' is not installed. Please run: pip install scikit-learn",
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Import error: {error_msg}",
            )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to transform text: {error_msg}"
        )



def handle_data_reduction(
    csv_path: Path,
    selected_columns: List[str],
    method: str,
    n_components: int,
    rare_threshold: Optional[int] = 5,
    max_cardinality: Optional[int] = 200,
    sample_size: Optional[int] = None,
) -> dict:
    """
    Execute R script to perform data reduction (MCA/FAMD).

    Args:
        csv_path: Path to the selected.csv file (will be read and written)
        selected_columns: List of column names to reduce
        method: Reduction method (auto, mca, famd)
        n_components: Number of components to retain
        rare_threshold: Min frequency to keep category (others -> Other)
        max_cardinality: Skip columns with more unique values than this
        sample_size: Optional row sample size for faster fitting

    Returns:
        Summary dict from R execution

    Raises:
        HTTPException: If R execution fails or environment is invalid
    """
    validate_r_environment()

    summary_path = None

    try:
        r_script_path = Path(__file__).parent.parent / "R_scripts" / "data_reduction.R"

        if not r_script_path.exists():
            raise HTTPException(
                status_code=500, detail=f"R script not found at {r_script_path}"
            )

        robjects.r.source(str(r_script_path))
        reduce_data_csv_r = robjects.r["reduce_data_csv"]

        input_csv = str(csv_path.absolute())
        output_csv = str(csv_path.absolute())
        columns_r = StrVector(selected_columns)

        method_value = (method or "auto").lower()
        rare_value = rare_threshold if rare_threshold is not None else 5
        max_card_value = max_cardinality if max_cardinality is not None else 200
        sample_value = sample_size if sample_size is not None else robjects.NULL

        fd, summary_path = tempfile.mkstemp(suffix=".json")
        os.close(fd)

        reduce_data_csv_r(
            input_csv,
            output_csv,
            columns_r,
            method_value,
            int(n_components),
            int(rare_value),
            int(max_card_value),
            sample_value,
            summary_path,
        )

        if summary_path and os.path.exists(summary_path):
            with open(summary_path, "r", encoding="utf-8") as handle:
                summary = json.load(handle)
        else:
            summary = {}

        return summary

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="rpy2 is not installed. Please install it with: pip install rpy2",
        )
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        lower_msg = error_msg.lower()

        if "numeric-only" in lower_msg:
            raise HTTPException(status_code=400, detail=error_msg)
        if "factominer" in lower_msg:
            raise HTTPException(
                status_code=500,
                detail="R package 'FactoMineR' is required. Please run: install.packages('FactoMineR')",
            )
        if "jsonlite" in lower_msg:
            raise HTTPException(
                status_code=500,
                detail="R package 'jsonlite' is required. Please run: install.packages('jsonlite')",
            )
        if "R_HOME" in error_msg or "not found" in lower_msg:
            raise HTTPException(
                status_code=500,
                detail="R is not properly configured. Please ensure R_HOME environment variable is set and R is in PATH",
            )

        raise HTTPException(
            status_code=500, detail=f"Failed to execute data reduction: {error_msg}"
        )
    finally:
        if summary_path and os.path.exists(summary_path):
            try:
                os.remove(summary_path)
            except OSError:
                pass







