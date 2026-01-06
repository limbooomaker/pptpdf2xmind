#!/bin/bash

echo "🚀 本地Zeabur环境测试脚本"
echo "================================"

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

echo "✅ Docker环境检查通过"

# 创建必要的目录
mkdir -p uploads outputs temp logs

echo "📁 创建必要的目录结构"

# 检查环境变量文件
if [ ! -f .env ]; then
    echo "⚠️  未找到.env文件，使用示例配置"
    cp .env.example .env
    echo "📝 请编辑.env文件设置DEEPSEEK_API_KEY"
fi

echo "🔧 开始构建Docker镜像..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "❌ Docker镜像构建失败"
    exit 1
fi

echo "✅ Docker镜像构建成功"

echo "🚀 启动应用容器..."
docker-compose up -d

# 等待容器启动
echo "⏳ 等待应用启动..."
sleep 10

# 检查容器状态
echo "📊 检查容器状态..."
docker-compose ps

# 检查健康状态
echo "❤️  健康检查..."
for i in {1..10}; do
    RESPONSE=$(curl -s -f http://localhost:3000/health 2>/dev/null || echo "fail")
    if [ "$RESPONSE" != "fail" ]; then
        echo "✅ 应用健康检查通过"
        echo "响应: $RESPONSE"
        break
    else
        echo "⏳ 等待应用启动... ($i/10)"
        sleep 5
    fi
    
    if [ $i -eq 10 ]; then
        echo "❌ 应用启动超时"
        echo "查看日志: docker-compose logs app"
        exit 1
    fi
done

echo ""
echo "🎉 本地环境测试完成！"
echo "📱 应用地址: http://localhost:3000"
echo ""
echo "📋 常用命令:"
echo "   查看日志: docker-compose logs -f app"
echo "   停止应用: docker-compose down"
echo "   重新构建: docker-compose up --build"
echo "   进入容器: docker-compose exec app /bin/bash"
echo ""
echo "🔧 现在可以开始测试PDF上传功能了！"