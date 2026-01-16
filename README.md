# HIS Project - High Integrity Systems

Full-stack CSV data management application with secure authentication, file upload capabilities, and interactive data editing.

## Project Structure

```
HIS-Project-WiSe25-26/
├── frontend/
│   └── vite-project/           # React 19 + Vite + TypeScript
│       ├── src/
│       │   ├── components/     # Reusable UI components (DataTable, shadcn/ui)
│       │   ├── features/       # Feature modules (auth, home)
│       │   ├── lib/            # Utilities (http, cookies, utils)
│       │   ├── store/          # Zustand state management (auth, fileStore)
│       │   ├── providers/      # React Query provider
│       │   └── router.tsx      # React Router configuration
│       └── package.json
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── auth/                   # Authentication module (JWT + Argon2)
│   ├── database/               # SQLite database & Pydantic models
│   ├── files/                  # File upload/edit endpoints
│   ├── files/                  # Uploaded CSV storage directory
│   ├── auth.db                 # SQLite database
│   └── requirements.txt
├── scripts/                    # Helper scripts
├── start.bat                   # Windows startup script
├── start.sh                    # Linux/Mac startup script
└── package.json                # Root package configuration
```

## Quick Start

### First Time Setup

**Prerequisites:**
- Node.js (v18+)
- Python (v3.9+)
- R (v4.0+) - [Download from CRAN](https://cran.r-project.org/)

#### Option 1: Install All Dependencies at Once (Recommended)

```bash
npm run install:all
```

This will install:
- Frontend dependencies (React, Vite, etc.)
- Backend dependencies (FastAPI, rpy2, etc.)
- R packages (FactoMineR, VIM, etc.)

#### Option 2: Install Separately

**Frontend:**

```bash
npm run install:frontend
```

**Backend:**

```bash
npm run install:backend
```

**R Packages (Required for Data Processing):**

```bash
# Install all required R packages
Rscript backend/R_scripts/install_packages.R
```

Required R packages:
- `jsonlite` - JSON parsing
- `FactoMineR` - Dimensionality reduction (MCA/FAMD)
- `dplyr`, `readr` - Data manipulation
- `VIM` - Missing value imputation
- `vcd`, `DescTools`, `psych` - Statistical analysis
- `reticulate` - Python integration
- `cluster` - Clustering algorithms

### Starting the Application

#### Windows:

```bash
# Double-click start.bat or run:
start.bat
```

#### Linux/Mac:

```bash
./start.sh
```

#### Using npm:

```bash
npm start
```

This will start both servers:

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Development

### Start Services Individually

**Frontend only:**

```bash
npm run start:frontend
```

**Backend only:**

```bash
npm run start:backend
```

### Frontend Development

The frontend uses:

- **React 19.1.1** with TypeScript
- **Vite 7.1.7** (fast build tool)
- **React Compiler** (automatic optimization)
- **Zustand** (state management)
- **TanStack React Query** (server state)
- **TanStack React Table** with virtualization (performance for large datasets)
- **shadcn/ui** (Radix UI components)
- **Tailwind CSS 4.0**
- **React Router 7.9.5**

Navigate to [frontend/vite-project](frontend/vite-project) for more details.

### Backend Development

The backend uses:

- **FastAPI 0.115.6** (modern async Python web framework)
- **Uvicorn 0.34.0** (ASGI server)
- **Pydantic 2.10.5** (data validation)
- **SQLite3** (database)
- **Argon2** (password hashing)
- **PyJWT 2.9.0** (JWT authentication)
- **aiofiles** (async file operations)

Navigate to [backend](backend) for more details.

## Features

### Authentication System
- **User Registration** with validation (3-20 char username, 8+ char password)
- **Secure Login** with JWT tokens and Argon2 password hashing
- **Remember Me** functionality (7-day cookie persistence)
- **Protected Routes** requiring authentication
- Automatic token hydration on app load

### CSV File Management
- **Upload CSV files** with automatic validation
- **Interactive Data Table** with virtualized rows/columns (handles large datasets)
- **Double-click editing** for cells
- **Pending edits tracking** with save/discard options
- **File download** capability
- **User-isolated storage** (files/{user_id}/{file_id}.csv)

### Data Table Features
- Virtual scrolling for optimal performance
- Sortable columns (numeric & string aware)
- Inline cell editing
- Real-time edit visualization (yellow highlight)
- Keyboard shortcuts (Enter to save, Escape to cancel)
- Responsive design

### Text Transformation (AI-Powered)
- **Automatic Theme Detection** - Transforms free text columns into categorical themes
- **Sentence Embeddings** - Uses advanced NLP models (sentence-transformers)
- **K-means Clustering** - Groups similar texts automatically
- **Smart Labeling** - Generates meaningful theme names using KeyBERT
- **Missing Value Handling** - Preserves empty/NA values separately
- **Auto-Optimization** - Uses silhouette score to determine optimal number of themes
- **Python & R Support** - Available in both backend implementations

## Available Endpoints

### Authentication API
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate and receive JWT token
- `POST /api/auth/logout` - Clear authentication

### File Management API
- `POST /api/files/upload` - Upload CSV file (max 10MB client-side)
- `GET /api/files/data?userId=X&fileId=Y` - Retrieve file data as JSON
- `PUT /api/files/data` - Update CSV with edited cells
- `GET /file/{user_id}/{file_id}.csv` - Download CSV file

### System API
- `GET /` - Root endpoint with API information
- `GET /health` - Health check endpoint
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API documentation

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2025-10-28T12:00:00.000000",
  "message": "API is running successfully"
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TEXT NOT NULL
)
```

### Files Table
```sql
CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    columns TEXT NOT NULL,  -- JSON array
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, file_id),
    FOREIGN KEY(user_id) REFERENCES users(id)
)
```

## Building for Production

### Frontend Build

```bash
npm run build:frontend
```

The production build will be in `frontend/dist/`

## Troubleshooting

### Backend Virtual Environment Issues

If you encounter issues with the Python virtual environment:

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

### Frontend Dependencies Issues

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Port Already in Use

If ports 5173 or 8000 are already in use:

- **Frontend**: Change in [frontend/vite-project/vite.config.ts](frontend/vite-project/vite.config.ts)
- **Backend**: Add `--port XXXX` flag in start scripts or modify uvicorn command in [backend/main.py](backend/main.py)

## Security Considerations

### For Production Deployment

⚠️ **Important**: Before deploying to production:

1. **Change JWT Secret**: Replace hardcoded JWT secret in [backend/auth/utils.py](backend/auth/utils.py:11)
   - Use environment variable: `os.getenv("JWT_SECRET_KEY")`
   - Generate strong secret: `openssl rand -hex 32`

2. **Add JWT Token Expiry**: Configure token expiration in JWT payload

3. **File Upload Validation**: Add server-side file size limits and type validation

4. **Rate Limiting**: Implement rate limiting for file uploads and authentication endpoints

5. **HTTPS**: Use HTTPS in production for secure token transmission

6. **Database Migrations**: Implement proper database migration system for schema changes

7. **Input Sanitization**: Add additional validation for CSV content and user inputs

## Technologies

### Frontend Stack

- **React 19.1.1** (UI library)
- **TypeScript 5.9.3** (type safety)
- **Vite 7.1.7** (build tool)
- **React Compiler** (optimization)
- **Zustand 5.0.8** (state management)
- **TanStack React Query 5.90.6** (server state)
- **TanStack React Table 8.20.6** (data tables)
- **TanStack React Virtual 3.11.3** (virtualization)
- **shadcn/ui** (component library based on Radix UI)
- **Tailwind CSS 4.0** (styling)
- **React Router 7.9.5** (routing)
- **React Hook Form 7.66.0** (form handling)
- **Zod 4.1.12** (schema validation)

### Backend Stack

- **FastAPI 0.115.6** (web framework)
- **Uvicorn 0.34.0** (ASGI server)
- **Pydantic 2.10.5** (data validation)
- **SQLite3** (database)
- **Argon2-cffi 23.1.0** (password hashing)
- **PyJWT 2.9.0** (JWT authentication)
- **aiofiles 24.1.0** (async file I/O)
- **python-multipart 0.0.12** (form parsing)
- **Python 3.8+** (runtime)

## License

ISC
