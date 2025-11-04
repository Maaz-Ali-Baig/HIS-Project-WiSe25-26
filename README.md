# HIS Project - High Integrity Systems

Full-stack High Integrity Systems application with React 19.2 frontend and FastAPI backend.

## Project Structure

```
HIS-Project-WiSe25-26/
├── frontend/          # React 19.2 + Vite + React Compiler
├── backend/           # FastAPI + Python
├── scripts/           # Helper scripts
├── start.bat          # Windows startup script
├── start.sh           # Linux/Mac startup script
└── package.json       # Project configuration
```

## Quick Start

### First Time Setup

#### Option 1: Install All Dependencies at Once

```bash
npm run install:all
```

#### Option 2: Install Separately

**Frontend:**
```bash
npm run install:frontend
```

**Backend:**
```bash
npm run install:backend
```

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
- React 19.2
- Vite (fast build tool)
- React Compiler (automatic optimization)

Navigate to `frontend/` for more details.

### Backend Development

The backend uses:
- FastAPI (modern Python web framework)
- Uvicorn (ASGI server)
- Pydantic (data validation)

Navigate to `backend/` for more details.

## Available Endpoints

### Backend API

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
- Frontend: Change in `frontend/vite.config.js`
- Backend: Add `--port XXXX` flag in start scripts

## Technologies

### Frontend
- React 19.2
- Vite 7.x
- React Compiler
- shadcn/ui (component library)
- Modern ES6+ JavaScript

### Backend
- FastAPI 0.115+
- Uvicorn
- Pydantic
- Python 3.8+

## Claude Code Integration

### MCP Servers

This project includes MCP (Model Context Protocol) server configuration for enhanced development with Claude Code.

**shadcn MCP Server**: Provides intelligent component integration and management for shadcn/ui components.

Configuration file: [.claude/mcp.json](.claude/mcp.json)

**Usage with Claude Code:**
- Component installation: Ask Claude to add shadcn components (e.g., "add shadcn button component")
- Component customization: Request component variants and modifications
- Theme management: Configure and customize shadcn themes

**Manual Configuration** (if needed):
1. Ensure the MCP configuration is recognized by Claude Code
2. Restart Claude Code if the shadcn MCP server doesn't appear
3. The server runs in the `frontend/` directory context

## License

ISC
