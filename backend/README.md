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
