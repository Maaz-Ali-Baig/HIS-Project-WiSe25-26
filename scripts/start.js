const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('========================================');
console.log('Starting HIS Project');
console.log('========================================\n');

const isWindows = process.platform === 'win32';
const backendDir = path.join(__dirname, '..', 'backend');
const frontendDir = path.join(__dirname, '..', 'frontend', 'vite-project');

// Check if backend venv exists
const venvPath = path.join(backendDir, 'venv');
if (!fs.existsSync(venvPath)) {
    console.log('Backend virtual environment not found!');
    console.log('Please run: npm run install:backend');
    process.exit(1);
}

// Check if frontend node_modules exists
const nodeModulesPath = path.join(frontendDir, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
    console.log('Frontend dependencies not found!');
    console.log('Please run: npm run install:frontend');
    process.exit(1);
}

const processes = [];

// Start backend
console.log('Starting Backend Server...');
const backendActivate = isWindows
    ? path.join(venvPath, 'Scripts', 'activate.bat')
    : path.join(venvPath, 'bin', 'activate');

const backendCmd = isWindows
    ? `cmd.exe /c "${backendActivate} && uvicorn main:app --reload --host 0.0.0.0 --port 8000"`
    : `bash -c "source ${backendActivate} && uvicorn main:app --reload --host 0.0.0.0 --port 8000"`;

const backend = spawn(backendCmd, [], {
    cwd: backendDir,
    shell: true,
    stdio: 'inherit'
});

processes.push(backend);

// Wait a bit for backend to start
setTimeout(() => {
    console.log('\nStarting Frontend Dev Server...');

    const frontend = spawn('npm', ['run', 'dev'], {
        cwd: frontendDir,
        shell: true,
        stdio: 'inherit'
    });

    processes.push(frontend);

    console.log('\n========================================');
    console.log('Both servers are running!');
    console.log('========================================');
    console.log('Frontend: http://localhost:5173');
    console.log('Backend:  http://localhost:8000');
    console.log('API Docs: http://localhost:8000/docs');
    console.log('========================================\n');
    console.log('Press Ctrl+C to stop all servers...\n');
}, 3000);

// Handle cleanup
process.on('SIGINT', () => {
    console.log('\n\nStopping servers...');
    processes.forEach(proc => {
        if (proc && !proc.killed) {
            proc.kill('SIGTERM');
        }
    });
    process.exit(0);
});

process.on('SIGTERM', () => {
    processes.forEach(proc => {
        if (proc && !proc.killed) {
            proc.kill('SIGTERM');
        }
    });
    process.exit(0);
});
