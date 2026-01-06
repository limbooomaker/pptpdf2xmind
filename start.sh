#!/bin/bash

# 设置错误处理
set -e

# 显示系统信息
echo "=== SlideMind Application Startup ==="
echo "Working directory: $(pwd)"
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "Python version: $(python3 --version)"

# 创建必要的目录
echo "Creating necessary directories..."
mkdir -p /app/uploads /app/outputs /app/temp

# 设置权限
echo "Setting permissions..."
chmod -R 755 /app/uploads /app/outputs /app/temp

# 检查Python脚本权限
echo "Checking Python script permissions..."
chmod +x /app/pdf_processor.py

# 检查Python依赖
echo "Checking Python dependencies..."
python3 -c "import pdf2image; import pdfplumber; import PIL; print('Python dependencies OK')"

# 检查Node.js依赖
echo "Checking Node.js dependencies..."
node -e "require('express'); require('multer'); console.log('Node.js dependencies OK')"

# 等待系统稳定
echo "Waiting for system to stabilize..."
sleep 10

# 启动应用程序
echo "Starting SlideMind application..."
exec node server.js