# -*- coding: utf-8 -*-
"""
Correlation Analysis API Routes

This module defines FastAPI routes for correlation analysis operations.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Literal, Any
from pathlib import Path
import pandas as pd
import logging
import os
import subprocess
import json

from .r_executor import execute_r_script, RExecutionError, check_r_installation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/correlation", tags=["correlation"])

# Get the absolute path to the backend directory
BACKEND_DIR = Path(__file__).resolve().parent.parent
FILES_DIR = BACKEND_DIR / "files"
R_SCRIPT_PATH = BACKEND_DIR / "R_scripts" / "correlation_analysis.R"


# Request/Response Models
class VariableConfig(BaseModel):
    """Configuration for a single variable in correlation analysis"""
    columnName: str
    type: Literal["nominal", "ordinal"]
    categories: List[str]
    ordering: Optional[Dict[str, int]] = None  # Maps category to order number


# Helper Functions
def prepare_r_input(df: pd.DataFrame, col_i: str, col_j: str, 
                   config_i: VariableConfig, config_j: VariableConfig,
                   method: str, missing_method: str) -> dict:
    """Prepare input data for R script."""
    # Check if we need to swap variables for asymmetric methods
    should_swap = (method in ["anova_eta", "kruskal_wallis"] and 
                   config_i.type == "ordinal" and config_j.type == "nominal")
    
    if should_swap:
        col1, col2 = col_j, col_i
        var1_config, var2_config = config_j, config_i
    else:
        col1, col2 = col_i, col_j
        var1_config, var2_config = config_i, config_j
    
    return {
        "variable1": {
            "name": col1,
            "data": df[col1].fillna('').astype(str).tolist(),
            "type": var1_config.type,
            "categories": var1_config.categories,
            "ordering": var1_config.ordering
        },
        "variable2": {
            "name": col2,
            "data": df[col2].fillna('').astype(str).tolist(),
            "type": var2_config.type,
            "categories": var2_config.categories,
            "ordering": var2_config.ordering
        },
        "method": method,
        "missing_method": missing_method
    }


def extract_correlation_value(result: dict) -> Optional[float]:
    """Extract correlation/effect size from R result."""
    effect_size = result.get("result", {}).get("effect_size")
    if effect_size is not None:
        return effect_size
    return result.get("result", {}).get("statistic")


def create_matrix_cell(row: int, col: int, row_name: str, col_name: str,
                       correlation: Optional[float] = None, p_value: Optional[float] = None,
                       method: str = None, is_diagonal: bool = False) -> 'MatrixCell':
    """Create a matrix cell with given parameters."""
    return MatrixCell(
        row=row,
        col=col,
        row_name=row_name,
        col_name=col_name,
        correlation=correlation,
        p_value=p_value,
        method=method,
        is_diagonal=is_diagonal
    )


class CorrelationRequest(BaseModel):
    """Request model for correlation analysis"""
    userId: str
    fileId: str
    variable1: VariableConfig
    variable2: VariableConfig
    method: str = Field(
        ...,
        description="Correlation method: chi_square, phi, cramers_v, spearman, "
                    "kendall_tau, somers_d, pearson_ordinal, anova_eta, kruskal_wallis"
    )


class CorrelationResult(BaseModel):
    """Result model for correlation analysis"""
    method: str
    method_name: str
    result: Dict[str, Any]
    sample_size: int
    removed_rows: int
    missing_category_rows: int = 0
    variable1_name: str
    variable2_name: str


class ColumnInfo(BaseModel):
    """Information about available columns and their categories"""
    columns: List[str]
    categories: Dict[str, List[str]]


@router.get("/health")
async def health_check():
    """Check if R is installed and ready"""
    r_installed = check_r_installation()
    return {
        "status": "healthy" if r_installed else "degraded",
        "r_installed": r_installed,
        "message": "R is installed and ready" if r_installed else "R is not installed or not in PATH"
    }


@router.get("/columns", response_model=ColumnInfo)
async def get_column_info(userId: str, fileId: str):
    """
    Get available columns and their categories from the selected dataset.
    
    Args:
        userId: User identifier
        fileId: File identifier
        
    Returns:
        ColumnInfo containing list of columns and categories for each column
    """
    try:
        # Construct path to selected.csv file using absolute path
        file_path = FILES_DIR / userId / fileId / "selected.csv"
        
        logger.info(f"Looking for file at: {file_path}")
        logger.info(f"File exists: {file_path.exists()}")
        logger.info(f"Absolute path: {file_path.absolute()}")
        
        if not file_path.exists():
            # Log the directory structure for debugging
            user_path = FILES_DIR / userId
            if user_path.exists():
                logger.info(f"User directory exists. Files: {list(user_path.iterdir())}")
                file_dir = user_path / fileId
                if file_dir.exists():
                    logger.info(f"File directory exists. Contents: {list(file_dir.iterdir())}")
            
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Selected data file not found for user {userId}, file {fileId}"
            )
        
        # Read the CSV file
        df = pd.read_csv(file_path)
        
        if df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected data file is empty"
            )
        
        # Get column names
        columns = df.columns.tolist()
        
        # Get unique categories for each column (excluding NaN)
        categories = {}
        for col in columns:
            # Get unique values, convert to string, and filter out NaN
            unique_values = df[col].dropna().astype(str).unique().tolist()
            categories[col] = sorted(unique_values)
        
        logger.info(f"Retrieved {len(columns)} columns with categories for user {userId}, file {fileId}")
        
        return ColumnInfo(columns=columns, categories=categories)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving column info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve column information: {str(e)}"
        )


@router.post("/analyze", response_model=CorrelationResult)
async def analyze_correlation(request: CorrelationRequest):
    """
    Perform correlation analysis on two variables using specified method.
    
    Args:
        request: CorrelationRequest containing variable configurations and method
        
    Returns:
        CorrelationResult containing analysis results and statistics
    """
    # Validate R installation
    if not check_r_installation():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="R is not installed or not accessible. Please install R to use correlation analysis."
        )
    
    try:
        # Construct path to selected.csv file using absolute path
        file_path = FILES_DIR / request.userId / request.fileId / "selected.csv"
        
        logger.info(f"Analyzing correlation for file: {file_path}")
        
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Selected data file not found"
            )
        
        # Read the entire CSV file
        df = pd.read_csv(file_path)
        
        # Validate columns exist
        if request.variable1.columnName not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Column '{request.variable1.columnName}' not found in dataset"
            )
        if request.variable2.columnName not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Column '{request.variable2.columnName}' not found in dataset"
            )
        
        # Extract the two columns and prepare R input
        r_input = prepare_r_input(
            df=df,
            col_i=request.variable1.columnName,
            col_j=request.variable2.columnName,
            config_i=request.variable1,
            config_j=request.variable2,
            method=request.method,
            missing_method="remove"
        )
        
        logger.info(f"R script input prepared - Method: {request.method}, Variables: {request.variable1.columnName} vs {request.variable2.columnName}")
        logger.info(f"Total data points: {len(df)}")
        
        # Execute R script
        if not R_SCRIPT_PATH.exists():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Correlation analysis R script not found"
            )
        
        logger.info(f"Starting correlation analysis: {request.method} for {request.variable1.columnName} vs {request.variable2.columnName}")
        
        result = execute_r_script(R_SCRIPT_PATH, r_input, timeout=120)
        
        # Validate result structure
        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"R script error: {result['error']}"
            )
        
        logger.info(f"Correlation analysis completed successfully")
        
        return CorrelationResult(
            method=request.method,
            method_name=result.get("method_name", request.method),
            result=result.get("result", {}),
            sample_size=result.get("sample_size", 0),
            removed_rows=result.get("removed_rows", 0),
            missing_category_rows=result.get("missing_category_rows", 0),
            variable1_name=request.variable1.columnName,
            variable2_name=request.variable2.columnName
        )
    
    except RExecutionError as e:
        logger.error(f"R execution error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute correlation analysis: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in correlation analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )


# Method validation endpoint
@router.get("/methods")
async def get_available_methods(
    type1: Literal["nominal", "ordinal"],
    type2: Literal["nominal", "ordinal"]
):
    """
    Get available correlation methods based on variable types.
    
    Args:
        type1: Type of first variable (nominal or ordinal)
        type2: Type of second variable (nominal or ordinal)
        
    Returns:
        List of available methods with their descriptions
    """
    methods = []
    
    if type1 == "nominal" and type2 == "nominal":
        methods = [
            {"value": "chi_square", "label": "Chi-square test of independence (χ²)", "description": "Tests independence between two nominal variables"},
            {"value": "phi", "label": "Phi coefficient (ϕ)", "description": "Association measure for 2×2 contingency tables"},
            {"value": "cramers_v", "label": "Cramer's V", "description": "Measure of association for nominal variables"}
        ]
    elif type1 == "ordinal" and type2 == "ordinal":
        methods = [
            {"value": "spearman", "label": "Spearman's rank correlation (ρ)", "description": "Measures monotonic relationship between ordinal variables"},
            {"value": "kendall_tau", "label": "Kendall's tau-b (τb)", "description": "Rank correlation coefficient for ordinal data"},
            {"value": "somers_d", "label": "Somers' D", "description": "Asymmetric measure of ordinal association"},
            {"value": "pearson_ordinal", "label": "Pearson correlation on ordinal scores", "description": "Linear correlation on ordered categories"}
        ]
    else:  # One ordinal, one nominal
        methods = [
            {"value": "anova_eta", "label": "One-way ANOVA + eta squared (η²)", "description": "Tests mean differences across nominal groups with ordinal outcome"},
            {"value": "kruskal_wallis", "label": "Kruskal-Wallis test + epsilon-squared (ε²)", "description": "Non-parametric test for ordinal data across nominal groups"}
        ]
    
    return {"methods": methods}


# Multi-column correlation models
class MultiColumnCorrelationRequest(BaseModel):
    """Request model for multi-column correlation analysis"""
    userId: str
    fileId: str
    columns: List[str]  # Multiple columns to analyze
    variableConfigs: Dict[str, VariableConfig]  # {columnName: config}
    missingValueMethod: Literal["remove", "mode", "median", "missing_category"] = "remove"
    methodsByPairType: Dict[str, str]  # {"nominal-nominal": "chi_square", "ordinal-ordinal": "spearman", "nominal-ordinal": "anova_eta"}


class MatrixCell(BaseModel):
    """Single cell in correlation matrix"""
    row: int
    col: int
    row_name: str
    col_name: str
    correlation: Optional[float] = None
    p_value: Optional[float] = None
    method: Optional[str] = None
    is_diagonal: bool = False


class CorrelationMatrixResponse(BaseModel):
    """Response model for correlation matrix"""
    matrix: List[List[MatrixCell]]
    columns: List[str]
    pairDetails: Dict[str, CorrelationResult]  # Key: "col1::col2"


class MissingValueInfo(BaseModel):
    """Information about missing values in columns"""
    columnName: str
    missingCount: int
    totalCount: int
    missingPercentage: float


class MissingValueCheckRequest(BaseModel):
    """Request for missing value check"""
    userId: str
    fileId: str
    columns: List[str]


class MissingValuesCheckResponse(BaseModel):
    """Response for missing values check"""
    hasMissing: bool
    columnsInfo: List[MissingValueInfo]


@router.post("/check-missing")
async def check_missing_values(request: MissingValueCheckRequest):
    """
    Check for missing values in selected columns.
    
    Args:
        request: MissingValueCheckRequest containing userId, fileId, and columns
        
    Returns:
        MissingValuesCheckResponse with missing value information
    """
    userId = request.userId
    fileId = request.fileId
    columns = request.columns
    try:
        file_path = FILES_DIR / userId / fileId / "selected.csv"
        
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected data file not found"
            )
        
        df = pd.read_csv(file_path)
        
        columns_info = []
        has_missing = False
        
        for col in columns:
            if col not in df.columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Column '{col}' not found in dataset"
                )
            
            # Check for missing values: only actual NaN/None and empty strings
            # Do NOT treat string literals like 'NA', 'na' as missing (they might be legitimate data)
            missing_mask = (
                df[col].isna() | 
                (df[col].astype(str).str.strip() == '')
            )
            missing_count = missing_mask.sum()
            total_count = len(df[col])
            missing_pct = (missing_count / total_count * 100) if total_count > 0 else 0
            
            if missing_count > 0:
                has_missing = True
            
            columns_info.append(MissingValueInfo(
                columnName=col,
                missingCount=int(missing_count),
                totalCount=total_count,
                missingPercentage=round(missing_pct, 2)
            ))
        
        return MissingValuesCheckResponse(
            hasMissing=has_missing,
            columnsInfo=columns_info
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking missing values: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check missing values: {str(e)}"
        )


@router.post("/analyze-matrix", response_model=CorrelationMatrixResponse)
async def analyze_correlation_matrix(request: MultiColumnCorrelationRequest):
    """
    Perform correlation analysis on multiple columns and return a correlation matrix.
    
    Args:
        request: MultiColumnCorrelationRequest containing multiple columns and configurations
        
    Returns:
        CorrelationMatrixResponse containing correlation matrix and detailed results
    """
    # Validate R installation
    if not check_r_installation():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="R is not installed or not accessible. Please install R to use correlation analysis."
        )
    
    try:
        file_path = FILES_DIR / request.userId / request.fileId / "selected.csv"
        
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected data file not found"
            )
        
        # Read the CSV file
        df = pd.read_csv(file_path)
        
        # Validate all columns exist
        for col in request.columns:
            if col not in df.columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Column '{col}' not found in dataset"
                )
        
        # Don't extract selected columns - keep full dataframe for pairwise analysis
        # Each pair will get the full data for just those two columns
        logger.info(f"Using full dataframe for pairwise deletion. Each pair will handle missing values independently.")
        logger.info(f"Missing value method: {request.missingValueMethod}")
        
        # Initialize matrix and pair details
        n_cols = len(request.columns)
        matrix = []
        pair_details = {}
        
        # Build correlation matrix
        for i in range(n_cols):
            row = []
            for j in range(n_cols):
                col_i = request.columns[i]
                col_j = request.columns[j]
                
                if i == j:
                    # Diagonal: perfect correlation with self
                    row.append(create_matrix_cell(
                        row=i, col=j, row_name=col_i, col_name=col_j,
                        correlation=1.0, p_value=0.0, method="self", is_diagonal=True
                    ))
                elif i < j:
                    # Upper triangle: compute correlation
                    config_i = request.variableConfigs[col_i]
                    config_j = request.variableConfigs[col_j]
                    
                    # Determine pair type
                    if config_i.type == "nominal" and config_j.type == "nominal":
                        pair_type = "nominal-nominal"
                    elif config_i.type == "ordinal" and config_j.type == "ordinal":
                        pair_type = "ordinal-ordinal"
                    else:
                        pair_type = "nominal-ordinal"
                    
                    # Get method for this pair type
                    method = request.methodsByPairType.get(pair_type)
                    
                    if not method:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"No method specified for pair type: {pair_type}"
                        )
                    
                    # Prepare R input using helper function
                    r_input = prepare_r_input(
                        df=df,
                        col_i=col_i,
                        col_j=col_j,
                        config_i=config_i,
                        config_j=config_j,
                        method=method,
                        missing_method=request.missingValueMethod
                    )
                    
                    # Execute R script with error handling
                    try:
                        result = execute_r_script(R_SCRIPT_PATH, r_input, timeout=120)
                        
                        # Check for R script errors
                        if "error" in result:
                            logger.warning(f"R script error for {col_i} vs {col_j}: {result['error']}")
                            row.append(create_matrix_cell(i, j, col_i, col_j, method=method))
                            continue
                        
                        # Extract correlation and p-value
                        correlation = extract_correlation_value(result)
                        p_value = result.get("result", {}).get("p_value")
                        
                        # Check if we have valid data
                        if correlation is None or p_value is None:
                            logger.warning(f"Missing effect size/statistic or p-value for {col_i} vs {col_j}")
                        
                        # Store in matrix
                        row.append(create_matrix_cell(i, j, col_i, col_j, correlation, p_value, method))
                        
                        # Store detailed results
                        pair_key = f"{col_i}::{col_j}"
                        pair_details[pair_key] = CorrelationResult(
                            method=method,
                            method_name=result.get("method_name", method),
                            result=result.get("result", {}),
                            sample_size=result.get("sample_size", 0),
                            removed_rows=result.get("removed_rows", 0),  # Use R's removed_rows from pairwise deletion
                            variable1_name=col_i,
                            variable2_name=col_j
                        )
                        
                    except Exception as e:
                        logger.error(f"Error analyzing {col_i} vs {col_j}: {str(e)}")
                        row.append(create_matrix_cell(i, j, col_i, col_j, method=method))
                    
                else:
                    # Lower triangle: mirror upper triangle
                    mirror_key = f"{col_j}::{col_i}"
                    if mirror_key in pair_details:
                        mirror_result = pair_details[mirror_key]
                        mirror_correlation = extract_correlation_value({"result": mirror_result.result})
                        row.append(create_matrix_cell(
                            i, j, col_i, col_j,
                            mirror_correlation,
                            mirror_result.result.get("p_value"),
                            mirror_result.method
                        ))
                    else:
                        # Shouldn't happen, but add placeholder
                        row.append(create_matrix_cell(i, j, col_i, col_j))
            
            matrix.append(row)
        
        logger.info(f"Correlation matrix completed: {n_cols}x{n_cols} with {len(pair_details)} pairs")
        
        return CorrelationMatrixResponse(
            matrix=matrix,
            columns=request.columns,
            pairDetails=pair_details
        )
    
    except RExecutionError as e:
        logger.error(f"R execution error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute correlation analysis: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in matrix correlation analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )
