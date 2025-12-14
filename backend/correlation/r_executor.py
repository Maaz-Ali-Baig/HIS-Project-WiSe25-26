"""
R Script Executor for Correlation Analysis

This module provides functionality to execute R scripts with JSON input/output.
"""

import subprocess
import json
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class RExecutionError(Exception):
    """Custom exception for R script execution errors"""
    pass


def execute_r_script(
    script_path: Path,
    input_data: Dict[str, Any],
    timeout: int = 60
) -> Dict[str, Any]:
    """
    Execute an R script with JSON input via stdin and parse JSON output from stdout.
    
    Args:
        script_path: Path to the R script file
        input_data: Dictionary containing input parameters for R script
        timeout: Maximum execution time in seconds (default: 60)
        
    Returns:
        Dictionary containing the parsed JSON output from R script
        
    Raises:
        RExecutionError: If R script execution fails or output cannot be parsed
        FileNotFoundError: If R script file doesn't exist
    """
    if not script_path.exists():
        raise FileNotFoundError(f"R script not found: {script_path}")
    
    # Convert input data to JSON
    json_input = json.dumps(input_data)
    
    try:
        # Execute R script with input via stdin
        logger.info(f"Executing R script: {script_path}")
        logger.debug(f"Input data: {json_input}")
        
        result = subprocess.run(
            ["Rscript", "--vanilla", str(script_path)],
            input=json_input,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=timeout,
            check=False
        )
        
        # Log stderr if present (warnings, etc.)
        if result.stderr:
            logger.warning(f"R script stderr: {result.stderr}")
        
        # Check for execution errors
        if result.returncode != 0:
            error_msg = "R script execution failed"
            if result.stderr:
                # Extract meaningful error from R stderr
                stderr_lines = result.stderr.strip().split('\n')
                # Look for actual error messages (usually start with "Error")
                error_lines = [line for line in stderr_lines if 'Error' in line or 'failed' in line.lower()]
                if error_lines:
                    error_msg = ". ".join(error_lines[:3])  # Take first 3 error lines
                else:
                    error_msg = result.stderr[:500]  # Limit error message length
            logger.error(f"R script failed: {error_msg}")
            raise RExecutionError(error_msg)
        
        # Parse JSON output from stdout
        if not result.stdout.strip():
            raise RExecutionError("R script produced no output")
        
        try:
            output_data = json.loads(result.stdout)
            logger.info("R script executed successfully")
            return output_data
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse R output as JSON: {result.stdout}")
            raise RExecutionError(f"Invalid JSON output from R script: {str(e)}")
    
    except subprocess.TimeoutExpired:
        logger.error(f"R script execution timed out after {timeout} seconds")
        raise RExecutionError(f"R script execution timed out after {timeout} seconds")
    except Exception as e:
        logger.error(f"Unexpected error executing R script: {str(e)}")
        raise RExecutionError(f"Failed to execute R script: {str(e)}")


def check_r_installation() -> bool:
    """
    Check if R is installed and accessible via Rscript command.
    
    Returns:
        True if R is installed, False otherwise
    """
    try:
        result = subprocess.run(
            ["Rscript", "--version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except (subprocess.SubprocessError, FileNotFoundError):
        return False


def check_r_packages(required_packages: list[str]) -> Dict[str, bool]:
    """
    Check if required R packages are installed.
    
    Args:
        required_packages: List of R package names to check
        
    Returns:
        Dictionary mapping package names to installation status
    """
    check_script = """
    packages <- commandArgs(trailingOnly = TRUE)
    installed <- sapply(packages, function(pkg) {
        requireNamespace(pkg, quietly = TRUE)
    })
    cat(paste(packages, installed, sep=':', collapse='\n'))
    """
    
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.R', delete=False) as f:
            f.write(check_script)
            temp_script = Path(f.name)
        
        result = subprocess.run(
            ["Rscript", "--vanilla", str(temp_script)] + required_packages,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        temp_script.unlink()
        
        if result.returncode == 0:
            status = {}
            for line in result.stdout.strip().split('\n'):
                if ':' in line:
                    pkg, installed = line.split(':', 1)
                    status[pkg] = installed.strip().lower() == 'true'
            return status
        else:
            return {pkg: False for pkg in required_packages}
            
    except Exception as e:
        logger.error(f"Failed to check R packages: {str(e)}")
        return {pkg: False for pkg in required_packages}
