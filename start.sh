#!/bin/bash

# 设置错误处理
set -e

# 创建必要的目录
echo "Creating necessary directories..."
mkdir -p /app/uploads /app/outputs /app/temp

# 设置权限
echo "Setting permissions..."
chmod -R 755 /app/uploads /app/outputs /app/temp

# 检查Python脚本权限
echo "Checking Python script permissions..."
chmod +x /app/pdf_processor.py

# 等待数据库或其他依赖服务（如果需要）
echo "Waiting for dependencies..."
sleep 5

# 启动应用程序
echo "Starting SlideMind application..."
exec node server.js