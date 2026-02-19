@echo off
setlocal enabledelayedexpansion

echo [BOOTSTRAP] Checking for blocking processes...
set APP_PORT=3002

:: Try to read PORT from .env
if exist "robs-backend\.env" (
    for /f "tokens=1,2 delims==" %%A in (robs-backend\.env) do (
        if "%%A"=="PORT" set APP_PORT=%%B
    )
)

echo [BOOTSTRAP] Target Port: %APP_PORT%

:: Find PID occupying the port
set PID=
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%APP_PORT%') do (
    set PID=%%a
)

:: Kill if found and not PID 0
if defined PID (
    if "!PID!" NEQ "0" (
        echo [BOOTSTRAP] Port %APP_PORT% is busy by PID !PID!. Killing it...
        taskkill /F /PID !PID! >nul 2>&1
        timeout /t 2 /nobreak >nul
    )
)

echo [BOOTSTRAP] Validating environment...
if not exist "robs-backend\.env" (
    echo [ERROR] robs-backend\.env file is missing!
    echo Please create it from .env.example before running this script.
    exit /b 1
)

echo [BOOTSTRAP] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed.
    exit /b %ERRORLEVEL%
)

echo [BOOTSTRAP] Building frontend...
if exist "robs-frontend" (
    pushd robs-frontend
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Frontend build failed.
        popd
        exit /b %ERRORLEVEL%
    )
    popd
) else (
    echo [WARN] robs-frontend directory not found. Skipping frontend build.
)

echo [BOOTSTRAP] Starting backend in production mode...
pushd robs-backend
call npm run start:prod
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend failed to start or crashed.
    popd
    exit /b %ERRORLEVEL%
)
popd

endlocal
