# HIS Project Backend

FastAPI backend server for the High Integrity Systems project.

## Setup

### 1. Create a virtual environment

```bash
python -m venv venv
```

### 2. Activate the virtual environment

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Install R packages

The backend uses R for advanced data processing features. Install required R packages:

```bash
Rscript R_scripts/install_packages.R
```

This will automatically install all required R packages:
- `jsonlite` - JSON parsing
- `FactoMineR` - Dimensionality reduction (MCA/FAMD)
- `dplyr`, `readr` - Data manipulation
- `VIM` - Missing value imputation
- `vcd`, `DescTools`, `psych` - Statistical analysis
- `reticulate` - Python integration
- `cluster` - Clustering algorithms

**Note:** Make sure you have R installed on your system. Download from [https://cran.r-project.org/](https://cran.r-project.org/)

## Running the Server

### Development Mode

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The server will start at `http://localhost:8000`

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Available Endpoints

- `GET /` - Root endpoint with API information
- `GET /health` - Health check endpoint

## Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2025-10-28T12:00:00.000000",
  "message": "API is running successfully"
}
```
