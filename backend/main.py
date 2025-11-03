from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from database.db import init_db
from auth.routes import router as auth_router

app = FastAPI(
    title="HIS Project API",
    description="High Integrity Systems API",
    version="1.0.0"
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth router
app.include_router(auth_router)

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
