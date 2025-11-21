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
            selected_columns TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, file_id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    # Migration: Add selected_columns column if it doesn't exist (for existing databases)
    try:
        cursor.execute("SELECT selected_columns FROM files LIMIT 1")
    except sqlite3.OperationalError:
        # Column doesn't exist, add it
        print("Migrating database: Adding selected_columns column to files table")
        cursor.execute("ALTER TABLE files ADD COLUMN selected_columns TEXT")
        conn.commit()
        print("Migration complete: selected_columns column added")

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


def upsert_file_metadata(user_id: str, file_id: str, columns: list[str], selected_columns: Optional[list[dict]] = None) -> dict:
    """Insert or update file metadata."""
    import json
    conn = get_db_connection()
    cursor = conn.cursor()

    now = datetime.utcnow().isoformat()
    columns_json = json.dumps(columns)
    selected_columns_json = json.dumps(selected_columns) if selected_columns is not None else None

    try:
        # Try to update existing record
        cursor.execute(
            """UPDATE files SET columns = ?, selected_columns = ?, updated_at = ?
               WHERE user_id = ? AND file_id = ?""",
            (columns_json, selected_columns_json, now, user_id, file_id)
        )

        # If no rows updated, insert new record
        if cursor.rowcount == 0:
            cursor.execute(
                """INSERT INTO files (user_id, file_id, columns, selected_columns, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (user_id, file_id, columns_json, selected_columns_json, now, now)
            )

        conn.commit()
        return {
            "user_id": user_id,
            "file_id": file_id,
            "columns": columns,
            "selected_columns": selected_columns,
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
        "SELECT columns, selected_columns, created_at, updated_at FROM files WHERE user_id = ? AND file_id = ?",
        (user_id, file_id)
    )
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "columns": json.loads(row["columns"]),
            "selected_columns": json.loads(row["selected_columns"]) if row["selected_columns"] else None,
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


def validate_column_ranges(ranges: list[dict], total_columns: int) -> tuple[bool, Optional[str]]:
    """
    Validate column selection ranges.

    Args:
        ranges: List of range objects with 'start' and 'end' keys (zero-based, inclusive)
        total_columns: Total number of columns in the file

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Empty ranges means "select all"
    if not ranges or len(ranges) == 0:
        return True, None

    # Validate each range
    for idx, range_obj in enumerate(ranges):
        if not isinstance(range_obj, dict):
            return False, f"Range {idx} must be an object"

        if 'start' not in range_obj or 'end' not in range_obj:
            return False, f"Range {idx} must have 'start' and 'end' keys"

        start = range_obj['start']
        end = range_obj['end']

        if not isinstance(start, int) or not isinstance(end, int):
            return False, f"Range {idx} start and end must be integers"

        if start < 0 or end < 0:
            return False, f"Range {idx} indices must be non-negative"

        if start >= total_columns or end >= total_columns:
            return False, f"Range {idx} indices must be less than {total_columns}"

        if start > end:
            return False, f"Range {idx} start must be <= end"

    # Sort ranges by start for overlap check
    sorted_ranges = sorted(ranges, key=lambda r: r['start'])

    # Check for overlaps
    for i in range(len(sorted_ranges) - 1):
        current_end = sorted_ranges[i]['end']
        next_start = sorted_ranges[i + 1]['start']

        if current_end >= next_start:
            return False, f"Ranges overlap: [{sorted_ranges[i]['start']}-{current_end}] and [{next_start}-{sorted_ranges[i+1]['end']}]"

    return True, None
