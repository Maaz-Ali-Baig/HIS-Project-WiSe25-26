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
    
    # Migration: Add column_highlights column if it doesn't exist
    try:
        cursor.execute("SELECT column_highlights FROM files LIMIT 1")
    except sqlite3.OperationalError:
        # Column doesn't exist, add it
        print("Migrating database: Adding column_highlights column to files table")
        cursor.execute("ALTER TABLE files ADD COLUMN column_highlights TEXT")
        conn.commit()
        print("Migration complete: column_highlights column added")

    # Create data_reduction_results table for storing DR transformations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS data_reduction_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            file_id TEXT NOT NULL,
            run_id TEXT NOT NULL,
            method_used TEXT NOT NULL,
            components_requested INTEGER NOT NULL,
            components_produced INTEGER NOT NULL,
            rows_input INTEGER NOT NULL,
            rows_output INTEGER NOT NULL,
            output_mode TEXT NOT NULL,
            output_columns TEXT NOT NULL,
            variance_explained TEXT,
            total_variance REAL,
            selected_columns TEXT NOT NULL,
            kept_columns TEXT NOT NULL,
            dropped_columns TEXT,
            treated_as_numeric TEXT,
            treated_as_categorical TEXT,
            suspected_code_columns TEXT,
            missing_handling TEXT,
            rare_threshold INTEGER,
            collapsed_to_other TEXT,
            max_cardinality INTEGER,
            sample_size_used INTEGER,
            seed_used INTEGER,
            runtime_seconds REAL,
            top_contributions TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    # Create index on user_id and file_id for faster lookups
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_dr_user_file 
        ON data_reduction_results(user_id, file_id)
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


def store_dr_result(user_id: str, file_id: str, dr_data: dict) -> str:
    """
    Store dimensionality reduction result in the database.
    
    Args:
        user_id: User identifier
        file_id: File identifier
        dr_data: Dictionary containing all DR metadata
        
    Returns:
        The run_id of the stored result
    """
    import json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    run_id = generate_uuid_v7()
    created_at = datetime.utcnow().isoformat()
    
    cursor.execute("""
        INSERT INTO data_reduction_results (
            user_id, file_id, run_id, method_used, components_requested, 
            components_produced, rows_input, rows_output, output_mode, output_columns,
            variance_explained, total_variance, selected_columns, kept_columns,
            dropped_columns, treated_as_numeric, treated_as_categorical, 
            suspected_code_columns, missing_handling, rare_threshold, 
            collapsed_to_other, max_cardinality, sample_size_used, seed_used,
            runtime_seconds, top_contributions, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id, file_id, run_id,
        dr_data.get('methodUsed'),
        dr_data.get('componentsRequested'),
        dr_data.get('componentsProduced'),
        dr_data.get('rowsInput'),
        dr_data.get('rowsOutput'),
        dr_data.get('outputMode', 'append'),
        json.dumps(dr_data.get('outputColumns', [])),
        json.dumps(dr_data.get('varianceExplained', [])),
        dr_data.get('totalVariance'),
        json.dumps(dr_data.get('selectedColumns', [])),
        json.dumps(dr_data.get('keptColumns', [])),
        json.dumps(dr_data.get('droppedColumns', [])),
        json.dumps(dr_data.get('treatedAsNumeric', [])),
        json.dumps(dr_data.get('treatedAsCategorical', [])),
        json.dumps(dr_data.get('suspectedCodeColumns', [])),
        dr_data.get('missingHandling'),
        dr_data.get('rareThreshold'),
        json.dumps(dr_data.get('collapsedToOther', {})),
        dr_data.get('maxCardinality'),
        dr_data.get('sampleSizeUsed'),
        dr_data.get('seedUsed'),
        dr_data.get('runtimeSeconds'),
        json.dumps(dr_data.get('topContributions', {})),
        created_at
    ))
    
    conn.commit()
    conn.close()
    
    return run_id


def get_dr_results(user_id: str, file_id: str, limit: int = 10) -> list[dict]:
    """
    Get dimensionality reduction results for a file.
    
    Args:
        user_id: User identifier
        file_id: File identifier
        limit: Maximum number of results to return (most recent first)
        
    Returns:
        List of DR result dictionaries
    """
    import json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM data_reduction_results
        WHERE user_id = ? AND file_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    """, (user_id, file_id, limit))
    
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        # Handle missingHandling - could be string or JSON
        missing_handling = row['missing_handling']
        if missing_handling:
            try:
                missing_handling = json.loads(missing_handling)
            except (json.JSONDecodeError, TypeError):
                # If it's not JSON, keep it as is (backward compatibility)
                pass
        
        results.append({
            'id': row['id'],
            'runId': row['run_id'],
            'methodUsed': row['method_used'],
            'componentsRequested': row['components_requested'],
            'componentsProduced': row['components_produced'],
            'rowsInput': row['rows_input'],
            'rowsOutput': row['rows_output'],
            'outputMode': row['output_mode'],
            'outputColumns': json.loads(row['output_columns']) if row['output_columns'] else [],
            'varianceExplained': json.loads(row['variance_explained']) if row['variance_explained'] else [],
            'totalVariance': row['total_variance'],
            'selectedColumns': json.loads(row['selected_columns']) if row['selected_columns'] else [],
            'keptColumns': json.loads(row['kept_columns']) if row['kept_columns'] else [],
            'droppedColumns': json.loads(row['dropped_columns']) if row['dropped_columns'] else [],
            'treatedAsNumeric': json.loads(row['treated_as_numeric']) if row['treated_as_numeric'] else [],
            'treatedAsCategorical': json.loads(row['treated_as_categorical']) if row['treated_as_categorical'] else [],
            'suspectedCodeColumns': json.loads(row['suspected_code_columns']) if row['suspected_code_columns'] else [],
            'missingHandling': missing_handling,
            'rareThreshold': row['rare_threshold'],
            'collapsedToOther': json.loads(row['collapsed_to_other']) if row['collapsed_to_other'] else {},
            'maxCardinality': row['max_cardinality'],
            'sampleSizeUsed': row['sample_size_used'],
            'seedUsed': row['seed_used'],
            'runtimeSeconds': row['runtime_seconds'],
            'topContributions': json.loads(row['top_contributions']) if row['top_contributions'] else [],
            'createdAt': row['created_at']
        })
    
    return results


