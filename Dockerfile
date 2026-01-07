FROM python:3.9-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# 创建工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 调试信息：显示Python和Node.js版本
RUN python3 --version && node --version && npm --version

# 调试信息：验证Python脚本权限
RUN ls -la /app/pdf_processor.py && python3 -c "import sys; print(f'Python executable: {sys.executable}')"

# 安装Python依赖
RUN pip install -r requirements.txt

# 安装Node.js依赖
RUN npm install

# 创建必要的目录
RUN mkdir -p /tmp/uploads /tmp/outputs /tmp/temp

# 设置Python脚本执行权限
RUN chmod +x /app/pdf_processor.py

# 设置环境变量
ENV UPLOAD_DIR=/tmp/uploads
ENV OUTPUT_DIR=/tmp/outputs
ENV TEMP_DIR=/tmp/temp
ENV NODE_ENV=production

# 暴露端口（让Zeabur自动管理）
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 启动应用
CMD ["node", "server.js"]