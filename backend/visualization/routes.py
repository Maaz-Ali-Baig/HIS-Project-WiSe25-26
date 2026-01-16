"""
Visualization API routes for R-backed plot data generation.
"""

from pathlib import Path
from typing import Any, Dict, Literal, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from correlation.r_executor import check_r_installation, execute_r_script

router = APIRouter(prefix="/api/visualization", tags=["Visualization"])

FILES_DIR = Path(__file__).parent.parent / "files"
R_SCRIPT_DIR = Path(__file__).parent.parent / "R_scripts"


class PlotRequest(BaseModel):
    userId: str
    fileId: str
    chartType: Literal[
        "pie",
        "bar",
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
    if chart_type in {"pie", "bar", "histogram", "qq", "qqline"}:
        if not x_column:
            raise HTTPException(status_code=400, detail="xColumn is required")
    if chart_type in {"scatter", "stacked_bar"}:
        if not x_column or not y_column:
            raise HTTPException(
                status_code=400, detail="xColumn and yColumn are required"
            )

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

    result = execute_r_script(r_script_path, r_input)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return result
