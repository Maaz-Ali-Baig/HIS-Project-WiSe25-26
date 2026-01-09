"""File upload routes for CSV file management."""

import csv
import io
from pathlib import Path
from typing import Any, Dict, List

import aiofiles
from database.db import (
    generate_uuid_v7,
    get_file_metadata,
    get_user_by_id,
    update_file_timestamp,
    upsert_file_metadata,
    validate_column_ranges,
)
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from .r_integration import (
    handle_binning,
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

        # Parse CSV to check for ID column
        csv_reader = csv.DictReader(io.StringIO(content_str))
        fieldnames = list(csv_reader.fieldnames) if csv_reader.fieldnames else []
        rows = list(csv_reader)

        # Add ID column if it doesn't exist
        if "id" not in fieldnames:
            fieldnames.insert(0, "id")
            # Add sequential IDs to all rows
            for idx, row in enumerate(rows, start=1):
                row["id"] = str(idx)

        # Write normalized CSV with ID column
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

        # Process rows and normalize empty cells
        rows = []
        for row in csv_reader:
            # Normalize empty cells to empty string
            normalized_row = {
                key: value if value is not None else "" for key, value in row.items()
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

        return FileDataResponse(
            columns=current_columns,
            rows=rows,
            updated_at=metadata["updated_at"] if metadata else "",
            selectionRanges=selection_ranges or [],
            totalColumns=total_columns,
            modifiedCells=modified_cells,
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

    # Validate columns are categorical (NOT numeric) - opposite of previous logic
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

        if numeric_columns:
            raise HTTPException(
                status_code=400,
                detail=f"The following columns appear to be numeric. Categorical binning works on text/categorical data: {', '.join(numeric_columns)}",
            )

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
