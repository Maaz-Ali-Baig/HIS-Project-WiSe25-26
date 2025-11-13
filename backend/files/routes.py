"""File upload routes for CSV file management."""
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Query
from pydantic import BaseModel
from pathlib import Path
from typing import List, Dict, Any
import aiofiles
import csv
import io
from database.db import get_user_by_id, generate_uuid_v7, upsert_file_metadata, get_file_metadata, update_file_timestamp

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


class FileEditRequest(BaseModel):
    """Request model for editing file data."""
    userId: str
    fileId: str
    edits: List[Dict[str, Any]]  # Array of {rowId: str, changes: Dict[str, str]}


def ensure_files_directory():
    """Ensure the files directory exists."""
    FILES_DIR.mkdir(exist_ok=True)


def validate_csv_extension(filename: str) -> bool:
    """Validate that the file has a .csv extension."""
    return filename.lower().endswith('.csv')


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    user_id: str = Form(...),
    username: str = Form(None),
    file: UploadFile = File(...)
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
            status_code=400,
            detail="Invalid file type. Only CSV files are allowed"
        )

    # Generate file ID and create user directory
    file_id = generate_uuid_v7()
    user_dir = FILES_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)

    # Build file path
    file_path = user_dir / f"{file_id}.csv"

    # Read and process CSV content
    try:
        content = await file.read()
        content_str = content.decode('utf-8')

        # Parse CSV to check for ID column
        csv_reader = csv.DictReader(io.StringIO(content_str))
        fieldnames = list(csv_reader.fieldnames) if csv_reader.fieldnames else []
        rows = list(csv_reader)

        # Add ID column if it doesn't exist
        if 'id' not in fieldnames:
            fieldnames.insert(0, 'id')
            # Add sequential IDs to all rows
            for idx, row in enumerate(rows, start=1):
                row['id'] = str(idx)

        # Write normalized CSV with ID column
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

        # Save processed content
        async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
            await f.write(output.getvalue())

        # Persist metadata to database
        upsert_file_metadata(user_id, file_id, fieldnames)

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="File encoding error. Please ensure the file is UTF-8 encoded"
        )
    except csv.Error as e:
        raise HTTPException(
            status_code=400,
            detail=f"CSV parsing error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process file: {str(e)}"
        )

    # Return response
    return FileUploadResponse(
        fileId=file_id,
        path=f"/file/{user_id}/{file_id}.csv",
        userId=user_id,
        filename=file.filename
    )


@router.get("/data", response_model=FileDataResponse)
async def get_file_data(
    userId: str = Query(..., description="User ID who owns the file"),
    fileId: str = Query(..., description="File ID to retrieve")
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
    # Build file path
    file_path = FILES_DIR / userId / f"{fileId}.csv"

    # Validate file existence
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    # Get metadata from database
    metadata = get_file_metadata(userId, fileId)

    # Read and parse CSV file
    try:
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
            content = await f.read()

        # Parse CSV using DictReader
        csv_reader = csv.DictReader(io.StringIO(content))

        # Extract columns - prefer metadata, fallback to CSV header
        if metadata and metadata['columns']:
            columns = metadata['columns']
        else:
            columns = list(csv_reader.fieldnames) if csv_reader.fieldnames else []

        # Process rows and normalize empty cells
        rows = []
        for row in csv_reader:
            # Normalize empty cells to empty string
            normalized_row = {
                key: value if value is not None else ''
                for key, value in row.items()
            }
            rows.append(normalized_row)

        return FileDataResponse(
            columns=columns,
            rows=rows,
            updated_at=metadata['updated_at'] if metadata else ""
        )

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="File encoding error. Please ensure the file is UTF-8 encoded"
        )
    except csv.Error as e:
        raise HTTPException(
            status_code=400,
            detail=f"CSV parsing error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read file: {str(e)}"
        )


@router.put("/data", response_model=FileDataResponse)
async def update_file_data(request: FileEditRequest):
    """
    Update CSV file data by applying edits.

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

    # Build file path
    file_path = FILES_DIR / user_id / f"{file_id}.csv"

    # Validate file existence
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    # Get metadata
    metadata = get_file_metadata(user_id, file_id)
    if not metadata:
        raise HTTPException(
            status_code=404,
            detail="File metadata not found"
        )

    valid_columns = set(metadata['columns'])

    try:
        # Read current CSV content
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
            content = await f.read()

        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(content))
        fieldnames = list(csv_reader.fieldnames) if csv_reader.fieldnames else []
        rows = list(csv_reader)

        # Create edit map: {rowId: {column: value}}
        edit_map = {}
        for edit in edits:
            row_id = str(edit.get('rowId'))
            changes = edit.get('changes', {})

            # Validate columns exist
            for col in changes.keys():
                if col not in valid_columns:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid column: {col}"
                    )

            edit_map[row_id] = changes

        # Apply edits to rows
        for row in rows:
            row_id = row.get('id', '')
            if row_id in edit_map:
                row.update(edit_map[row_id])

        # Write updated CSV
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

        async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
            await f.write(output.getvalue())

        # Update timestamp in database
        update_file_timestamp(user_id, file_id)

        # Return updated data
        metadata_updated = get_file_metadata(user_id, file_id)
        return FileDataResponse(
            columns=fieldnames,
            rows=rows,
            updated_at=metadata_updated['updated_at'] if metadata_updated else ""
        )

    except csv.Error as e:
        raise HTTPException(
            status_code=400,
            detail=f"CSV processing error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update file: {str(e)}"
        )
