"""
Correlation Analysis API Routes
Provides endpoints for statistical correlation analysis using R
"""


import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional


import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from files.history import log_history  

from .r_executor import check_r_installation, execute_r_script
from ordinal_scales import analyze_dataframe_columns, get_column_order


router = APIRouter(prefix="/api/correlation", tags=["Correlation Analysis"])


# Get FILES_DIR from main app
FILES_DIR = Path(__file__).parent.parent / "files"
R_SCRIPT_DIR = Path(__file__).parent.parent / "R_scripts"


# ==================== NA Value Detection ====================


def is_na_value(value: Any) -> bool:
    """
    Check if a value represents a missing/NA value.
    Only checks for None and pandas NA (not string representations like 'NA' or 'N/A').
    
    Args:
        value: Value to check
        
    Returns:
        True if value is considered missing/NA
    """
    # Only handle pandas NA, None, numpy NaN (not string representations)
    return pd.isna(value) or value is None


def filter_na_values(series: pd.Series) -> pd.Series:
    """
    Filter out all NA values from a pandas Series.
    
    Args:
        series: Pandas Series to filter
        
    Returns:
        Filtered Series with NA values removed
    """
    # Create mask for non-NA values
    mask = series.apply(lambda x: not is_na_value(x))
    return series[mask]


# ==================== Data Models ====================




class VariableConfig(BaseModel):
    """Configuration for a single variable"""


    columnName: str
    type: Literal["nominal", "ordinal"]
    categories: List[str]
    ordering: Optional[Dict[str, int]] = None




class CorrelationRequest(BaseModel):
    """Request for two-variable correlation analysis"""


    userId: str
    fileId: str
    variable1: VariableConfig
    variable2: VariableConfig
    method: str




class MatrixAnalysisRequest(BaseModel):
    """Request for multi-column correlation matrix"""


    userId: str
    fileId: str
    columns: List[str]
    variableConfigs: Dict[str, VariableConfig]
    missingValueMethod: Literal["remove", "mode", "median", "missing_category"] = (
        "remove"
    )
    methodsByPairType: Dict[str, str]




class MissingValueCheckRequest(BaseModel):
    """Request to check missing values in columns"""


    userId: str
    fileId: str
    columns: List[str]




class ColumnInfo(BaseModel):
    """Information about missing values in a column"""


    columnName: str
    missingCount: int
    totalCount: int
    missingPercentage: float




class MissingValueResponse(BaseModel):
    """Response with missing value information"""


    hasMissing: bool
    columnsInfo: List[ColumnInfo]




# ==================== Helper Functions ====================




def get_csv_path(userId: str, fileId: str) -> Path:
    """Get path to user's CSV file"""
    return FILES_DIR / userId / fileId / "selected.csv"




def validate_file_exists(userId: str, fileId: str) -> Path:
    """Validate that the CSV file exists"""
    file_path = get_csv_path(userId, fileId)
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"File not found for userId={userId}, fileId={fileId}",
        )
    return file_path




def get_method_pair_type(type1: str, type2: str) -> str:
    """Determine the pair type from two variable types"""
    if type1 == "nominal" and type2 == "nominal":
        return "nominal-nominal"
    elif type1 == "ordinal" and type2 == "ordinal":
        return "ordinal-ordinal"
    else:
        return "nominal-ordinal"




def prepare_variable_payload(
    var_cfg: VariableConfig, df: pd.DataFrame
) -> Dict[str, Any]:
    """Attach column data to the variable config for R consumption"""
    if var_cfg.columnName not in df.columns:
        raise HTTPException(
            status_code=400, detail=f"Column '{var_cfg.columnName}' not found in file"
        )


    series = df[var_cfg.columnName]
    # Convert None/NaN values to None for R (preserves string values like 'NA', 'N/A')
    data = [None if is_na_value(val) else str(val) for val in series]


    payload = var_cfg.dict()
    payload["data"] = data
    return payload




# ==================== API Endpoints ====================




