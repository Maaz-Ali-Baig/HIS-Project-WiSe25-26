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

    # Create files table for CSV metadata
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            file_id TEXT NOT NULL,
            columns TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, file_id),
            FOREIGN KEY(user_id) REFERENCES users(id)
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


def upsert_file_metadata(user_id: str, file_id: str, columns: list[str]) -> dict:
    """Insert or update file metadata."""
    import json
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.utcnow().isoformat()
    columns_json = json.dumps(columns)

    try:
        # Try to update existing record
        cursor.execute(
            """UPDATE files SET columns = ?, updated_at = ?
               WHERE user_id = ? AND file_id = ?""",
            (columns_json, now, user_id, file_id)
        )

        # If no rows updated, insert new record
        if cursor.rowcount == 0:
            cursor.execute(
                """INSERT INTO files (user_id, file_id, columns, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (user_id, file_id, columns_json, now, now)
            )

        conn.commit()
        return {
            "user_id": user_id,
            "file_id": file_id,
            "columns": columns,
            "updated_at": now
        }
    finally:
        conn.close()


def get_file_metadata(user_id: str, file_id: str) -> Optional[dict]:
    """Get file metadata by user_id and file_id."""
    import json
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT columns, created_at, updated_at FROM files WHERE user_id = ? AND file_id = ?",
        (user_id, file_id)
    )
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "columns": json.loads(row["columns"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        }
    return None


def update_file_timestamp(user_id: str, file_id: str) -> None:
    """Update the updated_at timestamp for a file."""
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE files SET updated_at = ? WHERE user_id = ? AND file_id = ?",
        (now, user_id, file_id)
    )

    conn.commit()
    conn.close()
