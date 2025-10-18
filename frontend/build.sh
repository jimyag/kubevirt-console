#!/bin/bash

# 前端构建脚本
set -e

echo "Building React frontend..."

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# 构建前端
echo "Building frontend assets..."
npm run build

echo "Frontend build completed successfully!"