@router.get("/health")
async def health_check():
    """
    Check R installation and service health


    Returns:
        status: healthy or degraded
        r_installed: boolean
        message: status message
    """
    r_installed = check_r_installation()
    return {
        "status": "healthy" if r_installed else "degraded",
        "r_installed": r_installed,
        "message": "R is installed and ready"
        if r_installed
        else "R is not installed or not in PATH",
    }




@router.get("/columns")
async def get_columns(
    userId: str = Query(..., description="User ID"),
    fileId: str = Query(..., description="File ID"),
):
    """
    Get available columns, their unique categories, and detected ordinal scales
    Excludes 'id' columns and datetime/timestamp columns


    Args:
        userId: User identifier
        fileId: File identifier


    Returns:
        columns: List of column names (excluding id and datetime columns)
        categories: Dict mapping column names to their unique values
        ordinal_info: Dict mapping column names to detected ordinal scale info
    """
    try:
        file_path = validate_file_exists(userId, fileId)
        # Read CSV with explicit NA values to catch all variants
        na_values = ['NA', 'na', 'N/A', 'n/a', 'NaN', 'nan', 'None', 'none', 
                     'null', 'NULL', 'nil', 'NIL', '#N/A', '#NA', 'missing', 
                     'MISSING', 'n.a.', 'N.A.', '<NA>', '<na>', '']
        df = pd.read_csv(file_path, na_values=na_values, keep_default_na=True)


        if df.empty:
            raise HTTPException(status_code=400, detail="File is empty")


        # Helper function to detect datetime columns
        def is_datetime_column(col_name: str, series: pd.Series) -> bool:
            # First check: column name patterns (fast check)
            datetime_patterns = ['date', 'time', 'timestamp', 'datetime', '_at', '_date', '_time', '_ts', '_dt']
            name_matches = any(pattern in col_name.lower() for pattern in datetime_patterns)
            
            # Sample values to verify
            sample = series.dropna().astype(str).head(50)
            if len(sample) == 0:
                return False
            
            # Datetime value patterns
            datetime_value_patterns = [
                r'^\d{4}-\d{2}-\d{2}$',                      # Date: 2024-01-15
                r'^\d{2}/\d{2}/\d{4}$',                      # Date: 01/15/2024
                r'^\d{2}-\d{2}-\d{4}$',                      # Date: 15-01-2024
                r'^\d{4}/\d{2}/\d{2}$',                      # Date: 2024/01/15
                r'^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$',        # DateTime: 12-06-2024 13:39
                r'^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}$',  # DateTime: 12-06-2024 13:39:45
                r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}',     # ISO timestamp
                r'^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}',   # Timestamp: 2024-09-30 14:08:43
                r'^\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}',         # DateTime: 01/15/2024 14:30
                r'^\d{2}:\d{2}:\d{2}$',                      # Time: 14:30:45
                r'^\d{2}:\d{2}$',                            # Time: 14:30
                r'^\d{13}$',                                 # Unix timestamp ms
                r'^\d{10}$',                                 # Unix timestamp sec
            ]
            
            import re
            match_count = sum(
                1 for val in sample
                if any(re.match(pattern, val.strip()) for pattern in datetime_value_patterns)
            )
            match_ratio = match_count / len(sample)
            
            # If name suggests datetime, lower threshold (30%)
            # Otherwise, require 50% threshold (lowered from 70% for better detection)
            # Also check if values contain datetime separators like colons and hyphens
            threshold = 0.3 if name_matches else 0.5
            
            # Additional heuristic: if more than 30% of values contain datetime patterns
            # (dates with time like "2024-09-30 14:08:43"), mark as datetime
            datetime_with_time_count = sum(
                1 for val in sample
                if re.search(r'\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}', val.strip())
            )
            if datetime_with_time_count / len(sample) > 0.3:
                return True
            
            return match_ratio > threshold


        # Filter columns: exclude 'id' and datetime columns
        columns = [
            col for col in df.columns
            if col.lower() != 'id' and not is_datetime_column(col, df[col])
        ]
       
        # Get categories, filtering out all NA variants
        categories = {}
        for col in columns:
            # Filter NA values including 'na', 'N/A', 'nan', etc.
            filtered = filter_na_values(df[col])
            unique_vals = filtered.astype(str).unique().tolist()
            categories[col] = sorted(unique_vals)
       
        # Detect ordinal scales (only for filtered columns)
        ordinal_info = {
            col: info
            for col, info in analyze_dataframe_columns(df).items()
            if col in columns
        }


        return {
            "columns": columns,
            "categories": categories,
            "ordinal_info": ordinal_info
        }


    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="File is empty or corrupted")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")




