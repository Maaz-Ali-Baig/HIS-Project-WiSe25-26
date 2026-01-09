@echo off
echo ========================================
echo Starting HIS Project
echo ========================================
echo.

REM Check if backend venv311 exists
if not exist "backend\venv311\" (
    echo Creating Python virtual environment...
    cd backend
    py -3.11 -m venv venv311
    call venv311\Scripts\activate
    echo Installing Python dependencies...
    pip install -r requirements.txt
    cd ..
    echo.
)

REM Check if frontend node_modules exists
if not exist "frontend\node_modules\" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
    echo.
)

echo Starting Backend Server...
start "Backend Server" cmd /k "cd backend && venv311\Scripts\activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo Waiting for backend to initialize...
timeout /t 3 /nobreak > nul

echo Starting Frontend Dev Server...
start "Frontend Dev Server" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo Both servers are starting!
echo ========================================
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo ========================================
echo.
echo Press any key to stop all servers...
pause > nul

echo.
echo Stopping servers...
taskkill /FI "WindowTitle eq Backend Server*" /T /F > nul 2>&1
taskkill /FI "WindowTitle eq Frontend Dev Server*" /T /F > nul 2>&1
echo Servers stopped.
