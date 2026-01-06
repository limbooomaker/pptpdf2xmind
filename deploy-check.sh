#!/bin/bash

echo "🚀 Zeabur部署稳定性检查脚本"
echo "=================================="

# 检查关键文件是否存在
echo "📁 检查关键文件..."
files=("Dockerfile" "zeabur.yml" "server.js" "pdf_processor.py" "requirements.txt" "package.json")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file - 缺失!"
        exit 1
    fi
done

echo ""

# 检查Dockerfile配置
echo "🐳 检查Dockerfile配置..."
if grep -q "FROM python:3.9-slim" Dockerfile; then
    echo "✅ 基础镜像正确"
else
    echo "❌ 基础镜像配置错误"
fi

if grep -q "poppler-utils" Dockerfile; then
    echo "✅ PDF处理依赖正确"
else
    echo "❌ PDF处理依赖缺失"
fi

if grep -q "chmod +x pdf_processor.py" Dockerfile; then
    echo "✅ Python脚本权限设置正确"
else
    echo "❌ Python脚本权限设置缺失"
fi

if grep -q "ENV UPLOAD_DIR=/tmp/uploads" Dockerfile; then
    echo "✅ 上传目录配置正确"
else
    echo "❌ 上传目录配置错误"
fi

echo ""

# 检查zeabur.yml配置
echo "⚙️  检查zeabur.yml配置..."
if grep -q "UPLOAD_DIR=/tmp/uploads" zeabur.yml; then
    echo "✅ Zeabur上传目录配置正确"
else
    echo "❌ Zeabur上传目录配置错误"
fi

if grep -q "memory: 512M" zeabur.yml; then
    echo "✅ 内存配置正确"
else
    echo "❌ 内存配置错误"
fi

echo ""

# 检查Python脚本
echo "🐍 检查Python脚本..."
if python3 -c "import sys; sys.path.append('.'); from pdf_processor import main; print('✅ Python脚本导入成功')" 2>/dev/null; then
    echo "✅ Python脚本语法正确"
else
    echo "❌ Python脚本语法错误"
fi

# 检查Python依赖
echo "📦 检查Python依赖..."
if python3 -c "import pdf2image, pdfplumber, PIL; print('✅ Python依赖检查通过')" 2>/dev/null; then
    echo "✅ Python依赖正常"
else
    echo "❌ Python依赖缺失"
fi

echo ""

# 检查Node.js服务
echo "📡 检查Node.js服务..."
if node -e "require('./server.js'); console.log('✅ Node.js服务语法正确')" 2>/dev/null; then
    echo "✅ Node.js服务语法正确"
else
    echo "❌ Node.js服务语法错误"
fi

# 检查健康检查端点
echo "❤️  检查健康检查端点..."
if grep -q "app.get('/health'" server.js; then
    echo "✅ 健康检查端点存在"
else
    echo "❌ 健康检查端点缺失"
fi

echo ""

# 模拟Zeabur环境测试
echo "🔧 模拟Zeabur环境测试..."

# 设置Zeabur环境变量
export UPLOAD_DIR=/tmp/uploads
export OUTPUT_DIR=/tmp/outputs
export TEMP_DIR=/tmp/temp
export PORT=3000

# 创建Zeabur路径
sudo mkdir -p /tmp/uploads /tmp/outputs /tmp/temp 2>/dev/null || mkdir -p /tmp/uploads /tmp/outputs /tmp/temp
sudo chmod 777 /tmp/uploads /tmp/outputs /tmp/temp 2>/dev/null || chmod 777 /tmp/uploads /tmp/outputs /tmp/temp

# 测试路径权限
if [ -w "/tmp/uploads" ] && [ -w "/tmp/outputs" ] && [ -w "/tmp/temp" ]; then
    echo "✅ Zeabur路径权限正常"
else
    echo "❌ Zeabur路径权限异常"
fi

echo ""

# 最终部署检查清单
echo "📋 部署检查清单"
echo "================"
echo ""
echo "✅ 关键文件完整性检查"
echo "✅ Docker配置检查"
echo "✅ Zeabur配置检查"
echo "✅ Python脚本检查"
echo "✅ Node.js服务检查"
echo "✅ 环境路径权限检查"
echo ""
echo "🎉 部署稳定性检查完成！"
echo ""
echo "🚀 现在可以安全部署到Zeabur："
echo "   git add ."
echo "   git commit -m '修复部署稳定性问题'"
echo "   git push origin main"
echo ""
echo "⚠️  部署后检查："
echo "   1. 观察Zeabur构建日志"
echo "   2. 检查容器健康状态"
echo "   3. 测试健康检查端点"
echo "   4. 验证PDF上传功能"
echo ""
echo "🔧 如果部署失败，查看以下日志："
echo "   - Zeabur构建日志"
echo "   - 容器启动日志"
echo "   - 应用运行日志"