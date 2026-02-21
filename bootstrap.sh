#!/bin/bash

# RMS Bootstrap Script for Linux/macOS
# This script automates the setup and startup of the Restaurant Management System.

echo "🚀 [BOOTSTRAP] Starting RMS Setup..."

# 1. Validate Environment
if [ ! -f "robs-backend/.env" ]; then
    echo "❌ [ERROR] robs-backend/.env file is missing!"
    echo "   Please create it from .env.example before running this script."
    exit 1
fi

# 2. Install Dependencies
echo "📦 [BOOTSTRAP] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ [ERROR] npm install failed."
    exit 1
fi

# 3. Build Frontend
echo "🏗️ [BOOTSTRAP] Building frontend..."
if [ -d "robs-frontend" ]; then
    cd robs-frontend
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ [ERROR] Frontend build failed."
        exit 1
    fi
    cd ..
else
    echo "⚠️ [WARN] robs-frontend directory not found. Skipping frontend build."
fi

# 4. Start Backend in Production Mode
echo "🚀 [BOOTSTRAP] Starting backend in production mode..."
cd robs-backend
npm run start:prod
if [ $? -ne 0 ]; then
    echo "❌ [ERROR] Backend failed to start or crashed."
    exit 1
fi
cd ..