def get_dr_result_by_run_id(user_id: str, file_id: str, run_id: str) -> Optional[dict]:
    """
    Get a specific dimensionality reduction result by run_id.
    
    Args:
        user_id: User identifier
        file_id: File identifier
        run_id: Run identifier
        
    Returns:
        DR result dictionary or None
    """
    import json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM data_reduction_results
        WHERE user_id = ? AND file_id = ? AND run_id = ?
    """, (user_id, file_id, run_id))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    # Handle missingHandling - could be string or JSON
    missing_handling = row['missing_handling']
    if missing_handling:
        try:
            missing_handling = json.loads(missing_handling)
        except (json.JSONDecodeError, TypeError):
            # If it's not JSON, keep it as is (backward compatibility)
            pass
    
    return {
        'id': row['id'],
        'runId': row['run_id'],
        'methodUsed': row['method_used'],
        'componentsRequested': row['components_requested'],
        'componentsProduced': row['components_produced'],
        'rowsInput': row['rows_input'],
        'rowsOutput': row['rows_output'],
        'outputMode': row['output_mode'],
        'outputColumns': json.loads(row['output_columns']) if row['output_columns'] else [],
        'varianceExplained': json.loads(row['variance_explained']) if row['variance_explained'] else [],
        'totalVariance': row['total_variance'],
        'selectedColumns': json.loads(row['selected_columns']) if row['selected_columns'] else [],
        'keptColumns': json.loads(row['kept_columns']) if row['kept_columns'] else [],
        'droppedColumns': json.loads(row['dropped_columns']) if row['dropped_columns'] else [],
        'treatedAsNumeric': json.loads(row['treated_as_numeric']) if row['treated_as_numeric'] else [],
        'treatedAsCategorical': json.loads(row['treated_as_categorical']) if row['treated_as_categorical'] else [],
        'suspectedCodeColumns': json.loads(row['suspected_code_columns']) if row['suspected_code_columns'] else [],
        'missingHandling': missing_handling,
        'rareThreshold': row['rare_threshold'],
        'collapsedToOther': json.loads(row['collapsed_to_other']) if row['collapsed_to_other'] else {},
        'maxCardinality': row['max_cardinality'],
        'sampleSizeUsed': row['sample_size_used'],
        'seedUsed': row['seed_used'],
        'runtimeSeconds': row['runtime_seconds'],
        'topContributions': json.loads(row['top_contributions']) if row['top_contributions'] else [],
        'createdAt': row['created_at']
    }

