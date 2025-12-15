"""
R Script Execution Wrapper
Handles execution of R scripts with JSON I/O
"""

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict


def check_r_installation() -> bool:
    """
    Check if R (Rscript) is installed and available in PATH

    Returns:
        True if R is available, False otherwise
    """
    return shutil.which("Rscript") is not None or _find_rscript_path() is not None


def _find_rscript_path() -> str | None:
    """
    Try to find Rscript in common installation locations

    Returns:
        Path to Rscript executable or None
    """
    common_paths = [
        r"C:\Program Files\R\R-4.4.2\bin\Rscript.exe",
        r"C:\Program Files\R\R-4.4.1\bin\Rscript.exe",
        r"C:\Program Files\R\R-4.4.0\bin\Rscript.exe",
        r"C:\Program Files\R\R-4.3.3\bin\Rscript.exe",
        r"C:\Program Files\R\R-4.3.2\bin\Rscript.exe",
        r"C:\Program Files\R\R-4.3.1\bin\Rscript.exe",
        r"C:\Program Files\R\R-4.2.3\bin\Rscript.exe",
    ]

    for path in common_paths:
        if Path(path).exists():
            return path

    return None


def execute_r_script(
    script_path: Path, input_data: Dict[str, Any], timeout: int = 60
) -> Dict[str, Any]:
    """
    Execute an R script with JSON input via stdin

    Args:
        script_path: Path to the R script file
        input_data: Dictionary to pass as JSON to R script
        timeout: Maximum execution time in seconds

    Returns:
        Dictionary parsed from R script's JSON output

    Raises:
        FileNotFoundError: If script doesn't exist
        subprocess.TimeoutExpired: If execution exceeds timeout
        subprocess.CalledProcessError: If R script fails
        json.JSONDecodeError: If R output is not valid JSON
    """
    if not script_path.exists():
        raise FileNotFoundError(f"R script not found: {script_path}")

    if not check_r_installation():
        raise RuntimeError("R (Rscript) is not installed or not in PATH")

    # Convert input to JSON
    json_input = json.dumps(input_data)

    # Find Rscript executable
    rscript_cmd = shutil.which("Rscript") or _find_rscript_path() or "Rscript"

    # Execute R script
    try:
        result = subprocess.run(
            [rscript_cmd, "--vanilla", str(script_path)],
            input=json_input,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
            check=False,  # Don't raise on non-zero exit
        )

        # Check for execution errors
        if result.returncode != 0:
            error_msg = result.stderr.strip() if result.stderr else "Unknown R error"
            return {"error": f"R script failed: {error_msg}"}

        # Parse JSON output
        if not result.stdout.strip():
            return {"error": "R script produced no output"}

        try:
            output = json.loads(result.stdout)
            return output
        except json.JSONDecodeError as e:
            return {
                "error": f"Invalid JSON output from R: {str(e)}",
                "raw_output": result.stdout[:500],  # First 500 chars for debugging
            }

    except subprocess.TimeoutExpired:
        return {"error": f"R script execution timed out after {timeout} seconds"}
    except Exception as e:
        return {"error": f"Unexpected error executing R script: {str(e)}"}
