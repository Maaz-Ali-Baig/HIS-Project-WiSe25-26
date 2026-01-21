import json
from pathlib import Path
from datetime import datetime

# Update the function to accept 'params'
def log_history(file_dir: Path, action: str, method: str, input_cols: list, output_cols: list, params: dict = None):
    history_file = file_dir / "history.json"
    
    history = []
    if history_file.exists():
        try:
            with open(history_file, "r") as f:
                history = json.load(f)
        except: pass

    entry = {
        "action": action,
        "method": method,
        "inputs": input_cols,
        "outputs": output_cols,
        "params": params or {},  # Store X, Y, Bin count, etc. here
        "timestamp": str(datetime.now())
    }
    
    history.append(entry)

    with open(history_file, "w") as f:
        json.dump(history, f, indent=2)