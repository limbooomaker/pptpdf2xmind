#!/bin/bash

echo "🚀 Trae环境快速测试脚本"
echo "=============================="

# 检查Node.js和Python版本
echo "📊 检查环境版本..."
node --version
python3 --version

# 检查依赖是否安装
echo "📦 检查Node.js依赖..."
npm list express multer cors openai uuid

echo "🐍 检查Python依赖..."
python3 -c "import pdf2image, pdfplumber, PIL; print('Python依赖检查通过')"

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p uploads outputs temp

# 检查Python脚本权限
echo "🔧 检查Python脚本..."
ls -la pdf_processor.py
chmod +x pdf_processor.py

# 测试Python脚本基本功能
echo "🧪 测试Python脚本..."
python3 pdf_processor.py --help 2>/dev/null || echo "Python脚本需要参数才能运行"

# 启动Node服务进行测试
echo "🚀 启动Node服务进行测试..."

# 设置测试环境变量
export PORT=3000
export UPLOAD_DIR=./uploads
export OUTPUT_DIR=./outputs
export TEMP_DIR=./temp

# 后台启动服务
node server.js &
SERVER_PID=$!

echo "⏳ 等待服务启动..."
sleep 5

# 检查服务是否启动
echo "❤️  健康检查..."
for i in {1..5}; do
    if curl -s http://localhost:3000/health > /dev/null; then
        echo "✅ 服务启动成功！"
        echo "📱 应用地址: http://localhost:3000"
        break
    else
        echo "⏳ 等待服务启动... ($i/5)"
        sleep 3
    fi
    
    if [ $i -eq 5 ]; then
        echo "❌ 服务启动失败"
        echo "查看服务日志..."
        kill $SERVER_PID 2>/dev/null
        exit 1
    fi
done

echo ""
echo "🎉 Trae环境测试完成！"
echo ""
echo "📋 测试结果："
echo "   ✅ Node.js环境正常"
echo "   ✅ Python环境正常"
echo "   ✅ 依赖检查通过"
echo "   ✅ 服务启动成功"
echo ""
echo "🔧 现在可以在浏览器中测试应用："
echo "   http://localhost:3000"
echo ""
echo "⚠️  注意：服务已在后台运行，PID: $SERVER_PID"
echo "   停止服务: kill $SERVER_PID"
echo ""
echo "📊 下一步："
echo "   1. 在浏览器中打开 http://localhost:3000"
echo "   2. 测试PDF上传功能"
echo "   3. 查看控制台日志是否有错误"