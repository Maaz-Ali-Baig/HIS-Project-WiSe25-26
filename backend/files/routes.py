"""File upload routes for CSV file management."""

import csv
import io
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiofiles
from database.db import (
    generate_uuid_v7,
    get_file_metadata,
    get_user_by_id,
    update_file_timestamp,
    upsert_file_metadata,
    validate_column_ranges,
    store_dr_result,
    get_dr_results,
    get_dr_result_by_run_id,
)
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from fastapi.responses import FileResponse
from .history import log_history
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import json
import io
import base64
import datetime


def get_base64_plot(plt_obj):
    """Converts a Matplotlib plot to a Base64 string for HTML embedding."""
    buf = io.BytesIO()
    plt_obj.savefig(buf, format='png', bbox_inches='tight')
    buf.seek(0)
    data = base64.b64encode(buf.read()).decode('utf-8')
    plt_obj.close()
    return f"data:image/png;base64,{data}"

def generate_html_report(processed_path: Path, original_path: Path, output_dir: Path) -> Path:
    # 1. Load Data
    try:
        df = pd.read_csv(processed_path)
    except:
        df = pd.DataFrame()

    # 2. Load History
    history_file = processed_path.parent / "history.json"
    history = []
    if history_file.exists():
        try:
            with open(history_file, 'r') as f:
                history = json.load(f)
        except: pass

    # --- HTML HEADER & CSS ---
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>DataPrepHIS Report</title>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; max_width: 1000px; margin: 0 auto; padding: 40px; background: #f9f9f9; }}
            .container {{ background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
            h1 {{ color: #E95420; border-bottom: 2px solid #E95420; padding-bottom: 10px; }}
            h2 {{ color: #E95420; margin-top: 40px; border-left: 5px solid #E95420; padding-left: 10px; }}
            table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
            th, td {{ padding: 12px; border: 1px solid #ddd; text-align: left; }}
            th {{ background-color: #f2f2f2; color: #E95420; }}
            tr:nth-child(even) {{ background-color: #f9f9f9; }}
            .img-container {{ text-align: center; margin: 30px 0; }}
            .img-container img {{ max-width: 100%; border: 1px solid #ddd; padding: 5px; border-radius: 4px; }}
            .metric-box {{ display: inline-block; background: #E95420; color: white; padding: 15px; border-radius: 8px; margin-right: 15px; min-width: 150px; text-align: center; }}
            .metric-val {{ font-size: 24px; font-weight: bold; display: block; }}
            .metric-label {{ font-size: 14px; opacity: 0.9; }}
        </style>
    </head>
    <body>
    <div class="container">
        <h1>📊 DataPrepHIS Analysis Report</h1>
        <p><strong>Date:</strong> {datetime.date.today().strftime('%B %d, %Y')}</p>
        
        <h2>1. Dataset Overview</h2>
        <div>
            <div class="metric-box">
                <span class="metric-val">{len(df):,}</span>
                <span class="metric-label">Total Rows</span>
            </div>
            <div class="metric-box">
                <span class="metric-val">{len(df.columns)}</span>
                <span class="metric-label">Total Columns</span>
            </div>
        </div>
    """

    # --- AUDIT TRAIL ---
    html += "<h2>2. Preprocessing Audit Trail</h2>"
    
    # Filter processing actions
    audit_actions = ["Imputation", "Binning", "Encoding", "Dimensionality Reduction", "Text Transformation"]
    audit_logs = [h for h in history if h.get('action') in audit_actions]

    if audit_logs:
        html += "<table><thead><tr><th>Operation</th><th>Input</th><th>Result</th><th>Method</th></tr></thead><tbody>"
        for item in audit_logs:
            inputs = ", ".join(item.get('inputs', []))
            outputs = ", ".join(item.get('outputs', []))
            html += f"<tr><td>{item.get('action')}</td><td>{inputs}</td><td>{outputs}</td><td>{item.get('method')}</td></tr>"
        html += "</tbody></table>"
    else:
        html += "<p>No preprocessing operations recorded.</p>"

    # --- VISUALIZATIONS (User Intent) ---
    viz_logs = [h for h in history if h.get('action') == 'Visualization']
    if viz_logs:
        html += "<h2>3. User-Selected Visualizations</h2>"
        for item in viz_logs:
            chart_type = item.get('method')
            params = item.get('params', {})
            x = params.get('x')
            y = params.get('y')
            
            if x and x in df.columns:
                plt.figure(figsize=(10, 5))
                try:
                    title = f"{chart_type.title()}: {x}"
                    if y: title += f" vs {y}"
                    
                    if chart_type in ["bar", "topn_bar"]:
                        if y and y in df.columns: sns.barplot(data=df, x=x, y=y, palette="Oranges_r")
                        else: 
                            top_n = df[x].value_counts().head(15)
                            sns.barplot(x=top_n.values, y=top_n.index, palette="Oranges_r")
                    elif chart_type == "histogram":
                        sns.histplot(data=df, x=x, kde=True, color='#E95420')
                    elif chart_type == "scatter" and y in df.columns:
                        sns.scatterplot(data=df, x=x, y=y, color='#E95420')
                    elif chart_type == "box":
                        if y: sns.boxplot(data=df, x=x, y=y, palette="Oranges_r")
                        else: sns.boxplot(data=df, x=x, color='#E95420')
                    
                    plt.title(title)
                    img_data = get_base64_plot(plt)
                    html += f'<div class="img-container"><h3>{title}</h3><img src="{img_data}"></div>'
                except:
                    plt.close()

    # --- CORRELATIONS ---
    corr_logs = [h for h in history if h.get('action') == 'Correlation Analysis']
    if corr_logs:
        html += "<h2>4. Correlation Analysis</h2>"
        for item in corr_logs:
            cols = item.get('inputs', [])
            valid_cols = [c for c in cols if c in df.columns]
            num_cols = df[valid_cols].select_dtypes(include=[np.number])
            
            if len(num_cols.columns) > 1:
                plt.figure(figsize=(8, 6))
                sns.heatmap(num_cols.corr(), annot=True, cmap='coolwarm', fmt=".2f")
                plt.title(f"Correlation: {item.get('method')}")
                img_data = get_base64_plot(plt)
                html += f'<div class="img-container"><img src="{img_data}"></div>'

    # --- GENERAL STATS (Fallback) ---
    if not viz_logs and not corr_logs:
        html += "<h2>3. Data Distributions</h2>"
        num_cols = df.select_dtypes(include=[np.number]).columns[:6]
        for col in num_cols:
            plt.figure(figsize=(10, 3))
            sns.histplot(df[col], kde=True, color='#E95420')
            plt.title(f"Distribution: {col}")
            img_data = get_base64_plot(plt)
            html += f'<div class="img-container"><img src="{img_data}"></div>'

    html += "</div></body></html>"
    
    # Save
    output_path = output_dir / "DataPrepHIS_Report.html"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
        
    return output_path

from .r_integration import (
    handle_binning,
    handle_data_reduction,
    handle_encoding,
    handle_missing_values,
    handle_text_transformation,
    map_binning_method_name,
    map_encoding_method_name,
    map_method_name,
    validate_columns,
)

router = APIRouter(prefix="/api/files", tags=["Files"])

# Base directory for file storage
FILES_DIR = Path(__file__).parent.parent / "files"


class FileUploadResponse(BaseModel):
    """Response model for file upload."""

    fileId: str
    path: str
    userId: str
    filename: str


class FileDataResponse(BaseModel):
    """Response model for CSV file data."""

    columns: List[str]
    rows: List[Dict[str, str]]
    updated_at: str
    selectionRanges: List[Dict[str, int]] = []
    totalColumns: int = 0
    modifiedCells: List[Dict[str, str]] = []  # [{rowId, column}]
    summary: Optional[Dict[str, Any]] = None  # Data reduction summary if available
    
    model_config = {"populate_by_name": True}


class FileEditRequest(BaseModel):
    """Request model for editing file data."""

    userId: str
    fileId: str
    edits: List[Dict[str, Any]]  # Array of {rowId: str, changes: Dict[str, str]}


class ColumnSelectionRequest(BaseModel):
    """Request model for column selection."""

    userId: str
    fileId: str
    ranges: List[
        Dict[str, int]
    ]  # Array of {start: int, end: int} (zero-based, inclusive)


def ensure_files_directory():
    """Ensure the files directory exists."""
    FILES_DIR.mkdir(exist_ok=True)


def migrate_legacy_file(user_id: str, file_id: str) -> bool:
    """
    Migrate legacy flat file structure to new directory structure.

    Legacy: files/{userId}/{fileId}.csv
    New: files/{userId}/{fileId}/original.csv + selected.csv

    Returns:
        True if migration was performed, False if file already in new format
    """
    legacy_path = FILES_DIR / user_id / f"{file_id}.csv"
    file_dir = FILES_DIR / user_id / file_id
    original_path = file_dir / "original.csv"
    selected_path = file_dir / "selected.csv"

    # Check if already in new format
    if original_path.exists() and selected_path.exists():
        return False

    # Check if legacy file exists
    if not legacy_path.exists():
        return False

    # Migrate: create directory and move file
    try:
        file_dir.mkdir(parents=True, exist_ok=True)

        # Copy legacy file to both original.csv and selected.csv
        import shutil

        shutil.copy2(legacy_path, original_path)
        shutil.copy2(legacy_path, selected_path)

        # Remove legacy file after successful migration
        legacy_path.unlink()

        print(
            f"Migrated legacy file: {user_id}/{file_id}.csv -> {user_id}/{file_id}/[original,selected].csv"
        )
        return True
    except Exception as e:
        print(f"Failed to migrate legacy file {user_id}/{file_id}: {str(e)}")
        return False


def validate_csv_extension(filename: str) -> bool:
    """Validate that the file has a .csv extension."""
    return filename.lower().endswith(".csv")


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    user_id: str = Form(...), username: str = Form(None), file: UploadFile = File(...)
):
    """
    Upload a CSV file for a specific user.

    Args:
        user_id: ID of the user uploading the file
        username: Optional username for logging/verification
        file: The CSV file to upload

    Returns:
        FileUploadResponse with file ID and path

    Raises:
        HTTPException: If user doesn't exist or file is not CSV
    """
    # Validate user exists
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate file extension
    if not file.filename or not validate_csv_extension(file.filename):
        raise HTTPException(
            status_code=400, detail="Invalid file type. Only CSV files are allowed"
        )

    # Generate file ID and create user/file directory structure
    file_id = generate_uuid_v7()
    user_dir = FILES_DIR / user_id
    file_dir = user_dir / file_id
    file_dir.mkdir(parents=True, exist_ok=True)

    # Build file paths for original and selected
    original_path = file_dir / "original.csv"
    selected_path = file_dir / "selected.csv"

    # Read and process CSV content
    try:
        content = await file.read()
        content_str = content.decode("utf-8")

        # Parse CSV and detect if headers exist
        csv_lines = content_str.strip().split('\n')
        if not csv_lines:
            raise HTTPException(status_code=400, detail="CSV file is empty")
        
        # Try to detect if first row is a header using csv.Sniffer
        has_header = True
        try:
            sniffer = csv.Sniffer()
            sample = '\n'.join(csv_lines[:min(5, len(csv_lines))])
            has_header = sniffer.has_header(sample)
        except:
            # If sniffer fails, check if first row looks like data (all cells are numeric)
            first_row_reader = csv.reader(io.StringIO(csv_lines[0]))
            first_row = next(first_row_reader)
            # Assume no header if all non-empty cells in first row are numeric
            has_header = not all(
                cell.strip().replace('.', '', 1).replace('-', '', 1).replace('+', '', 1).isdigit() 
                for cell in first_row if cell.strip()
            )
        
        # Read all rows as raw data
        csv_reader = csv.reader(io.StringIO(content_str))
        all_rows = list(csv_reader)
        
        if not all_rows:
            raise HTTPException(status_code=400, detail="CSV file has no data")
        
        # Determine fieldnames and data rows
        if has_header:
            fieldnames = all_rows[0]
            data_rows = all_rows[1:]
        else:
            # Generate column names efficiently for large datasets: Column1, Column2, etc.
            num_columns = len(all_rows[0]) if all_rows else 0
            # Use list comprehension with string formatting - optimized for 10,000+ columns
            fieldnames = [f"Column{i}" for i in range(1, num_columns + 1)]
            data_rows = all_rows
        
        # Ensure we have data rows
        if not data_rows:
            raise HTTPException(status_code=400, detail="CSV file has no data rows")
        
        # Add ID column if it doesn't exist (case-insensitive check)
        fieldnames_lower = [f.lower() for f in fieldnames]
        if "id" not in fieldnames_lower:
            fieldnames.insert(0, "id")
            has_id_prepended = True
        else:
            has_id_prepended = False
        
        # Convert rows to dictionaries and add IDs - optimized for large column counts
        rows = []
        id_str = str  # Local reference to str() for faster access
        
        for idx, row in enumerate(data_rows, start=1):
            # Pre-allocate dict with ID
            row_dict = {"id": id_str(idx)}
            
            # Optimize field iteration
            if has_id_prepended:
                # ID was added at position 0, so offset by 1
                for i, field in enumerate(fieldnames[1:], start=0):
                    row_dict[field] = row[i] if i < len(row) else ""
            else:
                # No offset needed
                for i, field in enumerate(fieldnames):
                    if field != "id":
                        row_dict[field] = row[i] if i < len(row) else ""
            
            rows.append(row_dict)

        # Write normalized CSV with headers and ID column
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

        csv_content = output.getvalue()

        # Save to both original.csv and selected.csv (initially identical)
        async with aiofiles.open(original_path, "w", encoding="utf-8") as f:
            await f.write(csv_content)

        async with aiofiles.open(selected_path, "w", encoding="utf-8") as f:
            await f.write(csv_content)

        # Persist metadata to database with empty selection (meaning "all columns")
        upsert_file_metadata(user_id, file_id, fieldnames, selected_columns=[])

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="File encoding error. Please ensure the file is UTF-8 encoded",
        )
    except csv.Error as e:
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

    # Return response with new directory structure path
    return FileUploadResponse(
        fileId=file_id,
        path=f"/file/{user_id}/{file_id}/selected.csv",
        userId=user_id,
        filename=file.filename,
    )


@router.get("/data", response_model=FileDataResponse)
async def get_file_data(
    userId: str = Query(..., description="User ID who owns the file"),
    fileId: str = Query(..., description="File ID to retrieve"),
):
    """
    Retrieve CSV file data as structured JSON.

    Args:
        userId: ID of the user who owns the file
        fileId: ID of the file to retrieve

    Returns:
        FileDataResponse with columns, rows, and metadata

    Raises:
        HTTPException: If file doesn't exist or cannot be read
    """
    # Attempt to migrate legacy file if necessary
    migrate_legacy_file(userId, fileId)

    # Build file paths
    file_dir = FILES_DIR / userId / fileId
    original_path = file_dir / "original.csv"
    selected_path = file_dir / "selected.csv"

    # Read from selected.csv if it exists (column selection applied), otherwise original.csv
    file_path = selected_path if selected_path.exists() else original_path

    # Validate file existence
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Get metadata from database
    metadata = get_file_metadata(userId, fileId)

    # Read and parse CSV file
    try:
        async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
            content = await f.read()

        # Parse CSV using DictReader
        csv_reader = csv.DictReader(io.StringIO(content))

        # Extract columns from the selected/current file
        current_columns = list(csv_reader.fieldnames) if csv_reader.fieldnames else []

        # Process rows - convert None to empty string only
        rows = []
        for row in csv_reader:
            normalized_row = {
                key: "" if value is None else value
                for key, value in row.items()
            }
            rows.append(normalized_row)

        # Get selection ranges and original column count from metadata
        selection_ranges = metadata.get("selected_columns", []) if metadata else []
        total_columns = (
            len(metadata["columns"])
            if metadata and metadata["columns"]
            else len(current_columns)
        )
        
        modified_cells = metadata.get("modified_cells", []) if metadata else []
        
        # Get most recent DR summary if DR columns exist
        summary = None
        has_dr_columns = any(col.startswith("DR") and col[2:].isdigit() for col in current_columns)
        print(f"🔍 Checking for DR columns: has_dr_columns={has_dr_columns}, columns={current_columns[:10]}")
        
        if has_dr_columns:
            try:
                from database.db import get_dr_results
                dr_results = get_dr_results(userId, fileId, limit=1)
                print(f"📊 DR results retrieved: {len(dr_results) if dr_results else 0} results")
                
                if dr_results:
                    dr_data = dr_results[0]
                    print(f"✅ Using DR result with method: {dr_data.get('methodUsed')}")
                    print(f"📊 DR data keys: {list(dr_data.keys())}")
                    
                    # Convert dropped columns to proper format
                    dropped_cols = None
                    if dr_data.get("droppedColumns"):
                        dropped_data = dr_data.get("droppedColumns")
                        if isinstance(dropped_data, list):
                            dropped_cols = dropped_data
                    
                    # Create missing handling info
                    missing_info = None
                    if dr_data.get("missingHandling"):
                        missing_handling = dr_data.get("missingHandling")
                        if isinstance(missing_handling, dict):
                            missing_info = missing_handling
                        elif isinstance(missing_handling, str):
                            missing_info = {"categoricalBlankOrNAReplacedWith": missing_handling}
                    
                    # Create rare level handling info
                    rare_info = None
                    if dr_data.get("rareThreshold"):
                        rare_info = {
                            "rareThreshold": dr_data.get("rareThreshold"),
                            "rareLevelsReplacedWith": "Other"
                        }
                    
                    # Generate DR column names from actual columns if not in database
                    dr_col_names = dr_data.get("drColumnNames")
                    if not dr_col_names:
                        # Extract DR columns from current columns
                        dr_cols_in_data = [col for col in current_columns if col.startswith("DR") and col[2:].isdigit()]
                        dr_col_names = sorted(dr_cols_in_data) if dr_cols_in_data else [f"DR{i+1}" for i in range(dr_data.get("componentsProduced", 0))]
                    
                    # Get counts from actual data
                    components_produced = dr_data.get("componentsProduced") or len([col for col in current_columns if col.startswith("DR") and col[2:].isdigit()])
                    input_columns = dr_data.get("inputColumns") or len(dr_data.get("selectedColumns", []))
                    original_columns = dr_data.get("originalColumns") or (len(current_columns) - components_produced)
                    output_columns = dr_data.get("outputColumns") or len(current_columns)
                    
                    summary = {
                        "method": dr_data.get("methodUsed") or "unknown",
                        "components": components_produced,
                        "inputColumns": input_columns,
                        "originalColumns": original_columns,
                        "drColumns": dr_data.get("drColumns") or components_produced,
                        "outputColumns": output_columns,
                        "varianceExplained": dr_data.get("varianceExplained"),
                        "totalVariance": dr_data.get("totalVariance"),
                        "selectedColumns": dr_data.get("selectedColumns"),
                        "rowsInput": dr_data.get("rowsInput"),
                        "rowsUsedForFit": dr_data.get("sampleSizeUsed"),
                        "seedUsed": dr_data.get("seedUsed"),
                        "droppedColumns": dropped_cols,
                        "missingHandling": missing_info,
                        "rareLevelHandling": rare_info,
                        "drColumnNames": dr_col_names,
                        "topContributingVariables": dr_data.get("topContributions") or dr_data.get("topContributingVariables"),
                    }
                    print(f"📤 Summary being returned: {summary}")
                else:
                    print("⚠️ No DR results found in database")
            except Exception as e:
                print(f"❌ Error fetching DR summary: {str(e)}")
                import traceback
                traceback.print_exc()

        return FileDataResponse(
            columns=current_columns,
            rows=rows,
            updated_at=metadata["updated_at"] if metadata else "",
            selectionRanges=selection_ranges or [],
            totalColumns=total_columns,
            modifiedCells=modified_cells,
            summary=summary,
        )

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="File encoding error. Please ensure the file is UTF-8 encoded",
        )
    except csv.Error as e:
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")


@router.put("/data", response_model=FileDataResponse)
async def update_file_data(request: FileEditRequest):
    """
    Update CSV file data by applying edits to selected.csv only.

    Args:
        request: FileEditRequest with userId, fileId, and edits array

    Returns:
        FileDataResponse with updated data

    Raises:
        HTTPException: If file doesn't exist or edits are invalid
    """
    user_id = request.userId
    file_id = request.fileId
    edits = request.edits

    # Attempt to migrate legacy file if necessary
    migrate_legacy_file(user_id, file_id)

    # Build file path - operate on selected.csv only
    file_dir = FILES_DIR / user_id / file_id
    selected_path = file_dir / "selected.csv"

    # Validate file existence
    if not selected_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Get metadata
    metadata = get_file_metadata(user_id, file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="File metadata not found")

    # Valid columns are the ones in the original file
    valid_columns = set(metadata["columns"])

    try:
        # Read current CSV content from selected.csv
        async with aiofiles.open(selected_path, "r", encoding="utf-8") as f:
            content = await f.read()

        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(content))
        fieldnames = list(csv_reader.fieldnames) if csv_reader.fieldnames else []
        rows = list(csv_reader)

        # Create edit map: {rowId: {column: value}}
        edit_map = {}
        for edit in edits:
            row_id = str(edit.get("rowId"))
            changes = edit.get("changes", {})

            # Validate columns exist in original metadata
            for col in changes.keys():
                if col not in valid_columns:
                    raise HTTPException(
                        status_code=400, detail=f"Invalid column: {col}"
                    )

            edit_map[row_id] = changes

        # Apply edits to rows
        for row in rows:
            row_id = row.get("id", "")
            if row_id in edit_map:
                row.update(edit_map[row_id])

        # Write updated CSV back to selected.csv only
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

        async with aiofiles.open(selected_path, "w", encoding="utf-8") as f:
            await f.write(output.getvalue())

        # Update timestamp in database
        update_file_timestamp(user_id, file_id)

        # Return updated data
        metadata_updated = get_file_metadata(user_id, file_id)
        selection_ranges = (
            metadata_updated.get("selected_columns", []) if metadata_updated else []
        )
        total_columns = (
            len(metadata["columns"])
            if metadata and metadata["columns"]
            else len(fieldnames)
        )

        return FileDataResponse(
            columns=fieldnames,
            rows=rows,
            updated_at=metadata_updated["updated_at"] if metadata_updated else "",
            selectionRanges=selection_ranges or [],
            totalColumns=total_columns,
            modifiedCells=[],
        )

    except csv.Error as e:
        raise HTTPException(status_code=400, detail=f"CSV processing error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update file: {str(e)}")


@router.post("/selection", response_model=FileDataResponse)
async def update_column_selection(request: ColumnSelectionRequest):
    """
    Update column selection by creating selected.csv from original.csv with specified column ranges.

    Args:
        request: ColumnSelectionRequest with userId, fileId, and ranges array

    Returns:
        FileDataResponse with selected columns and updated metadata

    Raises:
        HTTPException: If file doesn't exist or ranges are invalid
    """
    user_id = request.userId
    file_id = request.fileId
    ranges = request.ranges

    # Attempt to migrate legacy file if necessary
    migrate_legacy_file(user_id, file_id)

    # Build file paths
    file_dir = FILES_DIR / user_id / file_id
    original_path = file_dir / "original.csv"
    selected_path = file_dir / "selected.csv"

    # Validate original file exists
    if not original_path.exists():
        raise HTTPException(status_code=404, detail="Original file not found")

    # Get metadata
    metadata = get_file_metadata(user_id, file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="File metadata not found")

    original_columns = metadata["columns"]
    total_columns = len(original_columns)

    # Empty ranges means "select all columns"
    if not ranges or len(ranges) == 0:
        # Copy original.csv to selected.csv
        try:
            async with aiofiles.open(original_path, "r", encoding="utf-8") as f:
                content = await f.read()
            async with aiofiles.open(selected_path, "w", encoding="utf-8") as f:
                await f.write(content)

            # Update metadata with empty selection (meaning all columns)
            upsert_file_metadata(
                user_id, file_id, original_columns, selected_columns=[]
            )
            update_file_timestamp(user_id, file_id)

            # Parse and return data
            csv_reader = csv.DictReader(io.StringIO(content))
            rows = list(csv_reader)

            metadata_updated = get_file_metadata(user_id, file_id)
            return FileDataResponse(
                columns=original_columns,
                rows=rows,
                updated_at=metadata_updated["updated_at"] if metadata_updated else "",
                selectionRanges=[],
                totalColumns=total_columns,
                modifiedCells=[],
            )

        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to reset selection: {str(e)}"
            )

    # Validate ranges
    is_valid, error_message = validate_column_ranges(ranges, total_columns)
    if not is_valid:
        raise HTTPException(
            status_code=400, detail=error_message or "Invalid column ranges"
        )

    try:
        # Read original CSV
        async with aiofiles.open(original_path, "r", encoding="utf-8") as f:
            content = await f.read()

        csv_reader = csv.DictReader(io.StringIO(content))
        original_fieldnames = (
            list(csv_reader.fieldnames) if csv_reader.fieldnames else []
        )
        rows = list(csv_reader)

        # Build selected column list from ranges
        selected_columns_set = set()

        # Always include 'id' column
        if "id" in original_fieldnames:
            selected_columns_set.add("id")

        # Add columns from ranges
        for range_obj in ranges:
            start = range_obj["start"]
            end = range_obj["end"]
            for idx in range(start, end + 1):
                if idx < len(original_fieldnames):
                    selected_columns_set.add(original_fieldnames[idx])

        # Preserve order from original columns
        selected_columns = [
            col for col in original_fieldnames if col in selected_columns_set
        ]

        # Create new CSV with only selected columns
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=selected_columns)
        writer.writeheader()

        for row in rows:
            selected_row = {col: row.get(col, "") for col in selected_columns}
            writer.writerow(selected_row)

        # Write selected.csv
        async with aiofiles.open(selected_path, "w", encoding="utf-8") as f:
            await f.write(output.getvalue())

        # Update metadata with selection ranges
        upsert_file_metadata(
            user_id, file_id, original_columns, selected_columns=ranges
        )
        update_file_timestamp(user_id, file_id)

        # Return updated data
        metadata_updated = get_file_metadata(user_id, file_id)

        # Parse the newly created selected.csv for rows
        async with aiofiles.open(selected_path, "r", encoding="utf-8") as f:
            selected_content = await f.read()

        selected_reader = csv.DictReader(io.StringIO(selected_content))
        selected_rows = list(selected_reader)

        return FileDataResponse(
            columns=selected_columns,
            rows=selected_rows,
            updated_at=metadata_updated["updated_at"] if metadata_updated else "",
            selectionRanges=ranges,
            totalColumns=total_columns,
            modifiedCells=[],
        )

    except csv.Error as e:
        raise HTTPException(status_code=400, detail=f"CSV processing error: {str(e)}")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to update column selection: {str(e)}"
        )


class HandleMissingValuesRequest(BaseModel):
    """Request model for handling missing values."""

    userId: str
    fileId: str
    selected_columns: List[str]
    selected_method: (
        str  # 'row-deletion', 'mode', 'median', 'missing-category', 'model-based'
    )


@router.post("/missing-values", response_model=FileDataResponse)
async def handle_missing_values_endpoint(request: HandleMissingValuesRequest):
    """
    Handle missing values in selected.csv using R script.

    Args:
        request: HandleMissingValuesRequest with userId, fileId, columns, and method

    Returns:
        FileDataResponse with updated data after missing value handling

    Raises:
        HTTPException: If file doesn't exist, R execution fails, or validation fails
    """
    user_id = request.userId
    file_id = request.fileId
    selected_columns = request.selected_columns
    method = request.selected_method

    # Validate user exists
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Attempt to migrate legacy file if necessary
    migrate_legacy_file(user_id, file_id)

    # Build file paths
    file_dir = FILES_DIR / user_id / file_id
    selected_path = file_dir / "selected.csv"

    # Validate file existence
    if not selected_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Get metadata
    metadata = get_file_metadata(user_id, file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="File metadata not found")

    # Read current columns from selected.csv
    try:
        async with aiofiles.open(selected_path, "r", encoding="utf-8") as f:
            content = await f.read()

        csv_reader = csv.DictReader(io.StringIO(content))
        current_columns = list(csv_reader.fieldnames) if csv_reader.fieldnames else []
        
        # Store original data to track modifications
        csv_reader = csv.DictReader(io.StringIO(content))
        original_rows = list(csv_reader)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

    # Validate columns
    is_valid, error_message = validate_columns(selected_columns, current_columns)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)

    # Map method name from frontend (kebab-case) to R (snake_case)
    r_method = map_method_name(method)

    # Execute R script to handle missing values
    try:
        handle_missing_values(selected_path, selected_columns, r_method)
        file_dir = FILES_DIR / user_id / file_id
        log_history(file_dir, "Imputation", method, selected_columns, selected_columns)
    except HTTPException:
        raise  # Re-raise HTTPExceptions from r_integration
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during missing value handling: {str(e)}",
        )

    # Update timestamp in database
    update_file_timestamp(user_id, file_id)

    # Read updated CSV and return response
    try:
        async with aiofiles.open(selected_path, "r", encoding="utf-8") as f:
            updated_content = await f.read()

        updated_reader = csv.DictReader(io.StringIO(updated_content))
        updated_columns = (
            list(updated_reader.fieldnames) if updated_reader.fieldnames else []
        )
        updated_rows = list(updated_reader)
        
        # Track modified cells for missing value handling
        modified_cells = []
        for orig_row, updated_row in zip(original_rows, updated_rows):
            row_id = orig_row.get("id", "")
            for col in selected_columns:
                orig_val = orig_row.get(col, "")
                updated_val = updated_row.get(col, "")
                # Check if value changed (was empty/missing and now has a value)
                if orig_val != updated_val:
                    modified_cells.append({"rowId": row_id, "column": col})

        # Get updated metadata
        metadata_updated = get_file_metadata(user_id, file_id)
        selection_ranges = (
            metadata_updated.get("selected_columns", []) if metadata_updated else []
        )
        total_columns = (
            len(metadata["columns"])
            if metadata and metadata["columns"]
            else len(updated_columns)
        )

        return FileDataResponse(
            columns=updated_columns,
            rows=updated_rows,
            updated_at=metadata_updated["updated_at"] if metadata_updated else "",
            selectionRanges=selection_ranges or [],
            totalColumns=total_columns,
            modifiedCells=modified_cells,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to read updated file: {str(e)}"
        )


class HandleEncodingRequest(BaseModel):
    """Request model for encoding operations."""

    userId: str
    fileId: str
    selected_columns: List[str]
    method: str  # 'one-hot', 'label', 'frequency', 'target', 'ordinal'
    target_columns: List[str] = None


@router.post("/encoding", response_model=FileDataResponse)
async def handle_encoding_endpoint(request: HandleEncodingRequest):
    """
    Apply encoding to selected columns in selected.csv using R script.

    Args:
        request: HandleEncodingRequest with userId, fileId, columns, method, and parameters

    Returns:
        FileDataResponse with updated data after encoding

    Raises:
        HTTPException: If file doesn't exist, R execution fails, or validation fails
    """
    user_id = request.userId
    file_id = request.fileId
    selected_columns = request.selected_columns
    method = request.method
    target_columns = request.target_columns

    # Validate user exists
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Attempt to migrate legacy file if necessary
    migrate_legacy_file(user_id, file_id)

    # Build file paths
    file_dir = FILES_DIR / user_id / file_id
    selected_path = file_dir / "selected.csv"

    # Validate file existence
    if not selected_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Get metadata
    metadata = get_file_metadata(user_id, file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="File metadata not found")

    # Read current columns from selected.csv
    try:
        async with aiofiles.open(selected_path, "r", encoding="utf-8") as f:
            content = await f.read()
        
        csv_reader = csv.DictReader(io.StringIO(content))
        current_columns = list(csv_reader.fieldnames) if csv_reader.fieldnames else []

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

    # Validate columns exist
    if not selected_columns or len(selected_columns) == 0:
        raise HTTPException(status_code=400, detail="No columns selected for encoding")

    # Check if 'id' column is in selection
    if "id" in selected_columns:
        raise HTTPException(
            status_code=400, detail="Cannot apply encoding to 'id' column"
        )

    # Validate all columns exist
    for col in selected_columns:
        if col not in current_columns:
            raise HTTPException(
                status_code=400, detail=f"Column '{col}' does not exist in the file"
            )

    # Validate target encoding requirements
    if method == "target":
        if not target_columns or len(target_columns) == 0:
            raise HTTPException(
                status_code=400,
                detail="Target encoding requires at least one target column to be specified",
            )

    # Map method name from frontend (kebab-case) to R (snake_case)
    r_method = map_encoding_method_name(method)

    # Execute R script to perform encoding
    try:
        handle_encoding(selected_path, selected_columns, r_method, target_columns)
    except HTTPException:
        raise  # Re-raise HTTPExceptions from r_integration
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Unexpected error during encoding: {str(e)}"
        )

    # Update timestamp in database
    update_file_timestamp(user_id, file_id)

    # Read updated CSV and return response
    try:
        async with aiofiles.open(selected_path, "r", encoding="utf-8") as f:
            updated_content = await f.read()

        

        updated_reader = csv.DictReader(io.StringIO(updated_content))
        updated_columns = (
            list(updated_reader.fieldnames) if updated_reader.fieldnames else []
        )
        file_dir = FILES_DIR / user_id / file_id
        new_cols = list(set(updated_columns) - set(current_columns))
        # If new columns exist (One-Hot), record them. If not (Label), output is same as input.
        final_outputs = new_cols if new_cols else selected_columns
        
        log_history(file_dir, "Encoding", method, selected_columns, final_outputs)
        updated_rows = list(updated_reader)

        # Get updated metadata
        metadata_updated = get_file_metadata(user_id, file_id)
        selection_ranges = (
            metadata_updated.get("selected_columns", []) if metadata_updated else []
        )
        total_columns = (
            len(metadata["columns"])
            if metadata and metadata["columns"]
            else len(updated_columns)
        )

        return FileDataResponse(
            columns=updated_columns,
            rows=updated_rows,
            updated_at=metadata_updated["updated_at"] if metadata_updated else "",
            selectionRanges=selection_ranges or [],
            totalColumns=total_columns,
            modifiedCells=[],
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to read updated file: {str(e)}"
        )


class HandleTextTransformationRequest(BaseModel):
    """Request model for text transformation operations."""

    userId: str
    fileId: str
    selected_columns: List[str]
    k: int = None  # Number of themes (None for auto-detection)


@router.post("/text-transformation", response_model=FileDataResponse)
async def handle_text_transformation_endpoint(
    request: HandleTextTransformationRequest,
):
    """
    Transform free text columns into categorical themes using sentence embeddings.

    Args:
        request: HandleTextTransformationRequest with userId, fileId, columns, and parameters

    Returns:
        FileDataResponse with updated data after text transformation

    Raises:
        HTTPException: If file doesn't exist, R execution fails, or validation fails
    """
    user_id = request.userId
    file_id = request.fileId
    selected_columns = request.selected_columns
    k = request.k

    # Validate user exists
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Attempt to migrate legacy file if necessary
    migrate_legacy_file(user_id, file_id)

    # Build file paths
    file_dir = FILES_DIR / user_id / file_id
    selected_path = file_dir / "selected.csv"

    # Validate file existence
    if not selected_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Get metadata
    metadata = get_file_metadata(user_id, file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="File metadata not found")

    # Read current columns from selected.csv
    try:
        async with aiofiles.open(selected_path, "r", encoding="utf-8") as f:
            content = await f.read()

        csv_reader = csv.DictReader(io.StringIO(content))
        current_columns = list(csv_reader.fieldnames) if csv_reader.fieldnames else []

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

    # Validate columns exist
    if not selected_columns or len(selected_columns) == 0:
        raise HTTPException(
            status_code=400, detail="No columns selected for text transformation"
        )

    # Check if 'id' column is in selection
    if "id" in selected_columns:
        raise HTTPException(
            status_code=400, detail="Cannot apply text transformation to 'id' column"
        )

    # Validate all columns exist
    for col in selected_columns:
        if col not in current_columns:
            raise HTTPException(
                status_code=400, detail=f"Column '{col}' does not exist in the file"
            )

    # Execute R script to perform text transformation
    try:
        handle_text_transformation(selected_path, selected_columns, k)
    except HTTPException:
        raise  # Re-raise HTTPExceptions from r_integration
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during text transformation: {str(e)}",
        )

    # Update timestamp in database
    update_file_timestamp(user_id, file_id)

    # Read updated CSV and return response
    try:
        async with aiofiles.open(selected_path, "r", encoding="utf-8") as f:
            updated_content = await f.read()

        updated_reader = csv.DictReader(io.StringIO(updated_content))
        updated_columns = (
            list(updated_reader.fieldnames) if updated_reader.fieldnames else []
        )
        updated_rows = list(updated_reader)


        new_cols = list(set(updated_columns) - set(current_columns))
        
        # 2. Log it
        file_dir = FILES_DIR / user_id / file_id
        method_desc = f"Sentence Embeddings (k={k})" if k else "Auto-detected Themes"
        log_history(file_dir, "Text Transformation", method_desc, selected_columns, new_cols)
        # --- PHASE 3 LOGGING END ---

        # Get updated metadata
        metadata_updated = get_file_metadata(user_id, file_id)
        selection_ranges = (
            metadata_updated.get("selected_columns", []) if metadata_updated else []
        )
        total_columns = (
            len(metadata["columns"])
            if metadata and metadata["columns"]
            else len(updated_columns)
        )

        response_data = FileDataResponse(
            columns=updated_columns,
            rows=updated_rows,
            updated_at=metadata_updated["updated_at"] if metadata_updated else "",
            selectionRanges=selection_ranges or [],
            totalColumns=total_columns,
            modifiedCells=[],
        )
        
        return response_data

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to read updated file: {str(e)}"
        )



class DataReductionSummary(BaseModel):
    """Simplified summary of data reduction operation."""
    method: Optional[str] = None
    components: Optional[int] = None
    inputColumns: Optional[int] = None
    originalColumns: Optional[int] = None
    drColumns: Optional[int] = None
    outputColumns: Optional[int] = None
    varianceExplained: Optional[List[float]] = None
    totalVariance: Optional[float] = None
    selectedColumns: Optional[List[str]] = None
    rowsInput: Optional[int] = None
    rowsUsedForFit: Optional[int] = None
    seedUsed: Optional[int] = None
    droppedColumns: Optional[List[Dict[str, Any]]] = None
    missingHandling: Optional[Dict[str, str]] = None
    rareLevelHandling: Optional[Dict[str, Any]] = None
    drColumnNames: Optional[List[str]] = None
    topContributingVariables: Optional[Dict[str, Any]] = None


class DataReductionResponse(FileDataResponse):
    """Response model for data reduction."""

    summary: Optional[DataReductionSummary] = None


class HandleDataReductionRequest(BaseModel):
    """Request model for data reduction operations."""

    userId: str
    fileId: str
    selected_columns: List[str]
    method: str = "auto"  # 'auto', 'mca', 'famd'
    n_components: int = Field(..., ge=2, le=100)
    rare_threshold: int = 5
    max_cardinality: int = 200
    sample_size: Optional[int] = None


@router.post("/data-reduction", response_model=DataReductionResponse)
async def handle_data_reduction_endpoint(
    request: HandleDataReductionRequest,
):
    """
    Reduce categorical/mixed data into numeric components using MCA/FAMD.

    Args:
        request: HandleDataReductionRequest with userId, fileId, columns, and parameters

    Returns:
        DataReductionResponse with updated data and summary

    Raises:
        HTTPException: If file doesn't exist, R execution fails, or validation fails
    """
    user_id = request.userId
    file_id = request.fileId
    selected_columns = request.selected_columns
    method = request.method
    n_components = request.n_components
    rare_threshold = request.rare_threshold
    max_cardinality = request.max_cardinality
    sample_size = request.sample_size

    # Validate user exists
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Attempt to migrate legacy file if necessary
    migrate_legacy_file(user_id, file_id)

    # Build file paths
    file_dir = FILES_DIR / user_id / file_id
    selected_path = file_dir / "selected.csv"

    # Validate file existence
    if not selected_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Get metadata
    metadata = get_file_metadata(user_id, file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="File metadata not found")

    # Read current columns from selected.csv
    try:
        async with aiofiles.open(selected_path, "r", encoding="utf-8") as f:
            content = await f.read()

        csv_reader = csv.DictReader(io.StringIO(content))
        current_columns = list(csv_reader.fieldnames) if csv_reader.fieldnames else []
        rows = list(csv_reader)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

    # Validate columns exist
    if not selected_columns or len(selected_columns) == 0:
        raise HTTPException(
            status_code=400, detail="No columns selected for data reduction"
        )

    if "id" in selected_columns:
        raise HTTPException(
            status_code=400, detail="Cannot apply data reduction to 'id' column"
        )

    for col in selected_columns:
        if col not in current_columns:
            raise HTTPException(
                status_code=400, detail=f"Column '{col}' does not exist in the file"
            )

    method_value = (method or "auto").lower()
    if method_value not in {"auto", "mca", "famd"}:
        raise HTTPException(
            status_code=400, detail="Invalid method. Use 'auto', 'mca', or 'famd'"
        )

    # Detect numeric columns in selection (sample for performance)
    numeric_columns = set()
    sample_rows = rows[:50]
    for col in selected_columns:
        values = []
        for row in sample_rows:
            value = row.get(col, "")
            if value is None:
                continue
            value_str = str(value).strip()
            if value_str == "":
                continue
            values.append(value_str)

        if not values:
            continue

        numeric_count = 0
        for value in values:
            try:
                float(value.replace(",", ""))
                numeric_count += 1
            except ValueError:
                continue

        if numeric_count / len(values) >= 0.8:
            numeric_columns.add(col)

    if numeric_columns and len(numeric_columns) == len(selected_columns):
        raise HTTPException(
            status_code=400,
            detail=(
                "Numeric-only data detected. Data reduction is intended for qualitative data. "
                "Please select categorical columns or handle numeric-only data separately."
            ),
        )

    if method_value == "mca" and numeric_columns:
        raise HTTPException(
            status_code=400,
            detail=(
                "MCA only supports categorical data. Remove numeric columns or switch to Auto/FAMD."
            ),
        )

    if sample_size is not None and sample_size <= 0:
        sample_size = None

    # Create DR table path for separate storage
    dr_table_path = file_dir / "dr_results.csv"
    
    # Execute R script to perform data reduction
    try:
        summary = handle_data_reduction(
            selected_path,
            selected_columns,
            method_value,
            n_components,
            rare_threshold,
            max_cardinality,
            sample_size,
            dr_table_path,
        )
        if summary:
            file_dir = FILES_DIR / user_id / file_id
            # Get the generated column names from the summary
            dr_out_cols = summary.get("drColumnNames", [])
            log_history(file_dir, "Dimensionality Reduction", method, selected_columns, dr_out_cols) 
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during data reduction: {str(e)}",
        )
    
    # Store DR results in database
    try:
        run_id = store_dr_result(user_id, file_id, summary)
        summary['runId'] = run_id
    except Exception as e:
        print(f"Warning: Failed to store DR result in database: {str(e)}")
        import traceback
        traceback.print_exc()

    # Update timestamp in database
    update_file_timestamp(user_id, file_id)

    # Read DR results table (separate from original data)
    try:
        async with aiofiles.open(dr_table_path, "r", encoding="utf-8") as f:
            dr_content = await f.read()

        dr_reader = csv.DictReader(io.StringIO(dr_content))
        dr_columns = (
            list(dr_reader.fieldnames) if dr_reader.fieldnames else []
        )
        dr_rows = list(dr_reader)

        # Get updated metadata
        metadata_updated = get_file_metadata(user_id, file_id)
        selection_ranges = (
            metadata_updated.get("selected_columns", []) if metadata_updated else []
        )
        total_columns = len(dr_columns)

        summary_payload = None
        if summary:
            try:
                # Helper function to safely convert to int
                def safe_int(value, default=None):
                    if value is None:
                        return default
                    if isinstance(value, (int, float)):
                        return int(value)
                    if isinstance(value, str):
                        try:
                            return int(float(value))
                        except (ValueError, TypeError):
                            return default
                    if isinstance(value, list):
                        # If it's a list, return default (don't try to convert)
                        return default
                    if isinstance(value, dict):
                        # If it's a dict, return default
                        return default
                    return default
                
                # Helper function to safely convert to float
                def safe_float(value, default):
                    if value is None:
                        return default
                    if isinstance(value, (int, float)):
                        return float(value)
                    if isinstance(value, str):
                        try:
                            return float(value)
                        except (ValueError, TypeError):
                            return default
                    return default
                
                # Helper to ensure dict or None (R's empty list() becomes [] in Python)
                def ensure_dict_or_none(value):
                    if value is None:
                        return None
                    if isinstance(value, dict):
                        return value if len(value) > 0 else None
                    if isinstance(value, list):
                        return None if len(value) == 0 else value
                    return value
                
                # Convert dropped columns to proper format
                dropped_cols = None
                if summary.get("droppedColumns"):
                    dropped_data = summary.get("droppedColumns")
                    if isinstance(dropped_data, list):
                        dropped_cols = dropped_data  # Keep as list of dicts, don't convert to Pydantic
                
                # Create missing handling info
                missing_info = None
                if summary.get("missingHandling"):
                    missing_handling = summary.get("missingHandling")
                    if isinstance(missing_handling, dict):
                        missing_info = missing_handling  # Keep as dict
                    elif isinstance(missing_handling, str):
                        missing_info = {"categoricalBlankOrNAReplacedWith": missing_handling}
                
                # Create rare level handling info
                rare_info = None
                if summary.get("rareThreshold") or summary.get("rareLevelHandling"):
                    rare_data = summary.get("rareLevelHandling", {})
                    if isinstance(rare_data, dict) and rare_data:
                        rare_info = rare_data  # Keep as dict
                    else:
                        rare_info = {
                            "rareThreshold": safe_int(summary.get("rareThreshold"), rare_threshold),
                            "rareLevelsReplacedWith": "Other"
                        }
                
                summary_payload = DataReductionSummary(
                    method=summary.get("methodUsed", method_value),
                    components=safe_int(summary.get("componentsProduced"), n_components),
                    inputColumns=safe_int(summary.get("inputColumns"), len(selected_columns)),
                    originalColumns=safe_int(summary.get("originalColumns"), len(selected_columns)),
                    drColumns=safe_int(summary.get("drColumns"), n_components),
                    outputColumns=safe_int(summary.get("outputColumns"), len(selected_columns) + n_components),
                    varianceExplained=summary.get("varianceExplained"),
                    totalVariance=summary.get("totalVariance"),
                    selectedColumns=summary.get("selectedColumns", selected_columns),
                    rowsInput=safe_int(summary.get("rowsInput"), len(dr_rows)),
                    rowsUsedForFit=safe_int(summary.get("sampleSizeUsed"), len(dr_rows)),
                    seedUsed=summary.get("seedUsed"),
                    droppedColumns=dropped_cols if dropped_cols else None,
                    missingHandling=missing_info,
                    rareLevelHandling=rare_info,
                    drColumnNames=summary.get("drColumnNames", [f"DR{i+1}" for i in range(safe_int(summary.get("componentsProduced"), n_components))]),
                    topContributingVariables=ensure_dict_or_none(summary.get("topContributions")) or ensure_dict_or_none(summary.get("topContributingVariables")),
                )
            except Exception as e:
                print(f"Error creating summary payload: {str(e)}")
                print(f"Summary data: {summary}")
                import traceback
                traceback.print_exc()
                raise

        return DataReductionResponse(
            columns=dr_columns,
            rows=dr_rows,
            updated_at=metadata_updated["updated_at"] if metadata_updated else "",
            selectionRanges=selection_ranges or [],
            totalColumns=total_columns,
            modifiedCells=[],
            summary=summary_payload,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to read DR results: {str(e)}"
        )


class DRResultsHistoryResponse(BaseModel):
    """Response model for DR results history."""
    results: List[Dict[str, Any]]


@router.get("/data-reduction/history/{user_id}/{file_id}", response_model=DRResultsHistoryResponse)
async def get_dr_history(
    user_id: str,
    file_id: str,
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results to return")
):
    """
    Get dimensionality reduction results history for a file.
    
    Args:
        user_id: User identifier
        file_id: File identifier
        limit: Maximum number of results to return (default 10, max 50)
        
    Returns:
        List of DR results with comprehensive metadata
    """
    # Validate user exists
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        results = get_dr_results(user_id, file_id, limit)
        return DRResultsHistoryResponse(results=results)
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to retrieve DR history: {str(e)}"
        )


class DRTableResponse(BaseModel):
    """Response model for DR table data."""
    columns: List[str]
    rows: List[Dict[str, Any]]
    runId: Optional[str] = None


@router.get("/data-reduction/table/{user_id}/{file_id}", response_model=DRTableResponse)
async def get_dr_table(
    user_id: str,
    file_id: str,
    run_id: Optional[str] = Query(None, description="Specific run ID (latest if not provided)")
):
    """
    Get the DR results table (DR1, DR2, ... columns only).
    
    Args:
        user_id: User identifier
        file_id: File identifier
        run_id: Optional run ID (uses latest if not provided)
        
    Returns:
        DR table with DR columns and comprehensive metadata
    """
    # Validate user exists
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build file paths
    file_dir = FILES_DIR / user_id / file_id
    dr_table_path = file_dir / "dr_results.csv"
    
    # Check if DR table exists
    if not dr_table_path.exists():
        raise HTTPException(
            status_code=404, 
            detail="No dimensionality reduction results found for this file"
        )
    
    # Read DR table
    try:
        async with aiofiles.open(dr_table_path, "r", encoding="utf-8") as f:
            content = await f.read()
        
        csv_reader = csv.DictReader(io.StringIO(content))
        columns = list(csv_reader.fieldnames) if csv_reader.fieldnames else []
        rows = list(csv_reader)
        
        # Get run_id from database if requested
        result_run_id = None
        if run_id:
            result = get_dr_result_by_run_id(user_id, file_id, run_id)
            if result:
                result_run_id = result['runId']
        else:
            # Get latest run
            results = get_dr_results(user_id, file_id, limit=1)
            if results and len(results) > 0:
                result_run_id = results[0]['runId']
        
        return DRTableResponse(
            columns=columns,
            rows=rows,
            runId=result_run_id
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to read DR table: {str(e)}"
        )


@router.get("/data-reduction/result/{user_id}/{file_id}/{run_id}")
async def get_specific_dr_result(
    user_id: str,
    file_id: str,
    run_id: str
):
    """
    Get a specific dimensionality reduction result by run ID.
    
    Args:
        user_id: User identifier
        file_id: File identifier
        run_id: Run identifier
        
    Returns:
        DR result with comprehensive metadata and explainability
    """
    # Validate user exists
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = get_dr_result_by_run_id(user_id, file_id, run_id)
    if not result:
        raise HTTPException(
            status_code=404, 
            detail="DR result not found"
        )
    
    return result


class HandleBinningRequest(BaseModel):
    """Request model for categorical binning operations."""

    userId: str
    fileId: str
    selected_columns: List[str]
    method: str  # 'frequency', 'target-based', 'similarity', 'domain', 'custom'
    n_bins: int = 5
    min_freq: int = 10
    target_column: str = None
    custom_mapping: dict = None
    similarity_threshold: float = 0.7
    # Legacy parameters (kept for compatibility)
    bin_labels: List[str] = None
    smooth_window: int = 3
    breaks: List[float] = None


@router.post("/binning", response_model=FileDataResponse)
async def handle_binning_endpoint(request: HandleBinningRequest):
    """
    Apply categorical binning to selected columns in selected.csv using R script.

    Args:
        request: HandleBinningRequest with userId, fileId, columns, method, and parameters

    Returns:
        FileDataResponse with updated data after binning

    Raises:
        HTTPException: If file doesn't exist, R execution fails, or validation fails
    """
    user_id = request.userId
    file_id = request.fileId
    selected_columns = request.selected_columns
    method = request.method
    n_bins = request.n_bins
    min_freq = request.min_freq
    target_column = request.target_column
    custom_mapping = request.custom_mapping
    similarity_threshold = request.similarity_threshold
    # Legacy parameters
    bin_labels = request.bin_labels
    smooth_window = request.smooth_window
    breaks = request.breaks

    # Validate user exists
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Attempt to migrate legacy file if necessary
    migrate_legacy_file(user_id, file_id)

    # Build file paths
    file_dir = FILES_DIR / user_id / file_id
    selected_path = file_dir / "selected.csv"

    # Validate file existence
    if not selected_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Get metadata
    metadata = get_file_metadata(user_id, file_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="File metadata not found")

    # Read current columns from selected.csv
    try:
        async with aiofiles.open(selected_path, "r", encoding="utf-8") as f:
            content = await f.read()

        csv_reader = csv.DictReader(io.StringIO(content))
        current_columns = list(csv_reader.fieldnames) if csv_reader.fieldnames else []
        rows = list(csv_reader)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

    # Validate columns exist
    if not selected_columns or len(selected_columns) == 0:
        raise HTTPException(status_code=400, detail="No columns selected for binning")

    # Check if 'id' column is in selection
    if "id" in selected_columns:
        raise HTTPException(
            status_code=400, detail="Cannot apply binning to 'id' column"
        )

    # Validate all columns exist
    for col in selected_columns:
        if col not in current_columns:
            raise HTTPException(
                status_code=400, detail=f"Column '{col}' does not exist in the file"
            )

    # Check if columns contain numeric data (but allow it - they may have categorical meaning)
    # Numeric columns will be converted to categorical by the R script
    if rows:
        numeric_columns = []
        for col in selected_columns:
            # Sample multiple rows to determine if column is numeric
            sample_values = [rows[i].get(col, "") for i in range(min(5, len(rows)))]
            numeric_count = 0
            
            for value in sample_values:
                if value and value.strip():
                    try:
                        float(value.strip())
                        numeric_count += 1
                    except ValueError:
                        pass
            
            # If most values are numeric, consider it numeric
            if numeric_count >= len(sample_values) * 0.8:
                numeric_columns.append(col)

        # Log warning but don't reject - numeric columns with categorical meaning are valid
        if numeric_columns:
            print(f"Warning: The following columns appear numeric but will be treated as categorical: {', '.join(numeric_columns)}")

    # Validate n_bins range
    if n_bins < 1 or n_bins > 50:
        raise HTTPException(
            status_code=400, detail="Number of bins must be between 1 and 50"
        )
    
    # Validate target_column if specified
    if method == "target-based" or method == "target_based":
        if not target_column:
            raise HTTPException(
                status_code=400, detail="target_column is required for target-based binning"
            )
        if target_column not in current_columns:
            raise HTTPException(
                status_code=400, detail=f"Target column '{target_column}' does not exist in the file"
            )

    # Map method name from frontend (kebab-case) to R (snake_case)
    r_method = map_binning_method_name(method)

    # Execute R script to perform binning
    try:
        handle_binning(
            selected_path,
            selected_columns,
            r_method,
            n_bins,
            bin_labels,
            smooth_window,
            breaks,
            min_freq,
            target_column,
            custom_mapping,
            similarity_threshold,
        )
    except HTTPException:
        raise  # Re-raise HTTPExceptions from r_integration
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Unexpected error during binning: {str(e)}"
        )

    # Update timestamp in database
    update_file_timestamp(user_id, file_id)

    # Read updated CSV and return response
    try:
        async with aiofiles.open(selected_path, "r", encoding="utf-8") as f:
            updated_content = await f.read()

        updated_reader = csv.DictReader(io.StringIO(updated_content))
        updated_columns = (
            list(updated_reader.fieldnames) if updated_reader.fieldnames else []
        )
        file_dir = FILES_DIR / user_id / file_id
        new_cols = list(set(updated_columns) - set(current_columns))
        # Binning usually adds columns, but might replace.
        final_outputs = new_cols if new_cols else selected_columns
        
        log_history(file_dir, "Binning", method, selected_columns, final_outputs)
        updated_rows = list(updated_reader)

        # Get updated metadata
        metadata_updated = get_file_metadata(user_id, file_id)
        selection_ranges = (
            metadata_updated.get("selected_columns", []) if metadata_updated else []
        )
        total_columns = (
            len(metadata["columns"])
            if metadata and metadata["columns"]
            else len(updated_columns)
        )

        return FileDataResponse(
            columns=updated_columns,
            rows=updated_rows,
            updated_at=metadata_updated["updated_at"] if metadata_updated else "",
            selectionRanges=selection_ranges or [],
            totalColumns=total_columns,
            modifiedCells=[],
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to read updated file: {str(e)}"
        )


class FileStatsResponse(BaseModel):
    """Response model for file statistics."""
    
    total_rows: int
    total_columns: int
    categorical_columns: int
    numeric_columns: int
    text_columns: int
    datetime_columns: int
    other_columns: int
    missing_value_percentage: float


@router.get("/stats", response_model=FileStatsResponse)
async def get_file_stats(
    userId: str = Query(..., description="User ID"),
    fileId: str = Query(..., description="File ID"),
):
    """
    Get statistics about the file including column types and missing values.
    
    Args:
        userId: User identifier
        fileId: File identifier
        
    Returns:
        FileStatsResponse with file statistics
        
    Raises:
        HTTPException: If file doesn't exist
    """
    import re
    
    # Attempt to migrate legacy file if necessary
    migrate_legacy_file(userId, fileId)
    
    # Build file path - read from original.csv for true stats
    file_dir = FILES_DIR / userId / fileId
    original_path = file_dir / "original.csv"
    
    # Validate file existence
    if not original_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        # Read CSV file
        async with aiofiles.open(original_path, "r", encoding="utf-8") as f:
            content = await f.read()
        
        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(content))
        fieldnames = list(csv_reader.fieldnames) if csv_reader.fieldnames else []
        rows = list(csv_reader)
        
        total_rows = len(rows)
        total_columns = len(fieldnames)
        
        if total_rows == 0 or total_columns == 0:
            return FileStatsResponse(
                total_rows=total_rows,
                total_columns=total_columns,
                categorical_columns=0,
                numeric_columns=0,
                text_columns=0,
                datetime_columns=0,
                other_columns=0,
                missing_value_percentage=0.0,
            )
        
        # Analyze each column
        categorical_columns = 0
        numeric_columns = 0
        text_columns = 0
        datetime_columns = 0
        other_columns = 0
        total_cells = total_rows * total_columns
        missing_cells = 0
        
        # Common date/time patterns
        datetime_patterns = [
            r'^\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
            r'^\d{2}/\d{2}/\d{4}',  # MM/DD/YYYY or DD/MM/YYYY
            r'^\d{2}-\d{2}-\d{4}',  # MM-DD-YYYY or DD-MM-YYYY
            r'^\d{4}/\d{2}/\d{2}',  # YYYY/MM/DD
            r'\d{2}:\d{2}:\d{2}',   # HH:MM:SS (time component)
            r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}',  # ISO 8601
        ]
        
        # Date/time column name patterns
        datetime_column_patterns = [
            r'date', r'time', r'timestamp', r'datetime',
            r'_at$', r'_on$', r'created', r'updated',
            r'modified', r'deleted', r'ts$', r'dt$'
        ]
        
        for col in fieldnames:
            values = [row.get(col, "") for row in rows]
            non_empty_values = [v for v in values if v and str(v).strip()]
            
            # Count missing values
            missing_cells += len(values) - len(non_empty_values)
            
            if len(non_empty_values) == 0:
                other_columns += 1
                continue
            
            # Sample values for analysis (max 100 for performance)
            sample_size = min(100, len(non_empty_values))
            sample_values = non_empty_values[:sample_size]
            
            # Check if column name suggests date/time
            is_datetime_column_name = any(
                re.search(pattern, col, re.IGNORECASE) 
                for pattern in datetime_column_patterns
            )
            
            # Check if numeric
            numeric_count = 0
            for val in sample_values:
                try:
                    float(str(val).replace(',', ''))
                    numeric_count += 1
                except ValueError:
                    pass
            
            is_numeric = numeric_count / len(sample_values) >= 0.8
            
            # If column name suggests date/time and values are numeric, check for timestamps
            if is_datetime_column_name and is_numeric:
                # Check if values look like Unix timestamps (10 or 13 digits)
                timestamp_count = 0
                for val in sample_values:
                    val_str = str(val).strip()
                    if re.match(r'^\d{10}$', val_str) or re.match(r'^\d{13}$', val_str):
                        timestamp_count += 1
                
                if timestamp_count / len(sample_values) >= 0.7:
                    datetime_columns += 1
                    continue
                else:
                    numeric_columns += 1
                    continue
            elif is_numeric:
                numeric_columns += 1
                continue
            
            # Check if datetime by pattern
            datetime_count = 0
            for val in sample_values:
                val_str = str(val).strip()
                for pattern in datetime_patterns:
                    if re.search(pattern, val_str):
                        datetime_count += 1
                        break
            
            if datetime_count / len(sample_values) >= 0.8 or is_datetime_column_name:
                datetime_columns += 1
                continue
            
            # Check if text (long sentences - avg length > 50 chars)
            avg_length = sum(len(str(v)) for v in sample_values) / len(sample_values)
            if avg_length > 50:
                text_columns += 1
                continue
            
            # Check unique values for categorical
            unique_ratio = len(set(non_empty_values)) / len(non_empty_values)
            if unique_ratio < 0.5:  # Less than 50% unique values suggests categorical
                categorical_columns += 1
            else:
                other_columns += 1
        
        # Calculate missing value percentage
        missing_percentage = (missing_cells / total_cells * 100) if total_cells > 0 else 0.0
        
        return FileStatsResponse(
            total_rows=total_rows,
            total_columns=total_columns,
            categorical_columns=categorical_columns,
            numeric_columns=numeric_columns,
            text_columns=text_columns,
            datetime_columns=datetime_columns,
            other_columns=other_columns,
            missing_value_percentage=round(missing_percentage, 2),
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to calculate file statistics: {str(e)}"
        )


# =========================================================================
# PHASE 3: REPORT GENERATION ENDPOINT (HTML VERSION)
# =========================================================================

@router.get("/report/download")
async def download_report_html(userId: str, fileId: str):
    """
    Generate and download an HTML report using R Markdown.
    
    Endpoint: GET /api/files/report/download?userId=xxx&fileId=yyy
    Returns: HTML file download
    """
    import subprocess
    from datetime import datetime
    
    try:
        # 1. Locate user file directory
        file_dir = FILES_DIR / userId / fileId
        
        if not file_dir.exists():
            raise HTTPException(status_code=404, detail=f"File directory not found for fileId: {fileId}")
        
        # 2. Check required files
        selected_csv = file_dir / "selected.csv"
        original_csv = file_dir / "original.csv"
        history_json = file_dir / "history.json"
        
        if not selected_csv.exists():
            raise HTTPException(status_code=404, detail="Processed data file (selected.csv) not found")
        
        if not original_csv.exists():
            raise HTTPException(status_code=404, detail="Original data file not found")
        
        # 3. Define output file path
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = file_dir / f"DataPrepHIS_Report_{timestamp}.html"
        
        # 4. Call R script to generate report
        r_script_path = Path(__file__).parent.parent / "R_scripts" / "generate_report.R"
        
        if not r_script_path.exists():
            raise HTTPException(status_code=500, detail=f"Report generation script not found: {r_script_path}")
        
        # Run Rscript command
        cmd = [
            "Rscript",
            str(r_script_path),
            str(selected_csv),
            str(original_csv),
            str(history_json),
            str(output_file)
        ]
        
        print(f"Executing R report generation: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 300 second timeout
        )
        
        if result.returncode != 0:
            error_msg = f"R script failed with return code {result.returncode}\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
            print(error_msg)
            raise HTTPException(status_code=500, detail=f"Report generation failed: {result.stderr}")
        
        print(f"R script output:\n{result.stdout}")
        
        # 5. Verify output file was created
        if not output_file.exists():
            raise HTTPException(status_code=500, detail="Report file was not generated")
        
        # 6. Return the HTML file
        return FileResponse(
            path=str(output_file),
            media_type="text/html",
            filename="DataPrepHIS_Report.html"
        )
        
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Report generation timed out")
    except Exception as e:
        print(f"Error generating report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")
