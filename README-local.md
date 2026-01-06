# 🚀 本地Zeabur环境测试指南

这个指南帮助你在本地完全模拟Zeabur环境，避免每次修改都要推送到GitHub等待部署。

## 📋 前提条件

确保你的系统已安装：
- Docker
- Docker Compose

## 🛠️ 快速开始

### 方法1：使用自动化脚本（推荐）

```bash
# 给脚本执行权限
chmod +x test-local.sh

# 运行测试脚本
./test-local.sh
```

### 方法2：手动步骤

```bash
# 1. 创建环境变量文件（如果不存在）
cp .env.example .env

# 2. 编辑.env文件，设置DEEPSEEK_API_KEY
# 使用你真实的DeepSeek API密钥

# 3. 创建必要目录
mkdir -p uploads outputs temp logs

# 4. 构建并启动
docker-compose up --build

# 5. 在浏览器中访问
# http://localhost:3000
```

## 🔧 环境配置

### 环境变量 (.env文件)

```bash
# DeepSeek API密钥（必需）
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 服务器配置
PORT=3000

# 文件存储目录
UPLOAD_DIR=/tmp/uploads
OUTPUT_DIR=/tmp/outputs
TEMP_DIR=/tmp/temp

# 可选：Node环境
NODE_ENV=production
```

## 📊 监控和调试

### 查看实时日志
```bash
# 查看应用日志
docker-compose logs -f app

# 查看所有服务日志
docker-compose logs -f
```

### 进入容器调试
```bash
# 进入运行中的容器
docker-compose exec app /bin/bash

# 在容器内检查文件
ls -la /app
python3 --version
node --version
```

### 健康检查
```bash
# 手动健康检查
curl http://localhost:3000/health

# 检查容器状态
docker-compose ps
```

## 🐛 常见问题排查

### 容器启动失败
```bash
# 查看详细错误信息
docker-compose logs app

# 重新构建镜像
docker-compose build --no-cache
```

### Python脚本权限问题
```bash
# 在容器内修复权限
docker-compose exec app chmod +x /app/pdf_processor.py
```

### 端口占用
```bash
# 停止所有容器
docker-compose down

# 使用不同端口（修改docker-compose.yml）
ports:
  - "3001:3000"
```

## 🔄 开发工作流程

### 修改代码后的测试流程

1. **本地修改代码**
2. **重新构建镜像**
   ```bash
   docker-compose up --build
   ```
3. **测试功能**
   - 访问 http://localhost:3000
   - 上传PDF测试
4. **查看日志**
   ```bash
   docker-compose logs -f app
   ```
5. **确认修复后推送**
   ```bash
   git add .
   git commit -m "修复说明"
   git push origin main
   ```

## 📁 项目结构

```
项目根目录/
├── docker-compose.yml      # Docker Compose配置
├── Dockerfile              # Docker镜像配置
├── .env.example            # 环境变量示例
├── test-local.sh           # 自动化测试脚本
├── uploads/                # 上传文件目录（本地映射）
├── outputs/                # 输出文件目录（本地映射）
├── temp/                   # 临时文件目录（本地映射）
└── logs/                   # 日志目录（本地映射）
```

## ⚡ 性能优化

### 开发模式（快速重启）
```yaml
# 在docker-compose.yml中添加
volumes:
  - .:/app  # 代码热重载
```

### 生产模式（优化构建）
```bash
# 使用多阶段构建优化镜像大小
# 已在Dockerfile中实现
```

## 🎯 下一步

1. **设置.env文件** - 配置你的DeepSeek API密钥
2. **运行测试脚本** - 验证环境是否正常
3. **开始本地开发** - 修改代码并立即测试
4. **确认修复后推送** - 避免反复部署

通过这个本地环境，你可以：
- ✅ 立即看到修改效果
- ✅ 快速调试错误
- ✅ 避免等待Zeabur部署
- ✅ 提高开发效率

**现在开始使用本地环境进行开发吧！** 🚀