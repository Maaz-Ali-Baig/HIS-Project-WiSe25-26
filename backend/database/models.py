"""Pydantic models for database schemas."""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import re


class UserCreate(BaseModel):
    """Schema for creating a new user."""
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=8)

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username contains only alphanumeric characters and underscores."""
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username must contain only alphanumeric characters and underscores')
        return v


class UserResponse(BaseModel):
    """Schema for user response (without password)."""
    id: str
    username: str
    created_at: str


class UserInDB(BaseModel):
    """Schema for user in database (includes hashed password)."""
    id: str
    username: str
    hashed_password: str
    created_at: str


class LoginRequest(BaseModel):
    """Schema for login request."""
    username: str
    password: str


class AuthResponse(BaseModel):
    """Schema for authentication response."""
    accessToken: str
    user: UserResponse
