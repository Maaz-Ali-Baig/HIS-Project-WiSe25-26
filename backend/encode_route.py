# backend/app/encode_route.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from pathlib import Path
from typing import Optional, List
import subprocess
import uuid
import os

encode_router = APIRouter()

# Base directory where your files are stored
BASE_DIR = Path(__file__).parent  # backend/
FILES_DIR = Path(__file__).parent.parent / "backend" / "files"
R_SCRIPT_PATH = BASE_DIR / "preprocess.R"

SUPPORTED_ENCODINGS = {"label", "onehot", "ordinal", "frequency", "target"}


# Request Model
class EncodeRequest(BaseModel):
    userId: str
    fileId: str
    encodingType: str
    targetColumns: Optional[List[str]] = None


# API Route
@encode_router.post("/encode")
def encode(req: EncodeRequest):

    user_id = req.userId
    file_id = req.fileId
    encoding = req.encodingType.lower()

    print("➡️ Incoming Request:", req)

    if encoding not in SUPPORTED_ENCODINGS:
        raise HTTPException(status_code=400, detail=f"Unsupported encoding: {encoding}")

    selected_path = FILES_DIR / user_id / file_id / "selected.csv"
    print("Selected path:", selected_path)

    if not selected_path.exists():
        raise HTTPException(status_code=404, detail="Selected CSV not found for given userId/fileId")

    if not R_SCRIPT_PATH.exists():
        raise HTTPException(status_code=500, detail=f"R script not found at {R_SCRIPT_PATH}")

    # Output file
    out_file_name = f"encoded_{uuid.uuid4().hex}.csv"
    output_path = FILES_DIR / user_id / file_id / out_file_name

    # Base Rscript command
    cmd = [
        "Rscript",
        str(R_SCRIPT_PATH),
        str(selected_path),
        str(output_path),
        encoding
    ]

    # ------------------------------
    # Handle target encoding
    # ------------------------------
    if encoding == "target":
        if not req.targetColumns or len(req.targetColumns) == 0:
            raise HTTPException(
                status_code=400,
                detail="targetColumns must be provided for target encoding"
            )

        # Convert Python list → comma-separated string
        target_cols_arg = ",".join(req.targetColumns)
        cmd.append(target_cols_arg)

    # ------------------------------
    # Run R Script
    # ------------------------------
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run Rscript: {e}")

    print("R STDOUT:", result.stdout)
    print("R STDERR:", result.stderr)

    if result.returncode != 0:
        return JSONResponse(
            status_code=500,
            content={"error": "Rscript failed", "details": result.stderr}
        )

    # Success — return file
    return FileResponse(
        path=str(output_path),
        filename="encoded_output.csv",
        media_type='text/csv'
    )
