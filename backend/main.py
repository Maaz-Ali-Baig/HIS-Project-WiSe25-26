# -*- coding: utf-8 -*-
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from datetime import datetime
from database.db import init_db
from auth.routes import router as auth_router
from files.routes import router as files_router, ensure_files_directory
from correlation.routes import router as correlation_router
from pathlib import Path

app = FastAPI(
    title="HIS Project API",
    description="High Integrity Systems API",
    version="1.0.0"
)

# Initialize database and files directory on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    ensure_files_directory()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(files_router)
app.include_router(correlation_router)

# Mount static files directory for serving uploaded CSV files
FILES_DIR = Path(__file__).parent / "files"
app.mount("/file", StaticFiles(directory=str(FILES_DIR)), name="files")

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    message: str

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint to verify the API is running.

    Returns:
        HealthResponse: Status information including timestamp
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        message="API is running successfully"
    )

@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint with API information.
    """
    return {
        "name": "HIS Project API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }
