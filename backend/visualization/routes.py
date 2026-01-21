"""
Visualization API routes for R-backed plot data generation.
"""

from pathlib import Path
from typing import Any, Dict, Literal, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from files.history import log_history  
from correlation.r_executor import check_r_installation, execute_r_script
from ordinal_scales import analyze_dataframe_columns, get_column_order

router = APIRouter(prefix="/api/visualization", tags=["Visualization"])

FILES_DIR = Path(__file__).parent.parent / "files"
R_SCRIPT_DIR = Path(__file__).parent.parent / "R_scripts"


class PlotRequest(BaseModel):
    userId: str
    fileId: str
    chartType: Literal[
        # Univariate categorical
        "bar",
        "topn_bar",
        "pareto",
        "cumulative_percent",
        "ordered_bar",
        # Bivariate categorical
        "stacked_bar_100",
        "grouped_bar",
        "contingency_heatmap_percent",
        "likert_diverging",
        # Association analysis
        "assoc_heatmap",
        "assoc_target_bar",
        # Legacy/numeric
        "pie",
        "histogram",
        "qq",
        "qqline",
        "scatter",
        "stacked_bar",
    ]
    xColumn: Optional[str] = None
    yColumn: Optional[str] = None
    options: Optional[Dict[str, Any]] = None


def get_csv_path(user_id: str, file_id: str) -> Path:
    return FILES_DIR / user_id / file_id / "selected.csv"


def validate_file_exists(user_id: str, file_id: str) -> Path:
    file_path = get_csv_path(user_id, file_id)
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"File not found for userId={user_id}, fileId={file_id}",
        )
    return file_path


def validate_columns(
    available_columns: list[str],
    chart_type: str,
    x_column: Optional[str],
    y_column: Optional[str],
) -> None:
    # Univariate charts requiring x_column
    univariate_charts = {
        "bar", "topn_bar", "pareto", "cumulative_percent", "ordered_bar",
        "pie", "histogram", "qq", "qqline"
    }
    
    # Bivariate charts requiring both x and y columns
    bivariate_charts = {
        "stacked_bar_100", "grouped_bar", "contingency_heatmap_percent",
        "likert_diverging", "scatter", "stacked_bar"
    }
    
    # Association charts don't require x/y (work on full dataset)
    association_charts = {"assoc_heatmap", "assoc_target_bar"}
    
    if chart_type in univariate_charts:
        if not x_column:
            raise HTTPException(status_code=400, detail="xColumn is required")
    
    if chart_type in bivariate_charts:
        if not x_column or not y_column:
            raise HTTPException(
                status_code=400, detail="xColumn and yColumn are required"
            )
    
    if chart_type in association_charts:
        # target_column validated in R script
        pass
    
    # Validate columns exist
    for col in [x_column, y_column]:
        if col and col not in available_columns:
            raise HTTPException(
                status_code=400, detail=f"Column '{col}' not found in file"
            )


@router.post("/plot")
async def create_plot(request: PlotRequest):
    if not check_r_installation():
        raise HTTPException(
            status_code=503, detail="R is not installed or not available in PATH"
        )

    file_path = validate_file_exists(request.userId, request.fileId)

    try:
        available_columns = list(pd.read_csv(file_path, nrows=0).columns)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

    validate_columns(
        available_columns, request.chartType, request.xColumn, request.yColumn
    )

    r_script_path = R_SCRIPT_DIR / "visualization.R"
    r_input = {
        "file_path": str(file_path),
        "chart_type": request.chartType,
        "x_column": request.xColumn,
        "y_column": request.yColumn,
        "options": request.options or {},
    }

    # Increase timeout for association analysis (can be slower)
    timeout = 300 if request.chartType in {"assoc_heatmap", "assoc_target_bar"} else 120

    result = execute_r_script(r_script_path, r_input, timeout=timeout)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    try:
        file_dir = FILES_DIR / request.userId / request.fileId
        cols_used = []
        if request.xColumn: cols_used.append(request.xColumn)
        if request.yColumn: cols_used.append(request.yColumn)

        log_history(
            file_dir,
            action="Visualization",
            method=request.chartType,
            input_cols=cols_used,
            output_cols=[],
            params={
                "x": request.xColumn,
                "y": request.yColumn,
                "options": request.options or {}
            }
        )
    except Exception as e:
        print(f"Logging failed: {e}")

    return result


@router.get("/column-metadata/{userId}/{fileId}")
async def get_column_metadata(userId: str, fileId: str):
    """
    Get metadata about columns including detected ordinal scales.
    """
    file_path = validate_file_exists(userId, fileId)
    
    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")
    
    # Analyze columns for ordinal scales
    ordinal_info = analyze_dataframe_columns(df)
    
    # Build metadata for all columns
    metadata = {}
    for col in df.columns:
        if col == "id":
            continue
            
        unique_values = df[col].dropna().unique()
        unique_count = len(unique_values)
        
        col_meta = {
            "name": col,
            "unique_count": int(unique_count),
            "has_missing": bool(df[col].isna().any()),
            "missing_count": int(df[col].isna().sum())
        }
        
        # Add ordinal info if detected
        if col in ordinal_info:
            col_meta["ordinal"] = ordinal_info[col]
        
        metadata[col] = col_meta
    
    return {
        "columns": metadata,
        "row_count": len(df)
    }