@router.get("/methods")
async def get_methods(
    type1: Literal["nominal", "ordinal"] = Query(
        ..., description="First variable type"
    ),
    type2: Literal["nominal", "ordinal"] = Query(
        ..., description="Second variable type"
    ),
):
    """
    Get available correlation methods for given variable types


    Args:
        type1: First variable type (nominal/ordinal)
        type2: Second variable type (nominal/ordinal)


    Returns:
        methods: List of available methods with descriptions
    """
    methods_map = {
        "nominal-nominal": [
            {
                "value": "chi_square",
                "label": "Chi-square test of independence (χ²)",
                "description": "Tests independence between categorical variables",
            },
            {
                "value": "phi",
                "label": "Phi coefficient (φ)",
                "description": "Correlation measure for 2×2 contingency tables",
            },
            {
                "value": "cramers_v",
                "label": "Cramér's V",
                "description": "Normalized chi-square measure (0-1 scale)",
            },
        ],
        "ordinal-ordinal": [
            {
                "value": "spearman",
                "label": "Spearman's rank correlation (ρ)",
                "description": "Measures monotonic relationship between ordinal variables",
            },
            {
                "value": "kendall_tau",
                "label": "Kendall's tau-b (τb)",
                "description": "Rank correlation coefficient for ordinal data",
            },
            {
                "value": "somers_d",
                "label": "Somers' D",
                "description": "Asymmetric measure of ordinal association",
            },
            {
                "value": "pearson_ordinal",
                "label": "Pearson correlation on ordered scores",
                "description": "Linear correlation on numeric ordinal values",
            },
        ],
        "nominal-ordinal": [
            {
                "value": "anova_eta",
                "label": "One-way ANOVA with eta-squared (η²)",
                "description": "Measures strength of nominal-ordinal relationship",
            },
            {
                "value": "kruskal_wallis",
                "label": "Kruskal-Wallis H test with epsilon-squared (ε²)",
                "description": "Non-parametric test for nominal-ordinal association",
            },
        ],
    }


    pair_type = get_method_pair_type(type1, type2)
    return {"methods": methods_map.get(pair_type, [])}




@router.post("/analyze")
async def analyze_correlation(request: CorrelationRequest):
    """
    Perform correlation analysis on two variables


    Args:
        request: CorrelationRequest with variable configurations


    Returns:
        Correlation analysis results including effect size, p-value, interpretation
    """
    try:
        # Debug: Log the incoming request
        print(f"\n=== ANALYZE CORRELATION DEBUG ===")
        print(f"Method: {request.method}")
        print(f"Variable 1: {request.variable1.columnName} (type: {request.variable1.type})")
        print(f"Variable 1 ordering: {request.variable1.ordering}")
        print(f"Variable 2: {request.variable2.columnName} (type: {request.variable2.type})")
        print(f"Variable 2 ordering: {request.variable2.ordering}")
        print(f"=================================\n", flush=True)
        
        # Validate R installation
        if not check_r_installation():
            raise HTTPException(
                status_code=503, detail="R is not installed or not available in PATH"
            )


        # Validate file exists
        file_path = validate_file_exists(request.userId, request.fileId)
        # Read CSV with explicit NA values to catch all variants
        na_values = ['NA', 'na', 'N/A', 'n/a', 'NaN', 'nan', 'None', 'none', 
                     'null', 'NULL', 'nil', 'NIL', '#N/A', '#NA', 'missing', 
                     'MISSING', 'n.a.', 'N.A.', '<NA>', '<na>', '']
        df = pd.read_csv(file_path, na_values=na_values, keep_default_na=True)


        var1_payload = prepare_variable_payload(request.variable1, df)
        var2_payload = prepare_variable_payload(request.variable2, df)


        # Prepare R script input
        r_input = {
            "file_path": str(file_path),
            "variable1": var1_payload,
            "variable2": var2_payload,
            "method": request.method,
            "missing_method": "remove",
            "analysis_type": "single",
        }


        # Execute R script
        r_script_path = R_SCRIPT_DIR / "correlation_analysis.R"
        result = execute_r_script(r_script_path, r_input)


        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])


        # Attach display metadata expected by the frontend/spec
        result["variable1_name"] = request.variable1.columnName
        result["variable2_name"] = request.variable2.columnName
        result["method"] = request.method
        try:
            file_dir = FILES_DIR / request.userId / request.fileId
            log_history(
                file_dir,
                action="Correlation Analysis",
                method=request.method,
                input_cols=[request.variable1.columnName, request.variable2.columnName],
                output_cols=[],
                params={"method": request.method}
            )
        except Exception as e:
            print(f"Logging failed: {e}")
        return result


    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")




@router.post("/check-missing", response_model=MissingValueResponse)
async def check_missing_values(request: MissingValueCheckRequest):
    """
    Check for missing values in specified columns


    Args:
        request: MissingValueCheckRequest with columns to check


    Returns:
        Missing value information for each column
    """
    try:
        file_path = validate_file_exists(request.userId, request.fileId)
        # Read CSV with explicit NA values to catch all variants
        na_values = ['NA', 'na', 'N/A', 'n/a', 'NaN', 'nan', 'None', 'none', 
                     'null', 'NULL', 'nil', 'NIL', '#N/A', '#NA', 'missing', 
                     'MISSING', 'n.a.', 'N.A.', '<NA>', '<na>', '']
        df = pd.read_csv(file_path, na_values=na_values, keep_default_na=True)


        columns_info = []
        has_missing = False


        for col in request.columns:
            if col not in df.columns:
                raise HTTPException(
                    status_code=400, detail=f"Column '{col}' not found in file"
                )


            # Count missing values using comprehensive NA detection
            missing_mask = df[col].apply(is_na_value)
            missing_count = missing_mask.sum()
            total_count = len(df)
            missing_percentage = (
                (missing_count / total_count * 100) if total_count > 0 else 0
            )


            if missing_count > 0:
                has_missing = True


            columns_info.append(
                ColumnInfo(
                    columnName=col,
                    missingCount=int(missing_count),
                    totalCount=total_count,
                    missingPercentage=round(missing_percentage, 2),
                )
            )


        return MissingValueResponse(hasMissing=has_missing, columnsInfo=columns_info)


    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error checking missing values: {str(e)}"
        )




