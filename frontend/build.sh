#!/bin/bash

# Frontend build helper script
set -e

echo "Building React frontend..."

# Ensure dependencies are installed.
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the frontend bundle.
echo "Building frontend assets..."
npm run build

echo "Frontend build completed successfully!"
