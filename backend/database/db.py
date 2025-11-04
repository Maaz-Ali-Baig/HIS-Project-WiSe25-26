"""SQLite database connection and initialization."""
import sqlite3
from datetime import datetime
from uuid import uuid4
from typing import Optional
from pathlib import Path


DATABASE_PATH = Path(__file__).parent.parent / "auth.db"


def get_db_connection():
    """Get a database connection."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database and create tables if they don't exist."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create users table with uuid_v7-like IDs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()
    print(f"Database initialized at {DATABASE_PATH}")


def generate_uuid_v7() -> str:
    """
    Generate a UUID v7-like identifier.
    Note: Python's uuid module doesn't natively support v7,
    so we use uuid4 with timestamp prefix for time-sortable IDs.
    """
    timestamp = int(datetime.utcnow().timestamp() * 1000)
    uuid_part = str(uuid4()).split('-')[-1]
    return f"{timestamp:x}-{uuid_part}"


def create_user(username: str, hashed_password: str) -> dict:
    """Create a new user in the database."""
    conn = get_db_connection()
    cursor = conn.cursor()

    user_id = generate_uuid_v7()
    created_at = datetime.utcnow().isoformat()

    try:
        cursor.execute(
            "INSERT INTO users (id, username, hashed_password, created_at) VALUES (?, ?, ?, ?)",
            (user_id, username, hashed_password, created_at)
        )
        conn.commit()

        return {
            "id": user_id,
            "username": username,
            "created_at": created_at
        }
    except sqlite3.IntegrityError:
        raise ValueError("Username already exists")
    finally:
        conn.close()


def get_user_by_username(username: str) -> Optional[dict]:
    """Get a user by username."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, username, hashed_password, created_at FROM users WHERE username = ?",
        (username,)
    )
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "id": row["id"],
            "username": row["username"],
            "hashed_password": row["hashed_password"],
            "created_at": row["created_at"]
        }
    return None


def get_user_by_id(user_id: str) -> Optional[dict]:
    """Get a user by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, username, created_at FROM users WHERE id = ?",
        (user_id,)
    )
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "id": row["id"],
            "username": row["username"],
            "created_at": row["created_at"]
        }
    return None