@router.post("/analyze-matrix")
async def analyze_correlation_matrix(request: MatrixAnalysisRequest):
    """
    Perform correlation analysis on multiple columns (matrix)


    Args:
        request: MatrixAnalysisRequest with all variable configurations


    Returns:
        Correlation matrix and detailed pair results
    """
    try:
        # Validate R installation
        if not check_r_installation():
            raise HTTPException(
                status_code=503, detail="R is not installed or not available in PATH"
            )


        # Validate file exists
        file_path = validate_file_exists(request.userId, request.fileId)
        # Read CSV with explicit NA values to catch all variants
        na_values = ['NA', 'na', 'N/A', 'n/a', 'NaN', 'nan', 'None', 'none', 
                     'null', 'NULL', 'nil', 'NIL', '#N/A', '#NA', 'missing', 
                     'MISSING', 'n.a.', 'N.A.', '<NA>', '<na>', '']
        df = pd.read_csv(file_path, na_values=na_values, keep_default_na=True)


        # Validate requested columns and configs
        missing_cols = [col for col in request.columns if col not in df.columns]
        if missing_cols:
            raise HTTPException(
                status_code=400,
                detail=f"Columns not found in file: {', '.join(missing_cols)}",
            )


        for col in request.columns:
            if col not in request.variableConfigs:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing variable configuration for column '{col}'",
                )


        r_script_path = R_SCRIPT_DIR / "correlation_analysis.R"
        pair_details: Dict[str, Any] = {}
        pair_values: Dict[tuple, Dict[str, Any]] = {}


        # Prepare all pair tasks for parallel execution
        async def analyze_pair(i: int, j: int) -> tuple:
            """Analyze a single pair asynchronously"""
            col_i = request.columns[i]
            col_j = request.columns[j]


            cfg_i = request.variableConfigs[col_i]
            cfg_j = request.variableConfigs[col_j]


            pair_type = get_method_pair_type(cfg_i.type, cfg_j.type)
            method = request.methodsByPairType.get(pair_type)
            if not method:
                return (i, j, col_i, col_j, {"error": f"No method configured for pair type '{pair_type}'"})


            var1_payload = prepare_variable_payload(cfg_i, df)
            var2_payload = prepare_variable_payload(cfg_j, df)


            r_input = {
                "file_path": str(file_path),
                "variable1": var1_payload,
                "variable2": var2_payload,
                "method": method,
                "missing_method": request.missingValueMethod,
                "analysis_type": "matrix",
            }


            result = await execute_r_script_async(r_script_path, r_input, timeout=120)
            return (i, j, col_i, col_j, result, method, cfg_i, cfg_j)


        # Create tasks for all pairs
        tasks = []
        for i in range(len(request.columns)):
            for j in range(i + 1, len(request.columns)):
                tasks.append(analyze_pair(i, j))


        # Execute all pairs in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)


        # Process results
        for result_data in results:
            if isinstance(result_data, Exception):
                raise HTTPException(
                    status_code=500,
                    detail=f"Error processing pair: {str(result_data)}"
                )
           
            i, j, col_i, col_j, result, method, cfg_i, cfg_j = result_data
           
            if "error" in result:
                error_detail = result['error']
                var1_info = f"{col_i} (type: {cfg_i.type}, categories: {len(cfg_i.categories)})"
                var2_info = f"{col_j} (type: {cfg_j.type}, categories: {len(cfg_j.categories)})"
                raise HTTPException(
                    status_code=500,
                    detail=f"R error for pair {col_i} vs {col_j}:\n{error_detail}\n\nVariable 1: {var1_info}\nVariable 2: {var2_info}\nMethod: {method}",
                )


            res_body = result.get("result", {})
            correlation_value = res_body.get("effect_size")
            if correlation_value is None:
                correlation_value = res_body.get("statistic")


            pair_values[(i, j)] = {
                "correlation": correlation_value,
                "p_value": res_body.get("p_value"),
                "method": method,
            }


            pair_details[f"{col_i}::{col_j}"] = {
                "method": method,
                "method_name": result.get("method_name", method),
                "result": res_body,
                "sample_size": result.get("sample_size"),
                "removed_rows": result.get("removed_rows"),
                "missing_category_rows": result.get("missing_category_rows"),
                "variable1_name": col_i,
                "variable2_name": col_j,
            }


        # Build symmetric matrix with diagonal
        matrix = []
        num_cols = len(request.columns)
        for i in range(num_cols):
            row = []
            for j in range(num_cols):
                if i == j:
                    row.append(
                        {
                            "row": i,
                            "col": j,
                            "row_name": request.columns[i],
                            "col_name": request.columns[j],
                            "correlation": 1.0,
                            "p_value": 0.0,
                            "method": "self",
                            "is_diagonal": True,
                        }
                    )
                else:
                    val = pair_values[(i, j)] if i < j else pair_values[(j, i)]
                    row.append(
                        {
                            "row": i,
                            "col": j,
                            "row_name": request.columns[i],
                            "col_name": request.columns[j],
                            "correlation": val.get("correlation"),
                            "p_value": val.get("p_value"),
                            "method": val.get("method"),
                            "is_diagonal": False,
                        }
                    )
            matrix.append(row)     
        # --- PASTE THIS BLOCK HERE ---
        try:
            file_dir = FILES_DIR / request.userId / request.fileId
            log_history(
                file_dir,
                action="Correlation Analysis",
                method="Matrix",
                input_cols=request.columns,
                output_cols=[],
                params={"type": "matrix", "methods": request.methodsByPairType}
            )
        except Exception as e:
            print(f"Logging failed: {e}")
        # -----------------------------
        return {
            "matrix": matrix,
            "columns": request.columns,
            "pairDetails": pair_details,
        }


    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Matrix analysis failed: {str(e)}")



