"""Authentication routes for user registration and login."""
from fastapi import APIRouter, HTTPException, status
from database.models import UserCreate, LoginRequest, AuthResponse, UserResponse
from database.db import create_user, get_user_by_username
from auth.utils import hash_password, verify_password, create_jwt_token
from pydantic import ValidationError

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """
    Register a new user.

    Args:
        user_data: User registration data (username, password)

    Returns:
        AuthResponse with access token and user info

    Raises:
        HTTPException 400: If username already exists or validation fails
    """
    try:
        # Validate username and password via Pydantic model
        # Additional validation happens in UserCreate model

        # Check if username already exists
        existing_user = get_user_by_username(user_data.username)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )

        # Hash the password
        hashed_password = hash_password(user_data.password)

        # Create user in database
        user = create_user(user_data.username, hashed_password)

        # Generate JWT token
        access_token = create_jwt_token(user["id"], user["username"])

        # Return response
        return AuthResponse(
            accessToken=access_token,
            user=UserResponse(
                id=user["id"],
                username=user["username"],
                created_at=user["created_at"]
            )
        )

    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=AuthResponse)
async def login(login_data: LoginRequest):
    """
    Authenticate a user and return access token.

    Args:
        login_data: Login credentials (username, password)

    Returns:
        AuthResponse with access token and user info

    Raises:
        HTTPException 401: If credentials are invalid
    """
    # Get user from database
    user = get_user_by_username(login_data.username)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # Verify password
    if not verify_password(login_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # Generate JWT token
    access_token = create_jwt_token(user["id"], user["username"])

    # Return response
    return AuthResponse(
        accessToken=access_token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            created_at=user["created_at"]
        )
    )


@router.post("/logout")
async def logout():
    """
    Logout endpoint (client-side cookie clearing).

    Returns:
        Success message
    """
    return {"message": "Logout successful"}
